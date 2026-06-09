"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Ban,
  CircleAlert,
  CloudOff,
  FileWarning,
  Landmark,
  Loader2,
  Network,
  ServerCrash,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
} from "lucide-react";
import type { TrustReport, Verdict } from "@/lib/verana/types";

const SAMPLES = [
  { file: "valid-resident-id.json", label: "Trusted issuer" },
  { file: "self-signed.json", label: "Self-signed" },
  { file: "wrong-schema.json", label: "Wrong schema" },
  { file: "tampered.json", label: "Tampered" },
] as const;

const VERDICTS: Record<
  Verdict,
  { title: string; tone: string; icon: React.ElementType; explain: string }
> = {
  TRUSTED_AUTHORIZED: {
    title: "Trusted & accredited issuer",
    tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    icon: ShieldCheck,
    explain:
      "MOSIP Inji Verify confirmed the credential is authentic, AND the Verana Trust Network confirms the issuer is a Trusted Verifiable Service with an active ISSUER accreditation for this credential type.",
  },
  TRUSTED_NOT_AUTHORIZED: {
    title: "Trusted service — NOT accredited for this credential type",
    tone: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    icon: CircleAlert,
    explain:
      "The credential is authentic and the issuer is a Trusted Verifiable Service, but it holds no ISSUER accreditation for this credential's schema. It is issuing outside its accreditation.",
  },
  TRUSTED_NO_SCHEMA: {
    title: "Trusted service — credential type not verifiable",
    tone: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    icon: ShieldQuestion,
    explain:
      "The credential is authentic and the issuer is trusted, but it carries no credentialSchema reference, so its accreditation for this credential type cannot be checked.",
  },
  PARTIAL_TRUST: {
    title: "Partial trust",
    tone: "border-yellow-500/50 bg-yellow-500/10 text-yellow-300",
    icon: ShieldQuestion,
    explain:
      "The credential is authentic, but the issuer's Verana trust chain is incomplete (PARTIAL). Treat with caution.",
  },
  UNTRUSTED: {
    title: "Authentic, but untrusted issuer",
    tone: "border-red-500/50 bg-red-500/10 text-red-300",
    icon: ShieldX,
    explain:
      "MOSIP Inji Verify confirmed the signature is valid — but the issuer is not a trusted participant of the Verana Trust Network. A valid signature proves authenticity, not legitimacy.",
  },
  INVALID_CREDENTIAL: {
    title: "Invalid credential",
    tone: "border-red-500/50 bg-red-500/10 text-red-300",
    icon: Ban,
    explain:
      "MOSIP Inji Verify rejected the credential — its signature, schema, or validity failed. Its content cannot be trusted at all.",
  },
  RESOLVER_UNAVAILABLE: {
    title: "Trust resolution unavailable",
    tone: "border-slate-500/50 bg-slate-500/10 text-slate-300",
    icon: CloudOff,
    explain:
      "The credential was verified by MOSIP Inji Verify, but the Verana Trust Resolver could not be reached. No trust verdict can be given — do not treat this issuer as accredited.",
  },
  VERIFY_SERVICE_UNAVAILABLE: {
    title: "Verification service unavailable",
    tone: "border-slate-500/50 bg-slate-500/10 text-slate-300",
    icon: ServerCrash,
    explain:
      "The MOSIP Inji Verify service could not be reached, so the credential could not be verified at all. No verdict can be given.",
  },
};

