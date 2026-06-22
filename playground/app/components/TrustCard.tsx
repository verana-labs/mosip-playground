"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, ArrowUpRight } from "lucide-react";
import { checkTrust, verdictFor, TONE, type TrustResult } from "../lib/trust";
import type { Entity } from "../config";

const Q_LABEL: Record<Entity["kind"], string> = {
  anchor: "Q1 · resolve",
  issuer: "Q2 · issuer-auth",
  verifier: "Q3 · verifier-auth",
};

export default function TrustCard({ entity }: { entity: Entity }) {
  const [result, setResult] = useState<TrustResult | null>(null);
  const [loading, setLoading] = useState(true);
  const acRef = useRef<AbortController | null>(null);

  // Abort any in-flight request (effect-driven or a manual re-check) before
  // starting a new one, and only let the current controller update state, so a
  // slow earlier response can never land under fresher results.
  const run = useCallback(() => {
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
    checkTrust(entity, ac.signal).then(
      (r) => {
        clearTimeout(timer);
        if (acRef.current !== ac) return;
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
  }, [entity]);

  useEffect(() => {
    run();
    return () => acRef.current?.abort();
  }, [run]);

  const verdict = result ? verdictFor(entity.kind, result) : null;
  const tone = verdict ? TONE[verdict.tone] : TONE.unknown;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className={`h-1 ${tone.bar}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-gray-900">{entity.label}</span>
            <span className="text-xs text-gray-400 font-medium">{entity.role}</span>
          </div>
          <button
            onClick={run}
            aria-label="Re-check"
            className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> re-check
          </button>
        </div>

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
              <dd className="font-mono text-gray-700 break-all">{entity.did}</dd>
              <dt className="text-gray-400">Q1 · resolve</dt>
              <dd className="text-gray-700">
                trustStatus: <span className="font-medium">{result?.trustStatus ?? ", "}</span>
              </dd>
              {entity.kind !== "anchor" && (
                <>
                  <dt className="text-gray-400">{Q_LABEL[entity.kind]}</dt>
                  <dd className="text-gray-700">
                    authorized: <span className="font-medium">{String(result?.authorized ?? ", ")}</span>
                  </dd>
                </>
              )}
            </dl>
          </>
        )}

        {(entity.veranaUrl || entity.didDocUrl) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-xs">
            {entity.veranaUrl && (
              <a
                href={entity.veranaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                View in Verana <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
            {entity.didDocUrl && (
              <a
                href={entity.didDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                DID document <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
