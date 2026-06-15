"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BadgeCheck,
  ShieldX,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { RESOLVER, SUBJECTS, type Subject } from "../config";

type Result = {
  trustStatus?: string;
  authorized?: boolean;
  error?: string;
};

type Verdict = {
  tone: "ok" | "warn" | "bad" | "unknown";
  title: string;
  detail: string;
  Icon: typeof BadgeCheck;
};

function verdictFor(s: Subject, r: Result): Verdict {
  if (r.error)
    return { tone: "unknown", title: "Resolver unreachable", detail: r.error, Icon: ShieldAlert };
  const trusted = r.trustStatus === "TRUSTED";
  const role = s.kind === "issuer" ? "issuer" : "verifier";
  if (!trusted)
    return {
      tone: "bad",
      title: s.kind === "issuer" ? "Untrusted issuer" : "Untrusted verifier",
      detail:
        "Not a trusted participant of the Verana Trust Network. A valid signature proves authenticity, not legitimacy.",
      Icon: ShieldX,
    };
  if (r.authorized)
    return {
      tone: "ok",
      title: s.kind === "issuer" ? "Accredited issuer" : "Authorized verifier",
      detail: `Trusted Verifiable Service with an active accreditation as ${role} for this credential on the Verana Trust Network.`,
      Icon: BadgeCheck,
    };
  return {
    tone: "warn",
    title: "Trusted — but not accredited for this credential",
    detail: `A trusted service, but not authorized to act as ${role} for this credential type.`,
    Icon: ShieldAlert,
  };
}

const TONE: Record<Verdict["tone"], { bar: string; chip: string; text: string }> = {
  ok: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  warn: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700", text: "text-amber-700" },
  bad: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700", text: "text-rose-700" },
  unknown: { bar: "bg-gray-400", chip: "bg-gray-100 text-gray-600", text: "text-gray-600" },
};

async function resolve(s: Subject, signal: AbortSignal): Promise<Result> {
  const did = encodeURIComponent(s.did);
  const vtjsc = encodeURIComponent(s.vtjsc);
  const authPath = s.kind === "issuer" ? "issuer-authorization" : "verifier-authorization";
  const [q1, q2] = await Promise.all([
    fetch(`${RESOLVER}/resolve?did=${did}`, { signal }).then((r) => r.json()),
    fetch(`${RESOLVER}/${authPath}?did=${did}&vtjscId=${vtjsc}`, { signal }).then((r) => r.json()),
  ]);
  return { trustStatus: q1?.trustStatus, authorized: q2?.authorized === true };
}

export default function ResolverVerdict() {
  const [active, setActive] = useState<Subject>(SUBJECTS[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  // Each run owns an AbortController: switching subjects aborts the previous
  // request (so a slow earlier response can't land under the new subject's
  // labels), and a timeout aborts a stalled socket.
  const run = useCallback((s: Subject) => {
    const ac = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, 8000);
    setLoading(true);
    setResult(null);
    resolve(s, ac.signal).then(
      (r) => {
        clearTimeout(timer);
        if (ac.signal.aborted && !timedOut) return; // superseded by a newer request
        setResult(r);
        setLoading(false);
      },
      (e: unknown) => {
        clearTimeout(timer);
        if (ac.signal.aborted && !timedOut) return;
        setResult({ error: timedOut ? "Resolver timed out" : e instanceof Error ? e.message : "network error" });
        setLoading(false);
      },
    );
    return ac;
  }, []);

  useEffect(() => {
    const ac = run(active);
    return () => ac.abort();
  }, [active, run]);

  const verdict = result ? verdictFor(active, result) : null;
  const tone = verdict ? TONE[verdict.tone] : TONE.unknown;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* subject picker */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100 bg-gray-50/60">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s)}
            aria-pressed={active.key === s.key}
            className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
              active.key === s.key
                ? "border-violet-300 bg-violet-50 text-violet-800"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            <span className="block font-medium">{s.label}</span>
            <span className="block text-[11px] text-gray-400">{s.phase}</span>
          </button>
        ))}
      </div>

      <div className="p-5">
        <p className="text-sm text-gray-500 mb-4">{active.blurb}</p>

        {/* verdict card */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className={`h-1 ${tone.bar}`} />
          <div className="p-4">
            {loading || !verdict ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Querying the Verana Trust Resolver…
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone.chip}`}>
                    <verdict.Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <p className={`font-semibold ${tone.text}`}>{verdict.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{verdict.detail}</p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                  <dt className="text-gray-400">DID</dt>
                  <dd className="font-mono text-gray-700 break-all">{active.did}</dd>
                  <dt className="text-gray-400">Q1 · resolve</dt>
                  <dd className="text-gray-700">
                    trustStatus: <span className="font-medium">{result?.trustStatus ?? "—"}</span>
                  </dd>
                  <dt className="text-gray-400">
                    {active.kind === "issuer" ? "Q2 · issuer-auth" : "Q3 · verifier-auth"}
                  </dt>
                  <dd className="text-gray-700">
                    authorized: <span className="font-medium">{String(result?.authorized ?? "—")}</span>
                  </dd>
                </dl>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            live · queried directly against <span className="font-mono">resolver.testnet.verana.network</span>
          </span>
          <button
            onClick={() => run(active)}
            className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> re-check
          </button>
        </div>
      </div>
    </div>
  );
}
