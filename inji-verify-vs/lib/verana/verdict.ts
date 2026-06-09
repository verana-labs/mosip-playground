import type {
  IssuerAuthorization,
  IssuerIdentity,
  ResolverOutcome,
  TrustReport,
  TrustResolution,
} from "./types";

interface VerdictInput {
  signatureValid: boolean;
  signatureError?: string;
  issuerDid?: string;
  schemaId?: string;
  q1?: ResolverOutcome<TrustResolution>;
  q2?: ResolverOutcome<IssuerAuthorization>;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function extractIdentity(resolution: TrustResolution): IssuerIdentity {
  const identity: IssuerIdentity = {};
  for (const cred of resolution.credentials ?? []) {
    if (cred.result !== "VALID") continue;
    if (cred.ecsType === "ECS-SERVICE" && cred.id === resolution.did) {
      identity.serviceName = asString(cred.claims.name);
      identity.serviceDescription = asString(cred.claims.description);
    }
    if (cred.ecsType === "ECS-ORG") {
      identity.organizationName = asString(cred.claims.name);
      identity.countryCode = asString(cred.claims.countryCode);
      identity.registryId = asString(cred.claims.registryId);
      identity.address = asString(cred.claims.address);
      identity.ecosystemDid = asString(cred.issuedBy);
    }
  }
  return identity;
}

export function buildTrustReport(input: VerdictInput): TrustReport {
  const { signatureValid, signatureError, issuerDid, schemaId, q1, q2 } = input;

  if (!signatureValid) {
    return { verdict: "INVALID_CREDENTIAL", signatureValid: false, signatureError, issuerDid, schemaId };
  }

  const base: TrustReport = { verdict: "UNTRUSTED", signatureValid: true, issuerDid, schemaId };

  if (!q1) {
    return { ...base, verdict: "RESOLVER_UNAVAILABLE", resolverError: "trust resolution was not performed" };
  }
  if (!q1.ok) {
    if (q1.notFound) {
      // The resolver has no trust evaluation for this DID: cryptographically
      // valid but completely outside the Verana Trust Network.
      return { ...base, verdict: "UNTRUSTED" };
    }
    return { ...base, verdict: "RESOLVER_UNAVAILABLE", resolverError: q1.error };
  }

  const resolution = q1.data;
  const report: TrustReport = {
    ...base,
    trustStatus: resolution.trustStatus,
    identity: extractIdentity(resolution),
    evaluatedAt: resolution.evaluatedAt,
    evaluatedAtBlock: resolution.evaluatedAtBlock,
    production: resolution.production,
  };

  if (resolution.trustStatus !== "TRUSTED") {
    // Exhaustive and fail-closed: UNTRUSTED and PARTIAL map to their verdicts;
    // any status that validation somehow let through is treated as UNTRUSTED,
    // never as trusted.
    return { ...report, verdict: resolution.trustStatus === "PARTIAL" ? "PARTIAL_TRUST" : "UNTRUSTED" };
  }

  // trustStatus === TRUSTED — now the schema authorization decides the final verdict.
  if (!schemaId) {
    return { ...report, verdict: "TRUSTED_NO_SCHEMA" };
  }
  if (!q2) {
    return { ...report, verdict: "RESOLVER_UNAVAILABLE", resolverError: "issuer authorization was not checked" };
  }
  if (!q2.ok) {
    if (q2.notFound) return { ...report, verdict: "TRUSTED_NOT_AUTHORIZED", authorized: false };
    return { ...report, verdict: "RESOLVER_UNAVAILABLE", resolverError: q2.error };
  }

  return {
    ...report,
    authorized: q2.data.authorized,
    verdict: q2.data.authorized ? "TRUSTED_AUTHORIZED" : "TRUSTED_NOT_AUTHORIZED",
  };
}
