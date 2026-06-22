# Verana × MOSIP/Inji — Where Verana Fits

> Integration analysis — possible partnership between Verana Trust Network and MOSIP's
> Inji verifiable-credential stack. Prepared June 2, 2026.

## TL;DR

Inji is a complete **credential plumbing** stack (issue → hold → present → verify) built on
OpenID4VCI, OpenID4VP, W3C VC, SD-JWT, mDoc and Claim 169 QR. What it deliberately leaves
open is the **trust/governance layer**: in their own words, verification "involves checking
against a *Verifiable Data Registry* where public keys of issuers are stored." Inji ships the
verifier and the wallet, but **not** the decentralized registry that answers *"is this issuer
accredited to issue this credential, and is this verifier authorized to request it?"*

**That registry is exactly Verana.** Verana plugs in as the **Verifiable Public Registry (VPR)
+ Trust Resolver + Essential Credential Schemas (ECS)** behind Inji's "Verifiable Data Registry"
abstraction — turning Inji's cryptographic verification ("the signature is valid") into
**governed trust verification** ("the signature is valid *and* the issuer is an accredited member
of a recognized trust ecosystem, *and* the relying party requesting your data is itself a trusted,
accountable verifier").

---

## How Inji works today, and the precise gap

| Layer | Inji module(s) | What it does | Trust model today |
|---|---|---|---|
| **Issuance** | `inji-certify`, `mimoto` | OpenID4VCI issuer, plugin-based (Data Provider plugins from Postgres/CSV), signs VCs (JSON-LD, SD-JWT, mDoc) | Issuer key trust is **configured**; no decentralized accreditation of *who may issue what* |
| **Holding** | `inji-wallet` (mobile/web), `inji-vci-client`, `secure-keystore` | Download, store, present credentials | Wallet trusts issuer/verifier via **static config / hardcoded lists** |
| **Presentation** | `inji-openid4vp` (Kotlin/Swift) | OpenID4VP holder side | No standard way for the **holder to verify the verifier** |
| **Verification** | `inji-verify`, `vc-verifier` | Validates signature, status, QR (PixelPass/CBOR, Claim 169) | Checks signature + issuer public key against a **Verifiable Data Registry / trusted-issuer list** |

The gap is consistent across the stack: **cryptographic validity ≠ trust**. A valid signature
from an unknown or unaccredited issuer still verifies. There is no decentralized, governed answer to:

- **Issuer legitimacy** — Is this DID accredited to issue *this schema* under a recognized governance framework?
- **Verifier legitimacy** — Is the relying party requesting a presentation a legitimate, accountable entity? (the holder-protection / over-asking problem)
- **Organizational accountability** — Who is the real-world legal entity behind an issuer/verifier?
- **Schema governance** — Who controls a credential type and who may issue/verify under it?

Verana's `verifiable-trust-spec` + `verifiable-trust-vpr-spec` exist precisely to answer these,
and the `verana-resolver` exposes them as a simple REST API.

---

## Verana's role: the missing trust layer

Verana provides three things Inji lacks:

- **VPR (Verifiable Public Registry)** — a "registry of trust registries": ecosystems, credential
  schemas, and `ISSUER` / `VERIFIER` / `GRANTOR` permissions, with on-chain trust deposits for accountability.
- **ECS (Essential Credential Schemas)** — standardized `ECS-ORG`, `ECS-SERVICE`, `ECS-PERSONA`,
  `ECS-UA` credentials that bind every service/issuer/verifier to an accountable legal or natural entity.
- **Trust Resolver** — a stateless REST service that answers three questions deterministically:
  1. *Is this DID a Trusted Verifiable Service?* (`trustStatus: TRUSTED/PARTIAL/UNTRUSTED`)
  2. *Is this DID an authorized **issuer** for this schema?*
  3. *Is this DID an authorized **verifier** for this schema?*

The Resolver returns the **full permission chain** (issuer → grantor → ecosystem) plus the
real-world org name, jurisdiction, and trust deposit — exactly the metadata Inji Verify and Inji
Wallet would surface to a human.

---

## Concrete integration points (mapped to repos)

### 1. Inji Verify / `vc-verifier` → call the Trust Resolver (highest-value, lowest-effort)
After `vc-verifier` confirms the signature, add a trust check: extract the issuer DID + credential
schema, then call the Verana Resolver's **"authorized issuer for VTJSC"** query. Surface the
returned `organizationName`, `legalJurisdiction`, ecosystem, and `permState` in the Inji Verify UI
("Issued by **California Dept. of Insurance**, accredited under **Global Insurance Trust Network**")
instead of a bare "signature valid."
- **Repos:** `mosip/vc-verifier`, `mosip/inji-verify`
- **Verana:** `verana-resolver` Trust Question 2 (authorized-issuer)
- This is a thin, additive layer — matches Inji Verify's stated design as "an additional layer to existing verifier systems."

### 2. Inji Wallet / `inji-openid4vp` → verify the *verifier* before presenting
When a relying party sends an OpenID4VP request, the wallet calls the Resolver's **"authorized
verifier for VTJSC"** query (Trust Question 3) to confirm the RP holds an active `VERIFIER`
permission and is a Trusted Verifiable Service. Show the user *who* is asking and whether they're
trusted/accountable before any data leaves the device. This closes the holder-protection gap that
pure OpenID4VP does not address.
- **Repos:** `mosip/inji-wallet`, `mosip/inji-openid4vp`, `mosip/inji-openid4vp-ios-swift`, `mosip/inji-web`
- **Verana:** `verana-resolver` Trust Question 3

### 3. Inji Certify → register issuers in the VPR + obtain ECS credentials
An Inji Certify deployment becomes a **first-class Verana issuer**: its operating organization gets
an `ECS-ORG` credential and the issuing service gets an `ECS-SERVICE` credential; the deployment's
DID receives an `ISSUER` permission for each credential schema it issues. This makes every
credential Inji Certify mints **independently trust-resolvable** by any Verana-aware verifier
worldwide — not just ones pre-configured with its public key.
- **Repos:** `mosip/inji-certify`, `mosip/mimoto`
- **Verana:** VPR permission/accreditation flow; ECS issuance

### 4. Credential schema registry → back Inji Certify schemas with Verana `CredentialSchema`
Inji Certify already supports "schema and credential registry management" and "configurable
credential schemas." Map those to Verana `CredentialSchema` entries (with
`issuerPermManagementMode`, governance docs, optional issuance/verification fees). Governance of
*who can issue a given credential type* moves from local config to the decentralized VPR.

