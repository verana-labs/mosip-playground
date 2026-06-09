import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyWithMosip } from "@/lib/mosip/verify-service";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  ) as unknown as typeof fetch;
}

describe("verifyWithMosip", () => {
  it("maps a successful verify-service response", async () => {
    mockFetch(200, {
      allChecksSuccessful: true,
      schemaAndSignatureCheck: { valid: true, error: null },
      expiryCheck: { valid: true },
      claims: { fullName: "Asha" },
    });
    const r = await verifyWithMosip("{}");
    expect(r).toMatchObject({
      reachable: true,
      signatureValid: true,
      expiryValid: true,
      allChecksSuccessful: true,
    });
    expect(r.claims).toEqual({ fullName: "Asha" });
  });

  it("maps a signature failure with the MOSIP error message", async () => {
    mockFetch(200, {
      allChecksSuccessful: false,
      schemaAndSignatureCheck: {
        valid: false,
        error: { errorCode: "ERR_SIGNATURE_VERIFICATION_FAILED", errorMessage: "Verification Failed" },
      },
      expiryCheck: null,
    });
    const r = await verifyWithMosip("{}");
    expect(r.reachable).toBe(true);
    expect(r.signatureValid).toBe(false);
    expect(r.signatureErrorCode).toBe("ERR_SIGNATURE_VERIFICATION_FAILED");
    expect(r.signatureError).toBe("Verification Failed");
  });

  it("treats an HTTP error as reachable-but-failed (never silently valid)", async () => {
    mockFetch(500, { message: "boom" });
    const r = await verifyWithMosip("{}");
    expect(r.reachable).toBe(true);
    expect(r.signatureValid).toBeUndefined();
    expect(r.error).toContain("HTTP 500");
  });

  it("treats a network error as unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const r = await verifyWithMosip("{}");
    expect(r.reachable).toBe(false);
    expect(r.error).toContain("ECONNREFUSED");
  });
});
