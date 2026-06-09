export interface TrustInputs {
  issuerDid?: string;
  schemaId?: string;
}

interface CredentialSchemaRef {
  id?: unknown;
  type?: unknown;
}

export function extractTrustInputs(credential: Record<string, unknown>): TrustInputs {
  const inputs: TrustInputs = {};

  const issuer = credential.issuer;
  const issuerId =
    typeof issuer === "string"
      ? issuer
      : issuer && typeof issuer === "object"
        ? (issuer as { id?: unknown }).id
        : undefined;
  if (typeof issuerId === "string" && issuerId.startsWith("did:")) {
    inputs.issuerDid = issuerId;
  }

  const raw = credential.credentialSchema;
  const refs: CredentialSchemaRef[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? [raw as CredentialSchemaRef]
      : [];

  // Keep only entries whose id is a real https URL, THEN prefer JsonSchemaCredential.
  // Filtering first means a malformed preferred entry can't mask a valid one.
  const httpsRefs = refs.filter((r) => typeof r.id === "string" && isHttpsUrl(r.id));
  const preferred = httpsRefs.find((r) => r.type === "JsonSchemaCredential") ?? httpsRefs[0];
  if (preferred && typeof preferred.id === "string") {
    inputs.schemaId = preferred.id;
  }

  return inputs;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
