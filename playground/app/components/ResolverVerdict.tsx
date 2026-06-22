"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SUBJECTS, type Subject } from "../config";
import { checkTrust, verdictFor, TONE, type TrustResult } from "../lib/trust";

export default function ResolverVerdict() {
  const [active, setActive] = useState<Subject>(SUBJECTS[0]);
  const [result, setResult] = useState<TrustResult | null>(null);
  const [loading, setLoading] = useState(false);
  const acRef = useRef<AbortController | null>(null);

  // One live AbortController in a ref: switching subjects or a manual re-check
  // aborts the previous request and supersedes it, so a slow earlier response
  // can't land under the new subject's labels. A timeout aborts a stalled socket.
  const run = useCallback((s: Subject) => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, 8000);
    setLoading(true);
    setResult(null);
    checkTrust(s, ac.signal).then(
      (r) => {
        clearTimeout(timer);
        if (acRef.current !== ac) return; // superseded by a newer request
        setResult(r);
        setLoading(false);
      },
      (e: unknown) => {
        clearTimeout(timer);
        if (acRef.current !== ac) return;
        setResult({ error: timedOut ? "Resolver timed out" : e instanceof Error ? e.message : "network error" });
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    run(active);
    return () => acRef.current?.abort();
  }, [active, run]);

  const verdict = result ? verdictFor(active.kind, result) : null;
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
                    trustStatus: <span className="font-medium">{result?.trustStatus ?? ", "}</span>
                  </dd>
                  <dt className="text-gray-400">
                    {active.kind === "issuer" ? "Q2 · issuer-auth" : "Q3 · verifier-auth"}
                  </dt>
                  <dd className="text-gray-700">
                    authorized: <span className="font-medium">{String(result?.authorized ?? ", ")}</span>
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
