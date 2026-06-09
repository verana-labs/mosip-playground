const MAX_DEPTH = 32;
const MAX_NODES = 5_000;
const MAX_PROOFS = 8;

// JSON-LD canonicalization runs on the event loop with no internal complexity
// bound, so a deeply nested or node-heavy credential can peg the pod. This is a
// cheap structural gate run BEFORE verification to reject pathological shapes.
export function assertReasonableShape(value: unknown): void {
  let nodes = 0;

  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) throw new Error("credential nesting too deep");
    if (++nodes > MAX_NODES) throw new Error("credential has too many nodes");
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v, depth + 1);
    }
  };

  walk(value, 0);

  const proof = (value as { proof?: unknown }).proof;
  if (Array.isArray(proof) && proof.length > MAX_PROOFS) {
    throw new Error("credential has too many proofs");
  }
}
