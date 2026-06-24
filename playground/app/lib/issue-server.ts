import "server-only";
import { SignJWT, importJWK, generateKeyPair, exportJWK, type JWK } from "jose";

// Public endpoints (no secrets). The issuance flow is the eSignet authorization-code
// flow the Inji Web wallet uses: authorize -> code -> token -> Certify credential.
export const ESIGNET = "https://esignet-vs.mosip.testnet.verana.network";
export const ESIGNET_AUTHORIZE = `${ESIGNET}/authorize`;
export const ESIGNET_TOKEN = `${ESIGNET}/v1/esignet/oauth/v2/token`;
export const ESIGNET_ISSUER = `${ESIGNET}/v1/esignet`;
export const CERTIFY = "https://inji-certify-vs.mosip.testnet.verana.network";
export const CERTIFY_CREDENTIAL = `${CERTIFY}/v1/certify/issuance/credential`;

// eSignet treats this as an OID4VCI credential scope, requested alone (no openid),
// which maps the token's aud to Certify's credential endpoint. generated-code = OTP.
export const SCOPE = "resident_id_vc_ldp";
export const ACR = "mosip:idp:acr:generated-code";
export const CALLBACK_PATH = "/api/issue/callback";

// The dedicated playground OIDC client. The private key is server-only (.env.local),
// never shipped to the browser. Fail fast if it is not configured.
export function clientConfig() {
  const clientId = process.env.PLAYGROUND_OIDC_CLIENT_ID;
  const rawJwk = process.env.PLAYGROUND_OIDC_PRIVATE_JWK;
  if (!clientId || !rawJwk) {
    throw new Error("PLAYGROUND_OIDC_CLIENT_ID / PLAYGROUND_OIDC_PRIVATE_JWK not set (see .env.local)");
  }
  let jwk: JWK;
  try {
    jwk = JSON.parse(rawJwk) as JWK;
  } catch {
    throw new Error("PLAYGROUND_OIDC_PRIVATE_JWK is not valid JSON (see .env.local)");
  }
  if (!jwk.kid) throw new Error("PLAYGROUND_OIDC_PRIVATE_JWK is missing 'kid'");
  return { clientId, jwk };
}

// private_key_jwt client assertion for the token endpoint.
export async function clientAssertion(audience: string): Promise<string> {
  const { clientId, jwk } = clientConfig();
  const key = await importJWK(jwk, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(crypto.randomUUID())
    .sign(key);
}

// OID4VCI holder proof: a fresh ephemeral key bound into the proof JWT header.
export async function proofJwt(cNonce: string | undefined): Promise<string> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  const builder = new SignJWT(cNonce ? { nonce: cNonce } : {})
    .setProtectedHeader({ alg: "ES256", typ: "openid4vci-proof+jwt", jwk })
    .setAudience(CERTIFY)
    .setIssuedAt();
  return builder.sign(privateKey);
}

export const CREDENTIAL_DEFINITION = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/ns/credentials/examples/v2",
    "https://w3id.org/security/suites/ed25519-2020/v1",
  ],
  type: ["VerifiableCredential", "VerifiableTrustCredential", "FoundationalResidentID"],
};

// Short-lived in-memory hand-off of the issued VC from the callback to the page.
// Single instance, demo scope; entries are one-time and expire after 5 minutes.
// Backed by globalThis so the login/callback/result route handlers, which Next
// bundles separately, all share the same map.
type Entry = { vc: unknown; expires: number };
const g = globalThis as unknown as { __issuedVcs?: Map<string, Entry> };
const store = (g.__issuedVcs ??= new Map<string, Entry>());

export function putIssued(vc: unknown): string {
  const id = crypto.randomUUID();
  store.set(id, { vc, expires: Date.now() + 5 * 60_000 });
  return id;
}

export function takeIssued(id: string): unknown | null {
  const e = store.get(id);
  store.delete(id);
  if (!e || e.expires < Date.now()) return null;
  return e.vc;
}
