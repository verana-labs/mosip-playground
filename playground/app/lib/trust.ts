import { BadgeCheck, ShieldX, ShieldAlert, type LucideIcon } from "lucide-react";
import { RESOLVER, type SubjectKind } from "../config";

export type TrustResult = {
  trustStatus?: string;
  authorized?: boolean;
  error?: string;
};

export type Tone = "ok" | "warn" | "bad" | "unknown";

export type Verdict = {
  tone: Tone;
  title: string;
  detail: string;
  Icon: LucideIcon;
};

export const TONE: Record<Tone, { bar: string; chip: string; text: string }> = {
  ok: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  warn: { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700", text: "text-amber-700" },
  bad: { bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700", text: "text-rose-700" },
  unknown: { bar: "bg-gray-400", chip: "bg-gray-100 text-gray-600", text: "text-gray-600" },
};

// A non-2xx with a JSON body must not be read as a trust verdict, it has no
// trustStatus, so it would render a confident "untrusted" instead of an honest
// "resolver unreachable". Throw so the caller's rejection path shows the error.
async function getJson(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Resolver returned ${res.status}`);
  return res.json();
}

// Q1 resolve for everyone; Q2/Q3 authorization for issuer/verifier. The anchor
// is only asked Q1, being a TRUSTED ecosystem root needs no per-credential grant.
export async function checkTrust(
  opts: { did: string; kind: SubjectKind; vtjsc?: string },
  signal: AbortSignal,
): Promise<TrustResult> {
  const did = encodeURIComponent(opts.did);
  const q1 = getJson(`${RESOLVER}/resolve?did=${did}`, signal);

  if (opts.kind === "anchor" || !opts.vtjsc) {
    const r1 = await q1;
    return { trustStatus: r1?.trustStatus as string | undefined };
  }

  const authPath = opts.kind === "issuer" ? "issuer-authorization" : "verifier-authorization";
  const vtjsc = encodeURIComponent(opts.vtjsc);
  const [r1, r2] = await Promise.all([
    q1,
    getJson(`${RESOLVER}/${authPath}?did=${did}&vtjscId=${vtjsc}`, signal),
  ]);
  return { trustStatus: r1?.trustStatus as string | undefined, authorized: r2?.authorized === true };
}

export function verdictFor(kind: SubjectKind, r: TrustResult): Verdict {
  if (r.error)
    return { tone: "unknown", title: "Resolver unreachable", detail: r.error, Icon: ShieldAlert };

  const trusted = r.trustStatus === "TRUSTED";

  if (kind === "anchor") {
    return trusted
      ? {
          tone: "ok",
          title: "Trusted ecosystem anchor",
          detail:
            "Resolves as a TRUSTED Verifiable Service on the Verana Trust Network, the root every credential in this ecosystem chains back to.",
          Icon: BadgeCheck,
        }
      : {
          tone: "bad",
          title: "Untrusted",
          detail:
            "The anchor does not resolve as trusted, so nothing beneath it can be trusted either. The whole ecosystem fails closed.",
          Icon: ShieldX,
        };
  }

  const role = kind === "issuer" ? "issuer" : "verifier";

  if (!trusted)
    return {
      tone: "bad",
      title: kind === "issuer" ? "Untrusted issuer" : "Untrusted verifier",
      detail:
        "Not a trusted participant of the Verana Trust Network. A valid signature proves authenticity, not legitimacy.",
      Icon: ShieldX,
    };

  if (r.authorized)
    return {
      tone: "ok",
      title: kind === "issuer" ? "Accredited issuer" : "Authorized verifier",
      detail: `Trusted Verifiable Service with an active accreditation as ${role} for this credential on the Verana Trust Network.`,
      Icon: BadgeCheck,
    };

  return {
    tone: "warn",
    title: "Trusted, but not accredited for this credential",
    detail: `A trusted service, but not authorized to act as ${role} for this credential type.`,
    Icon: ShieldAlert,
  };
}
