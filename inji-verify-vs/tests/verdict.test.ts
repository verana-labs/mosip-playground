import { describe, expect, it } from "vitest";
import { buildTrustReport, extractIdentity } from "@/lib/verana/verdict";
import type { ResolverOutcome, TrustResolution } from "@/lib/verana/types";

const ISSUER = "did:web:inji-certify-vs.mosip.testnet.verana.network";
const ORG = "did:webvh:QmUNE:organization-vs.mosip.testnet.verana.network";
const ECOSYSTEM = "did:webvh:QmcTC:ecs-trust-registry.testnet.verana.network";
const SCHEMA = "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json";

const resolution: TrustResolution = {
  did: ISSUER,
  trustStatus: "TRUSTED",
  production: true,
  evaluatedAt: "2026-06-09T19:38:53.851Z",
  evaluatedAtBlock: 3825458,
  credentials: [
    {
      id: ISSUER,
      type: "VerifiableTrustCredential",
      claims: { id: ISSUER, name: "Inji Resident ID Issuer", description: "MOSIP Inji Certify issuer" },
      format: "W3C_VTC",
      result: "VALID",
      ecsType: "ECS-SERVICE",
      issuedBy: ORG,
      presentedBy: ISSUER,
    },
    {
      id: ORG,
      type: "VerifiableTrustCredential",
      claims: { id: ORG, name: "MOSIP Pilot Authority", countryCode: "IN", registryId: "IN-MOSIP-PILOT-001" },
      format: "W3C_VTC",
      result: "VALID",
      ecsType: "ECS-ORG",
      issuedBy: ECOSYSTEM,
      presentedBy: ORG,
    },
  ],
  dereferenceErrors: [],
  failedCredentials: [],
};

const q1Trusted: ResolverOutcome<TrustResolution> = { ok: true, data: resolution };

function q1WithStatus(trustStatus: TrustResolution["trustStatus"]): ResolverOutcome<TrustResolution> {
  return { ok: true, data: { ...resolution, trustStatus } };
}

describe("buildTrustReport", () => {
  it("invalid signature short-circuits to INVALID_CREDENTIAL", () => {
    const r = buildTrustReport({ signatureValid: false, signatureError: "bad proof", issuerDid: ISSUER });
    expect(r.verdict).toBe("INVALID_CREDENTIAL");
    expect(r.signatureError).toBe("bad proof");
    expect(r.trustStatus).toBeUndefined();
  });

  it("resolver 404 means UNTRUSTED, not an error", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: "did:key:z6MkUnknown",
      schemaId: SCHEMA,
      q1: { ok: false, notFound: true },
    });
    expect(r.verdict).toBe("UNTRUSTED");
    expect(r.signatureValid).toBe(true);
  });

  it("resolver network failure is surfaced, never treated as trusted or untrusted", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: { ok: false, error: "timeout" },
    });
    expect(r.verdict).toBe("RESOLVER_UNAVAILABLE");
    expect(r.resolverError).toBe("timeout");
  });

  it("TRUSTED + authorized = TRUSTED_AUTHORIZED with identity", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: q1Trusted,
      q2: { ok: true, data: { did: ISSUER, vtjscId: SCHEMA, authorized: true, evaluatedAt: "now" } },
    });
    expect(r.verdict).toBe("TRUSTED_AUTHORIZED");
    expect(r.authorized).toBe(true);
    expect(r.identity?.organizationName).toBe("MOSIP Pilot Authority");
    expect(r.identity?.serviceName).toBe("Inji Resident ID Issuer");
    expect(r.evaluatedAtBlock).toBe(3825458);
  });

  it("TRUSTED + not authorized = TRUSTED_NOT_AUTHORIZED", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: q1Trusted,
      q2: { ok: true, data: { did: ISSUER, vtjscId: SCHEMA, authorized: false, evaluatedAt: "now" } },
    });
    expect(r.verdict).toBe("TRUSTED_NOT_AUTHORIZED");
    expect(r.authorized).toBe(false);
  });

  it("TRUSTED with no schema reference = TRUSTED_NO_SCHEMA", () => {
    const r = buildTrustReport({ signatureValid: true, issuerDid: ISSUER, q1: q1Trusted });
    expect(r.verdict).toBe("TRUSTED_NO_SCHEMA");
  });

  it("PARTIAL maps to PARTIAL_TRUST and skips the authorization gate", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: q1WithStatus("PARTIAL"),
    });
    expect(r.verdict).toBe("PARTIAL_TRUST");
  });

  it("resolver-side UNTRUSTED status maps to UNTRUSTED", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: q1WithStatus("UNTRUSTED"),
    });
    expect(r.verdict).toBe("UNTRUSTED");
  });

  it("Q2 failure on a trusted issuer is RESOLVER_UNAVAILABLE, not a silent pass", () => {
    const r = buildTrustReport({
      signatureValid: true,
      issuerDid: ISSUER,
      schemaId: SCHEMA,
      q1: q1Trusted,
      q2: { ok: false, error: "HTTP 503" },
    });
    expect(r.verdict).toBe("RESOLVER_UNAVAILABLE");
  });
});

describe("extractIdentity", () => {
  it("ignores non-VALID credentials", () => {
    const tainted: TrustResolution = {
      ...resolution,
      credentials: resolution.credentials.map((c) => ({ ...c, result: "INVALID" })),
    };
    expect(extractIdentity(tainted)).toEqual({});
  });

  it("only takes the service name from the resolved DID itself", () => {
    const foreign: TrustResolution = {
      ...resolution,
      credentials: [{ ...resolution.credentials[0], id: "did:web:someone-else.example" }],
    };
    expect(extractIdentity(foreign).serviceName).toBeUndefined();
  });
});
