import { describe, expect, it } from "vitest";
import { extractTrustInputs } from "@/lib/vc/extract";

const SCHEMA = "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json";

describe("extractTrustInputs", () => {
  it("reads a string issuer and an object credentialSchema", () => {
    const r = extractTrustInputs({
      issuer: "did:web:issuer.example",
      credentialSchema: { id: SCHEMA, type: "JsonSchemaCredential" },
    });
    expect(r.issuerDid).toBe("did:web:issuer.example");
    expect(r.schemaId).toBe(SCHEMA);
  });

  it("reads an object issuer ({id})", () => {
    const r = extractTrustInputs({ issuer: { id: "did:key:z6MkTest" } });
    expect(r.issuerDid).toBe("did:key:z6MkTest");
  });

  it("rejects a non-DID issuer", () => {
    const r = extractTrustInputs({ issuer: "https://issuer.example" });
    expect(r.issuerDid).toBeUndefined();
  });

  it("prefers the JsonSchemaCredential entry in an array", () => {
    const r = extractTrustInputs({
      issuer: "did:web:x",
      credentialSchema: [
        { id: "https://other.example/plain.json", type: "JsonSchema" },
        { id: SCHEMA, type: "JsonSchemaCredential" },
      ],
    });
    expect(r.schemaId).toBe(SCHEMA);
  });

  it("falls back to the first entry with an id", () => {
    const r = extractTrustInputs({
      issuer: "did:web:x",
      credentialSchema: [{ type: "JsonSchema" }, { id: "https://other.example/plain.json" }],
    });
    expect(r.schemaId).toBe("https://other.example/plain.json");
  });

  it("refuses non-https schema ids", () => {
    const r = extractTrustInputs({
      issuer: "did:web:x",
      credentialSchema: { id: "http://insecure.example/s.json", type: "JsonSchemaCredential" },
    });
    expect(r.schemaId).toBeUndefined();
  });

  it("handles a credential with neither issuer nor schema", () => {
    expect(extractTrustInputs({})).toEqual({});
  });
});
