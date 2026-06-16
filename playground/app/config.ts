// All data the showcase needs. The Trust Resolver is queried browser-side
// (its CORS is open), so the verdict widget is fully live, no backend.

export const RESOLVER = "https://resolver.testnet.verana.network/v1/trust";
export const INJI_VERIFY_UI = "https://inji-verify-ui.mosip.testnet.verana.network";
export const INJI_WEB = "https://inji-web.mosip.testnet.verana.network";

export const ECOSYSTEM = {
  name: "MOSIP Pilot Authority",
  did: "did:webvh:QmUNEzd1z2TktGLNhQKYuhNp6ckq4xzetHD5oVdH2YD3PA:organization-vs.mosip.testnet.verana.network",
  trustRegistry: 167,
  schemaId: 241,
  schema: "Foundational Resident ID",
  network: "vna-testnet-1",
  // VTJSC of the resident-id schema — what the resolver keys authorization on
  vtjsc: "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json",
};

// VTJSC for the phase-3 grantor schema (242), served from this repo
const VTJSC_242 =
  "https://raw.githubusercontent.com/verana-labs/mosip-playground/main/docs/phase-3/vtjsc-242.json";

export type SubjectKind = "issuer" | "verifier";

export type Subject = {
  key: string;
  label: string;
  phase: string;
  kind: SubjectKind;
  did: string;
  vtjsc: string;
  blurb: string;
};

// The DIDs visitors can check live against the resolver.
export const SUBJECTS: Subject[] = [
  {
    key: "issuer",
    label: "Inji Certify — the issuer",
    phase: "Phase 0 · 1",
    kind: "issuer",
    did: "did:web:inji-certify-vs.mosip.testnet.verana.network",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "The MOSIP Inji Certify deployment that issues the Foundational Resident ID. Should resolve as a trusted, accredited issuer for this credential.",
  },
  {
    key: "verifier",
    label: "Inji Verify — the relying party",
    phase: "Phase 2",
    kind: "verifier",
    did: "did:web:inji-verify.mosip.testnet.verana.network:v1:verify",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "The verifier a wallet checks before presenting. Should resolve as a trusted, authorized verifier — so the holder knows who is asking.",
  },
  {
    key: "issuer2",
    label: "A second issuer, onboarded by a grantor",
    phase: "Phase 3",
    kind: "issuer",
    did: "did:web:inji-certify-2.mosip.testnet.verana.network",
    vtjsc: VTJSC_242,
    blurb:
      "Accredited by a delegated grantor, with no transaction from the ecosystem root — yet it still resolves as an authorized issuer.",
  },
  {
    key: "untrusted",
    label: "A self-signed / unknown issuer",
    phase: "Counter-example",
    kind: "issuer",
    did: "did:web:not-a-member.example.com",
    vtjsc: ECOSYSTEM.vtjsc,
    blurb:
      "An issuer outside the ecosystem. Its signature may be perfectly valid, but it should resolve as untrusted — authenticity is not legitimacy.",
  },
];
