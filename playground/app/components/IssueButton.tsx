"use client";

import { Fragment, useEffect, useState } from "react";
import { IdCard, Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";

type VC = { credentialSubject?: Record<string, unknown>; issuer?: unknown; [k: string]: unknown };

const ERROR_COPY: Record<string, string> = {
  state_mismatch: "The login session did not match. Please start again.",
  login_failed: "The eSignet login was cancelled or failed.",
  token_invalid: "eSignet did not return a usable token.",
  issue_failed: "Something went wrong during issuance. Please try again.",
};
const friendlyError = (code: string) =>
  ERROR_COPY[code] ??
  (code.startsWith("token_")
    ? "eSignet rejected the token request."
    : code.startsWith("credential_")
      ? "Inji Certify could not issue the credential."
      : "Issuance did not complete. Please try again.");

export default function IssueButton() {
  const [vc, setVc] = useState<VC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // On return from eSignet the callback redirects to /?issued=<id> or /?issue_error=<code>.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const issued = sp.get("issued");
    const err = sp.get("issue_error");
    if (!issued && !err) return;
    const cleanUrl = () => window.history.replaceState({}, "", `${window.location.pathname}#issue`);
    if (err) {
      setError(friendlyError(err));
      cleanUrl();
      return;
    }
    let ignore = false;
    setLoading(true);
    fetch(`/api/issue/result?id=${encodeURIComponent(issued!)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        if (ignore) return;
        if (d && typeof d === "object" && d.credential) setVc(d.credential as VC);
        else setError("The issued credential could not be read.");
      })
      .catch(() => { if (!ignore) setError("The issued credential expired. Please try again."); })
      .finally(() => { if (ignore) return; setLoading(false); cleanUrl(); });
    return () => { ignore = true; };
  }, []);

  const subject = (vc?.credentialSubject ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <IdCard className="w-4 h-4 text-violet-500" />
        <span className="font-semibold text-gray-900 text-sm">Issue a Foundational Resident ID</span>
      </div>

      {!vc && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Run the real eSignet login. Sign in as a seeded resident, Asha
            (UIN <span className="font-mono">7841223190</span>) or Ravi (<span className="font-mono">3320114588</span>):
            enter the UIN, request the OTP, and use <span className="font-mono">111111</span>. Inji Certify then
            issues the signed credential and it appears here.
          </p>
          <a
            href="/api/issue/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Issue via eSignet
          </a>
        </>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {vc && (
        <div>
          <div className="flex items-center gap-2 mb-3 text-emerald-700">
            <Check className="w-4 h-4" /> <span className="font-semibold text-sm">Credential issued</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {Object.entries(subject)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="text-gray-800 break-all">{String(v)}</dd>
                </Fragment>
              ))}
          </dl>
          {vc.issuer != null && (
            <p className="text-xs text-gray-400 mt-3 break-all">
              issuer: <span className="font-mono">{String(vc.issuer)}</span>
            </p>
          )}
          <button onClick={() => setOpen((o) => !o)} className="mt-3 text-xs text-violet-600 hover:text-violet-800">
            {open ? "hide raw VC" : "show raw VC"}
          </button>
          {open && (
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-gray-900 text-gray-100 text-xs p-4">
              {JSON.stringify(vc, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
