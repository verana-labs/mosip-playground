import { describe, expect, it } from "vitest";
import { validateIssuerAuthorization, validateTrustResolution } from "@/lib/verana/validate";

const DID = "did:web:inji-certify-vs.mosip.testnet.verana.network";
const SCHEMA = "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json";

const goodResolution = {
  did: DID,
  trustStatus: "TRUSTED",
  production: true,
  evaluatedAt: "2026-06-09T19:38:53.851Z",
  evaluatedAtBlock: 3825458,
  credentials: [],
  dereferenceErrors: [],
  failedCredentials: [],
};

describe("validateTrustResolution", () => {
  it("accepts a well-formed TRUSTED response", () => {
    const r = validateTrustResolution(goodResolution, DID);
    expect(r.trustStatus).toBe("TRUSTED");
  });

  it("rejects an unknown trustStatus (no fail-open)", () => {
    expect(() => validateTrustResolution({ ...goodResolution, trustStatus: "UNKNOWN" }, DID)).toThrow();
  });

  it("rejects a missing trustStatus", () => {
    const { trustStatus: _omit, ...noStatus } = goodResolution;
    void _omit;
    expect(() => validateTrustResolution(noStatus, DID)).toThrow();
  });

  it("rejects a DID that does not match the request (echo spoofing)", () => {
    expect(() => validateTrustResolution({ ...goodResolution, did: "did:web:evil.example" }, DID)).toThrow();
  });

  it("rejects non-array credentials", () => {
    expect(() => validateTrustResolution({ ...goodResolution, credentials: "nope" }, DID)).toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => validateTrustResolution("TRUSTED", DID)).toThrow();
    expect(() => validateTrustResolution(null, DID)).toThrow();
  });
});

describe("validateIssuerAuthorization", () => {
  const good = { did: DID, vtjscId: SCHEMA, authorized: true, evaluatedAt: "now" };

  it("accepts a well-formed authorized response", () => {
    expect(validateIssuerAuthorization(good, DID, SCHEMA).authorized).toBe(true);
  });

  it("rejects a string authorized value (no truthiness coercion)", () => {
    expect(() => validateIssuerAuthorization({ ...good, authorized: "false" }, DID, SCHEMA)).toThrow();
  });

  it("rejects a missing authorized field", () => {
    const { authorized: _omit, ...noAuth } = good;
    void _omit;
    expect(() => validateIssuerAuthorization(noAuth, DID, SCHEMA)).toThrow();
  });

  it("rejects a mismatched DID or schema echo", () => {
    expect(() => validateIssuerAuthorization({ ...good, did: "did:web:other" }, DID, SCHEMA)).toThrow();
    expect(() => validateIssuerAuthorization({ ...good, vtjscId: "https://other" }, DID, SCHEMA)).toThrow();
  });
});