function Chip({ ok, label }: { ok: boolean | undefined; label: string }) {
  const tone =
    ok === undefined
      ? "bg-slate-800 text-slate-400"
      : ok
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-red-500/15 text-red-300";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}

function Row({ label, value, mono = true }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className={`break-all text-slate-200 ${mono ? "font-mono text-xs leading-5" : ""}`}>{value}</span>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [report, setReport] = useState<TrustReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSample(file: string) {
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/fixtures/${file}`);
      if (!res.ok) throw new Error(`could not load sample (HTTP ${res.status})`);
      setInput(JSON.stringify(await res.json(), null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: input,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `verification request failed (HTTP ${res.status})`);
      } else {
        setReport(data as TrustReport);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const verdict = report ? VERDICTS[report.verdict] : null;
  const VerdictIcon = verdict?.icon ?? ShieldQuestion;
  const trustChecked = report?.signatureValid && report.verdict !== "VERIFY_SERVICE_UNAVAILABLE";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Network className="h-7 w-7 text-emerald-400" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Inji Verify <span className="text-slate-500">×</span> Verana Trust Check
          </h1>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-300">
            MOSIP Pilot — Phase 1
          </span>
        </div>
        <p className="max-w-3xl text-sm text-slate-400">
          Paste a verifiable credential. <strong className="text-slate-300">MOSIP Inji Verify</strong>{" "}
          verifies its signature, schema and validity, then the{" "}
          <strong className="text-slate-300">Verana Trust Network</strong> answers <em>is the issuer a
          Trusted Verifiable Service?</em> and <em>is it an accredited issuer of this credential type?</em>{" "}
          — turning &ldquo;the signature is valid&rdquo; into &ldquo;the issuer is accredited.&rdquo;
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Samples</span>
            {SAMPLES.map((s) => (
              <button
                key={s.file}
                onClick={() => loadSample(s.file)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-500/50 hover:text-emerald-300"
              >
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder='{"@context": ["https://www.w3.org/2018/credentials/v1", …], "type": ["VerifiableCredential", …], "proof": { … }}'
            className="h-[420px] w-full resize-none rounded-xl border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-emerald-500/40"
          />
          <button
            onClick={verify}
            disabled={busy || input.trim().length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            {busy ? "Verifying…" : "Verify credential"}
          </button>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <FileWarning className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-4">
          {!report && (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-600">
              The trust verdict will appear here.
            </div>
          )}

          {report && verdict && (
            <>
              <div className={`rounded-xl border p-5 ${verdict.tone}`}>
                <div className="mb-1 flex items-center gap-2">
                  <VerdictIcon className="h-5 w-5 shrink-0" />
                  <h2 className="font-semibold">{verdict.title}</h2>
                </div>
                <p className="text-sm opacity-90">{verdict.explain}</p>
                {report.signatureError && (
                  <p className="mt-2 font-mono text-xs opacity-80">{report.signatureError}</p>
                )}
                {report.resolverError && (
                  <p className="mt-2 font-mono text-xs opacity-80">{report.resolverError}</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-3 flex items-center gap-2 text-slate-300">
                  <BadgeCheck className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold">Verified by MOSIP Inji Verify</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip ok={report.signatureValid} label={report.signatureValid ? "Signature valid" : "Signature invalid"} />
                  {report.expiryValid !== undefined && (
                    <Chip ok={report.expiryValid} label={report.expiryValid ? "Not expired" : "Expired"} />
                  )}
                </div>
              </div>

              {trustChecked && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <Network className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold">Verana Trust Network</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.trustStatus ? (
                      <Chip ok={report.trustStatus === "TRUSTED"} label={`Trust: ${report.trustStatus}`} />
                    ) : (
                      <Chip ok={false} label="Not on Verana" />
                    )}
                    {report.authorized !== undefined && (
                      <Chip ok={report.authorized} label={report.authorized ? "Accredited issuer" : "Not accredited"} />
                    )}
                    {report.production !== undefined && (
                      <Chip ok={report.production} label={report.production ? "Production DID" : "Non-production DID"} />
                    )}
                  </div>

                  {report.identity?.organizationName && (
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <div className="mb-3 flex items-center gap-2 text-slate-400">
                        <Landmark className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Accountable organization</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <Row label="Organization" value={report.identity.organizationName} mono={false} />
                        <Row label="Country" value={report.identity.countryCode} mono={false} />
                        <Row label="Registry ID" value={report.identity.registryId} />
                        <Row label="Address" value={report.identity.address} mono={false} />
                        <Row label="Service" value={report.identity.serviceName} mono={false} />
                        <Row label="Ecosystem" value={report.identity.ecosystemDid} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-300">Resolution details</h3>
                <div className="space-y-2 text-sm">
                  <Row label="Issuer DID" value={report.issuerDid} />
                  <Row label="Schema (VTJSC)" value={report.schemaId} />
                  <Row label="Evaluated at" value={report.evaluatedAt} />
                  <Row
                    label="Block height"
                    value={report.evaluatedAtBlock ? String(report.evaluatedAtBlock) : undefined}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="mt-10 border-t border-slate-900 pt-4 text-xs text-slate-600">
        Verification: MOSIP Inji Verify verify-service · Trust: Verana Trust Resolver
        (resolver.testnet.verana.network) · Issuer onboarded in Phase 0:
        did:web:inji-certify-vs.mosip.testnet.verana.network
      </footer>
    </main>
  );
}
