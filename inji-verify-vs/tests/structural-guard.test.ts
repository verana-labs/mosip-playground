import { describe, expect, it } from "vitest";
import { assertReasonableShape } from "@/lib/vc/structural-guard";

describe("assertReasonableShape", () => {
  it("accepts a normal credential", () => {
    expect(() =>
      assertReasonableShape({
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        credentialSubject: { fullName: "Asha", identifier: "X" },
        proof: { type: "Ed25519Signature2020" },
      })
    ).not.toThrow();
  });

  it("rejects pathological nesting", () => {
    let deep: unknown = {};
    for (let i = 0; i < 40; i++) deep = { nested: deep };
    expect(() => assertReasonableShape(deep)).toThrow(/too deep/);
  });

  it("rejects node-count explosions", () => {
    expect(() => assertReasonableShape({ big: Array.from({ length: 6000 }, (_, i) => i) })).toThrow(
      /too many nodes/
    );
  });

  it("rejects an oversized proof array", () => {
    expect(() =>
      assertReasonableShape({ proof: Array.from({ length: 20 }, () => ({ type: "x" })) })
    ).toThrow(/too many proofs/);
  });
});
