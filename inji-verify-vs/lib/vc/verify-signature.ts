import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import * as vc from "@digitalbazaar/vc";
import { documentLoader } from "./document-loader";

export interface SignatureCheck {
  valid: boolean;
  error?: string;
}

interface VerifyResult {
  verified: boolean;
  error?: { errors?: Error[]; message?: string };
  results?: Array<{ verified: boolean; error?: { message?: string } }>;
}

function firstError(result: VerifyResult): string {
  const nested = result.error?.errors?.map((e) => e.message).filter(Boolean);
  if (nested?.length) return nested.join("; ");
  if (result.error?.message) return result.error.message;
  const perProof = result.results?.find((r) => !r.verified)?.error?.message;
  return perProof ?? "credential verification failed";
}

export async function verifyCredentialSignature(
  credential: Record<string, unknown>
): Promise<SignatureCheck> {
  try {
    const result: VerifyResult = await vc.verifyCredential({
      credential,
      suite: new Ed25519Signature2020(),
      documentLoader,
    });
    if (result.verified) return { valid: true };
    return { valid: false, error: firstError(result) };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
