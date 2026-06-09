import type { IssuerAuthorization, ResolvedCredential, TrustResolution, TrustStatus } from "./types";

const TRUST_STATUSES: readonly TrustStatus[] = ["TRUSTED", "PARTIAL", "UNTRUSTED"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function validateCredential(raw: unknown): ResolvedCredential | null {
  if (!isObject(raw)) return null;
  const claims = isObject(raw.claims) ? raw.claims : {};
  return {
    id: asString(raw.id) ?? "",
    type: asString(raw.type) ?? "",
    claims,
    format: asString(raw.format) ?? "",
    result: asString(raw.result) ?? "",
    ecsType: asString(raw.ecsType) ?? "",
    issuedBy: asString(raw.issuedBy) ?? "",
    presentedBy: asString(raw.presentedBy) ?? "",
  };
}

// Strictly validates the Q1 payload. The trust decision depends on this, so any
// deviation (wrong DID, unknown status, non-array credentials) is rejected rather
// than coerced — a malformed response must surface as RESOLVER_UNAVAILABLE,
// never silently become TRUSTED.
export function validateTrustResolution(raw: unknown, expectedDid: string): TrustResolution {
  if (!isObject(raw)) throw new Error("resolver returned a non-object trust resolution");

  const trustStatus = raw.trustStatus;
  if (typeof trustStatus !== "string" || !TRUST_STATUSES.includes(trustStatus as TrustStatus)) {
    throw new Error(`resolver returned unknown trustStatus: ${JSON.stringify(trustStatus)}`);
  }
  if (raw.did !== expectedDid) {
    throw new Error("resolver trust resolution DID does not match the requested DID");
  }
  if (!Array.isArray(raw.credentials)) {
    throw new Error("resolver trust resolution credentials is not an array");
  }

  return {
    did: expectedDid,
    trustStatus: trustStatus as TrustStatus,
    production: typeof raw.production === "boolean" ? raw.production : false,
    evaluatedAt: asString(raw.evaluatedAt) ?? "",
    evaluatedAtBlock: typeof raw.evaluatedAtBlock === "number" ? raw.evaluatedAtBlock : 0,
    credentials: raw.credentials.map(validateCredential).filter((c): c is ResolvedCredential => c !== null),
    dereferenceErrors: Array.isArray(raw.dereferenceErrors) ? raw.dereferenceErrors : [],
    failedCredentials: Array.isArray(raw.failedCredentials) ? raw.failedCredentials : [],
  };
}

// Strictly validates the Q2 payload. `authorized` must be a real boolean and the
// echoed DID + schema must match what we asked, so a string "false" or a mismatched
// echo can never be read as authorization.
export function validateIssuerAuthorization(
  raw: unknown,
  expectedDid: string,
  expectedVtjsc: string
): IssuerAuthorization {
  if (!isObject(raw)) throw new Error("resolver returned a non-object issuer authorization");
  if (typeof raw.authorized !== "boolean") {
    throw new Error(`resolver returned non-boolean authorized: ${JSON.stringify(raw.authorized)}`);
  }
  if (raw.did !== expectedDid || raw.vtjscId !== expectedVtjsc) {
    throw new Error("resolver issuer authorization echo does not match the request");
  }
  return {
    did: expectedDid,
    vtjscId: expectedVtjsc,
    authorized: raw.authorized,
    evaluatedAt: asString(raw.evaluatedAt) ?? "",
  };
}
