import { NextResponse } from "next/server";
import { verifyWithMosip } from "@/lib/mosip/verify-service";
import { resolveIssuerAuthorization, resolveTrust } from "@/lib/verana/resolver";
import { buildTrustReport } from "@/lib/verana/verdict";
import { extractTrustInputs } from "@/lib/vc/extract";
import { assertReasonableShape } from "@/lib/vc/structural-guard";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 128_000;

export async function POST(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "credential too large" }, { status: 413 });
  }

  let raw: string;
  let credential: Record<string, unknown>;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "credential too large" }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not a JSON object");
    }
    credential = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "body must be a JSON verifiable credential" }, { status: 400 });
  }

  if (!credential.proof) {
    return NextResponse.json({ error: "credential has no proof" }, { status: 422 });
  }

  try {
    assertReasonableShape(credential);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "credential structure rejected" },
      { status: 422 }
    );
  }

  const { issuerDid, schemaId } = extractTrustInputs(credential);

  // 1. MOSIP Inji Verify (real verify-service): signature + schema + expiry.
  const mosip = await verifyWithMosip(raw);
  if (!mosip.reachable) {
    return NextResponse.json({
      verdict: "VERIFY_SERVICE_UNAVAILABLE",
      signatureValid: false,
      resolverError: mosip.error,
      issuerDid,
      schemaId,
    });
  }

  if (!mosip.signatureValid) {
    return NextResponse.json(
      buildTrustReport({
        signatureValid: false,
        signatureError: mosip.signatureError ?? mosip.error,
        expiryValid: mosip.expiryValid,
        claims: mosip.claims,
        issuerDid,
        schemaId,
      })
    );
  }

  // 2. Verana Trust Network: is the (now cryptographically valid) issuer accredited?
  if (!issuerDid) {
    return NextResponse.json(
      buildTrustReport({
        signatureValid: true,
        expiryValid: mosip.expiryValid,
        claims: mosip.claims,
        issuerDid: undefined,
        schemaId,
        q1: { ok: false, error: "credential has no resolvable issuer DID" },
      })
    );
  }

  const [q1, q2] = await Promise.all([
    resolveTrust(issuerDid),
    schemaId ? resolveIssuerAuthorization(issuerDid, schemaId) : Promise.resolve(undefined),
  ]);

  return NextResponse.json(
    buildTrustReport({
      signatureValid: true,
      expiryValid: mosip.expiryValid,
      claims: mosip.claims,
      issuerDid,
      schemaId,
      q1,
      q2,
    })
  );
}
