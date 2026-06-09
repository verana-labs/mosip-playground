import { parseEnvInt } from "../safe-fetch";

const VERIFY_SERVICE_URL = process.env.VERIFY_SERVICE_URL ?? "http://localhost:8080";
const TIMEOUT_MS = parseEnvInt(process.env.VERIFY_SERVICE_TIMEOUT_MS, 30_000);

export interface MosipVerification {
  reachable: boolean;
  allChecksSuccessful?: boolean;
  signatureValid?: boolean;
  signatureErrorCode?: string;
  signatureError?: string;
  expiryValid?: boolean;
  claims?: Record<string, unknown>;
  error?: string;
}

interface V2Response {
  allChecksSuccessful?: boolean;
  schemaAndSignatureCheck?: { valid?: boolean; error?: { errorCode?: string; errorMessage?: string } | null };
  expiryCheck?: { valid?: boolean } | null;
  claims?: Record<string, unknown>;
}

// Calls MOSIP's real Inji Verify verify-service (POST /v1/verify/v2/vc-verification).
// The verifiableCredential is sent as a raw JSON string, exactly as the service expects.
export async function verifyWithMosip(credentialJson: string): Promise<MosipVerification> {
  try {
    const res = await fetch(`${VERIFY_SERVICE_URL}/v1/verify/v2/vc-verification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verifiableCredential: credentialJson,
        skipStatusChecks: true,
        includeClaims: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { reachable: true, error: `verify-service returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as V2Response;
    const sig = data.schemaAndSignatureCheck;
    return {
      reachable: true,
      allChecksSuccessful: data.allChecksSuccessful,
      signatureValid: sig?.valid === true,
      signatureErrorCode: sig?.error?.errorCode ?? undefined,
      signatureError: sig?.error?.errorMessage ?? undefined,
      expiryValid: data.expiryCheck?.valid,
      claims: data.claims,
    };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}