### 5. Claim 169 QR / PixelPass offline flow → embed issuer DID for offline trust hinting
The Claim 169 CBOR QR spec is for **offline** verification. Verana trust resolution is online, but
the Resolver caches deterministically against block height. Approach: keep the issuer
DID/permission reference in the credential so that when a Claim-169 QR is scanned **online**, Inji
Verify can still run a full Verana trust check; offline, it falls back to cached/last-known trust
status with a freshness indicator.
- **Repos:** `mosip/inji-verify` (PixelPass), Claim 169 spec

---

## Target architecture

```
            ┌─────────────────────── VERANA (trust + governance layer) ───────────────────────┐
            │   VPR (chain+indexer)   ──>   Trust Resolver (REST)   <──   ECS / Trust Registries │
            └───────▲───────────────────────────▲───────────────────────────────▲──────────────┘
                    │ register issuer/            │ Q2: authorized issuer?         │ Q3: authorized verifier?
                    │ ECS-ORG/ECS-SERVICE         │ Q1: is trusted VS?             │
        ┌───────────┴──────────┐      ┌───────────┴───────────┐        ┌──────────┴───────────┐
        │   INJI CERTIFY        │ VC   │   INJI WALLET          │  VP    │   INJI VERIFY         │
        │  (OpenID4VCI issuer)  ├─────>│  (holder, OpenID4VP)   ├───────>│  (vc-verifier + QR)   │
        │  + mimoto             │      │  + secure-keystore     │        │                       │
        └───────────────────────┘      └────────────────────────┘        └───────────────────────┘
              issues governed VC          verifies the VERIFIER             verifies the ISSUER
                                          before presenting                 after signature check
```

Verana sits **behind Inji's "Verifiable Data Registry" abstraction** — Inji keeps its
standards-based wire protocols unchanged; Verana answers the governance questions at issuance and
verification time.

