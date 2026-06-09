import { describe, expect, it } from "vitest";
import { documentLoader } from "@/lib/vc/document-loader";

describe("documentLoader SSRF guard (did:web)", () => {
  // Every one of these must be refused before any cross-host fetch reaches the
  // network. The exact reason can differ (numeric literal, single-label, private
  // IP after DNS, ENOTFOUND in a non-cluster env) — the security property is that
  // none of them ever loads.
  const blocked = [
    "did:web:127.0.0.1",
    "did:web:169.254.169.254",
    "did:web:2130706433",
    "did:web:localhost",
    "did:web:kubernetes.default.svc",
    "did:web:internal-svc%3A8443",
  ];

  it.each(blocked)("refuses %s", async (did) => {
    await expect(documentLoader(`${did}#key-1`)).rejects.toThrow();
  });

  it("refuses the cloud-metadata IP with an explicit guard message", async () => {
    await expect(documentLoader("did:web:169.254.169.254#k")).rejects.toThrow(/numeric host literal/);
  });

  it("refuses a non-443 did:web port", async () => {
    await expect(documentLoader("did:web:internal-svc%3A8443#k")).rejects.toThrow(/non-443 did:web port/);
  });

  it("rejects path traversal in did:web segments", async () => {
    await expect(documentLoader("did:web:example.com:..:..:secret#k")).rejects.toThrow(
      /invalid path component/
    );
  });

  it("refuses unknown remote contexts (no @context substitution)", async () => {
    await expect(documentLoader("https://evil.example/ctx.json")).rejects.toThrow(/refusing to load/);
  });
});

describe("documentLoader did:key multicodec validation", () => {
  it("accepts a valid Ed25519 did:key", async () => {
    const doc = await documentLoader("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK");
    expect((doc.document as { id: string }).id).toContain("did:key:z6Mk");
  });

  it("rejects a too-short did:key (not 32-byte Ed25519)", async () => {
    await expect(documentLoader("did:key:z6MkBADBADBAD")).rejects.toThrow(/only Ed25519/);
  });
});
