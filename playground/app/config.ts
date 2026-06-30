// All data the showcase needs. The Trust Resolver and the chain indexer are
// queried browser-side (their CORS is open), so the page is fully live, no backend.

export const RESOLVER = "https://resolver.testnet.verana.network/v1/trust";
export const INDEXER = "https://idx.testnet.verana.network/verana";
export const VERANA_APP = "https://app.testnet.verana.network";
export const INJI_VERIFY_UI = "https://inji-verify-ui.mosip.testnet.verana.network";
export const INJI_WEB = "https://inji-web.mosip.testnet.verana.network";
export const VISUALIZER = "https://vis.testnet.verana.network";
export const INJI_WALLET_APK =
  "https://github.com/verana-labs/mosip-playground/releases/download/inji-wallet-android/inji-wallet-verana.apk";

export const ECOSYSTEM = {
  name: "MOSIP Pilot Authority",
  did: "did:webvh:QmUNEzd1z2TktGLNhQKYuhNp6ckq4xzetHD5oVdH2YD3PA:organization-vs.mosip.testnet.verana.network",
  host: "https://organization-vs.mosip.testnet.verana.network",
  ecosystemId: 167,
  schemaId: 241,
  schema: "Foundational Resident ID",
  network: "vna-testnet-1",
  // VTJSC of the resident-id schema, what the resolver keys authorization on
  vtjsc: "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json",
};

// Link to this Ecosystem on the Verana frontend
export const ECOSYSTEM_URL = `${VERANA_APP}/tr/${ECOSYSTEM.ecosystemId}`;

export type SubjectKind = "anchor" | "issuer" | "verifier";

// An entity the page resolves live against the chain, inline in the story.
export type Entity = {
  label: string;
  role: string;
  did: string;
  kind: SubjectKind;
  vtjsc?: string;
  veranaUrl?: string; // where to view it on the Verana frontend
  didDocUrl?: string; // its published DID document
};

export const ORG: Entity = {
  label: ECOSYSTEM.name,
  role: "Trust anchor",
  did: ECOSYSTEM.did,
  kind: "anchor",
  veranaUrl: ECOSYSTEM_URL,
};

export const ISSUER: Entity = {
  label: "Inji Certify",
  role: "Accredited issuer",
  did: "did:web:inji-certify-vs.mosip.testnet.verana.network",
  kind: "issuer",
  vtjsc: ECOSYSTEM.vtjsc,
  didDocUrl: "https://inji-certify-vs.mosip.testnet.verana.network/.well-known/did.json",
};

export const VERIFIER: Entity = {
  label: "Inji Verify",
  role: "Authorized verifier",
  did: "did:web:inji-verify.mosip.testnet.verana.network:v1:verify",
  kind: "verifier",
  vtjsc: ECOSYSTEM.vtjsc,
};

export type Subject = Entity & { key: string; phase: string; blurb: string };

// The DIDs visitors can check live against the resolver in the bonus explorer.
export const SUBJECTS: Subject[] = [
  {
    key: "issuer",
    label: "Inji Certify, the issuer",
    role: "issuer",
    phase: "Phase 0 · 1",
    kind: "issuer",
    did: "did:web:inji-certify-vs.mosip.testnet.verana.network",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "The MOSIP Inji Certify deployment that issues the Foundational Resident ID. Should resolve as a trusted, accredited issuer for this credential.",
  },
  {
    key: "verifier",
    label: "Inji Verify, the relying party",
    role: "verifier",
    phase: "Phase 2",
    kind: "verifier",
    did: "did:web:inji-verify.mosip.testnet.verana.network:v1:verify",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "The verifier a wallet checks before presenting. Should resolve as a trusted, authorized verifier, so the holder knows who is asking.",
  },
  {
    key: "untrusted",
    label: "A self-signed / unknown issuer",
    role: "issuer",
    phase: "Counter-example",
    kind: "issuer",
    did: "did:web:not-a-member.example.com",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "An issuer outside the ecosystem. Its signature may be perfectly valid, but it should resolve as untrusted, authenticity is not legitimacy.",
  },
];
