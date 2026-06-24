import { BadgeCheck, ShieldX, ShieldAlert, type LucideIcon } from "lucide-react";
import { RESOLVER, type SubjectKind } from "../config";

export type TrustResult = {
  trustStatus?: string;
  authorized?: boolean;
  notFound?: boolean;
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

// A 404 is a definitive verdict from a reachable resolver ("no trust record for
// this DID"), not an outage, so surface it distinctly. Any other non-2xx has no
// trustStatus to read, so it stays an honest "resolver unreachable".
class ResolverNotFound extends Error {}

async function getJson(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal });
  if (res.status === 404) throw new ResolverNotFound();
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

  let r1: Record<string, unknown>;
  try {
    r1 = await getJson(`${RESOLVER}/resolve?did=${did}`, signal);
  } catch (e) {
    if (e instanceof ResolverNotFound) return { notFound: true };
    throw e;
  }
  const trustStatus = r1?.trustStatus as string | undefined;

  if (opts.kind === "anchor" || !opts.vtjsc) return { trustStatus };

  const authPath = opts.kind === "issuer" ? "issuer-authorization" : "verifier-authorization";
  const vtjsc = encodeURIComponent(opts.vtjsc);
  try {
    const r2 = await getJson(`${RESOLVER}/${authPath}?did=${did}&vtjscId=${vtjsc}`, signal);
    return { trustStatus, authorized: r2?.authorized === true };
  } catch (e) {
    if (e instanceof ResolverNotFound) return { trustStatus, authorized: false };
    throw e;
  }
}

export function verdictFor(kind: SubjectKind, r: TrustResult): Verdict {
  if (r.notFound)
    return {
      tone: "bad",
      title: kind === "anchor" ? "Untrusted" : kind === "issuer" ? "Untrusted issuer" : "Untrusted verifier",
      detail:
        "The Verana Trust Resolver has no trust record for this DID. It is unknown to the network, so it cannot be trusted. A valid signature proves authenticity, not legitimacy.",
      Icon: ShieldX,
    };
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