---

## The Inji Verana Playground

fork [2060-io/hologram-verifiable-services](https://github.com/2060-io/hologram-verifiable-services)) to build The Inji Verana Playground. 

- **Phase 0 — Issuer integration (Inji Certify):** Make an Inji Certify issuer a Verana
  **Verifiable Service** and an **authorized `ISSUER`** for a given Credential Schema, and have it
  issue credentials that reference that schema's VTJSC. One ecosystem, one schema, devnet/testnet.
  See [phase-0-inji-certify-issuer-integration.md](phase-0-inji-certify-issuer-integration.md).
- **Phase 1 — Verifier trust check:** Inji Verify / `vc-verifier` calls the Verana Trust Resolver
  post-signature for issuer accreditation display. No protocol changes.
  See [phase-1-inji-verify-trust-check.md](phase-1-inji-verify-trust-check.md).
- **Phase 2 — Holder protection:** Wallet (`inji-openid4vp`) verifies the verifier before presentation.
  See [phase-2-holder-verifier-protection.md](phase-2-holder-verifier-protection.md).
- **Phase 3 — Governance + economics:** Trust deposits, permission sessions /
  issuance-verification fees, multi-ecosystem trust registries (per-country/per-sector EGFs).
  See [phase-3-governance-and-economics.md](phase-3-governance-and-economics.md).

---

## Standards/technical gaps to resolve

- **DID methods:** Inji leans on `did:web` + certificate/key registries; Verana's spec examples use
  `did:web`/`did:webvh` with **linked-VP** in the DID Document (where ECS credentials are
  published). Need to confirm Inji issuers/verifiers can publish a DID Document with linked-VP
  service entries (or a shim).
- **Credential format:** Verana supports W3C VTC and AnonCreds VTC. Inji is W3C VC / SD-JWT / mDoc.
  SD-JWT ↔ Verana W3C-VTC mapping (and how `credentialSchema.id`/VTJSC resolution works for SD-JWT)
  needs a small design note.
- **VTJSC binding:** Verana requires the credential to reference a VTJSC owned by the ecosystem DID.
  Inji Certify's schema registry must be made to emit that reference.
- **Offline (Claim 169):** trust resolution is inherently online — define the offline fallback /
  freshness UX explicitly.

---

## The one-line pitch for MOSIP

*"Inji proves a credential is **authentic**. Verana proves the issuer is **accredited** and the
verifier is **accountable** — without anyone maintaining hardcoded trusted-issuer lists. We slot in
behind your existing 'Verifiable Data Registry' interface, so your OpenID4VCI/OpenID4VP wire
protocols don't change at all."*

---

## Source material

**MOSIP / Inji**
- Claim 169 QR spec — https://docs.mosip.io/1.2.0/readme/standards-and-specifications/mosip-standards/169-qr-code-specification
- Inji docs — https://docs.inji.io/
- Inji Certify — https://docs.inji.io/inji-certify/overview · https://github.com/mosip/inji-certify
- Inji Mobile Wallet — https://docs.inji.io/inji-wallet/inji-mobile · https://github.com/mosip/inji-wallet
- Inji Web Wallet — https://docs.inji.io/inji-wallet/inji-web · https://github.com/mosip/inji-web
- Inji Verify — https://docs.inji.io/inji-verify/overview · https://github.com/mosip/inji-verify
- VCI Client (Kotlin) — https://github.com/mosip/inji-vci-client
- VCI Client (Swift) — https://github.com/mosip/inji-vci-client-ios-swift
- Secure keystore — https://github.com/mosip/secure-keystore
- OpenID4VP (Swift) — https://github.com/mosip/inji-openid4vp-ios-swift
- OpenID4VP (Kotlin) — https://github.com/mosip/inji-openid4vp
- VC Verifier — https://github.com/mosip/vc-verifier
- Mimoto backend — https://github.com/mosip/mimoto

**Verana**
- Verifiable Trust Spec — https://verana-labs.github.io/verifiable-trust-spec/
- VPR Spec — https://verana-labs.github.io/verifiable-trust-vpr-spec/
- Trust Resolver spec + trust-resolution queries — `verana-resolver/spec.md`, `verana-resolver/trust-resolution.md`
