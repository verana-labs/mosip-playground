# Phase 0 — Inji Certify Issuer Integration

> First integration phase of the Verana × MOSIP/Inji partnership.
> See the parent analysis: [verana-mosip-inji-integration-analysis.md](verana-mosip-inji-integration-analysis.md).

## Status — verified on testnet (2026-06-05)

Both Phase-0 trust questions pass on the Verana **testnet** Trust Resolver:

- **MOSIP Pilot Authority** org (`did:webvh:Qmd6h2…:77.42.86.24.sslip.io`) → **Q1 TRUSTED** (Trust Registry `166`, schema `240`).
- **Inji issuer** (`did:web:inji.77.42.86.24.sslip.io`) → **Q1 TRUSTED** and **Q2 authorized** for the Foundational Resident ID VTJSC (ISSUER permission `743`).

Notes that bit us: the org must run `vs-agent:v1.9.2` (`:latest`/v1.11.0 emits a `did:webvh` log the testnet resolver rejects with `not_found`), and on a stable always-on host (Caddy auto-TLS) rather than an ephemeral ngrok tunnel. The Inji issuer is a `did:web` carrying the org-issued ECS-SERVICE as a **holder-signed** linked-VP — the resolver rejects an unsigned VP. The VTJSC binding into Inji Certify is **config-only** (a static `credentialSchema` block in the credential config's `vcTemplate`); see [phase-0-step5-vtjsc-binding.md](phase-0-step5-vtjsc-binding.md).

**Open follow-up:** certify's live OID4VCI issuance — needs an eSignet auth server, aligning certify's `data-provider-plugin.did-url` to the Inji DID, and adding certify's signing key to the `did:web` document. The issuer identity and the VTJSC binding are in place; only the live issuance pipeline remains.

## Goal

Make a **MOSIP Inji Certify** issuer a first-class participant in the Verana Trust Network so that:

- the issuer's DID resolves as a **Trusted Verifiable Service**, and
- the issuer holds an active **`ISSUER`** permission for a specific Credential Schema, and
- the credentials it issues **reference that schema's VTJSC**, making them independently trust-resolvable by any Verana-aware verifier.

This is a minimal end-to-end proof on **devnet/testnet**: one ecosystem, one schema, one issuer.

## Outcome (definition of done)

A credential issued by Inji Certify can be passed to the Verana Trust Resolver and returns:

- the issuer DID is `TRUSTED` (Trust Question 1), and
- the issuer DID is an **authorized issuer** for the "Foundational Resident ID Credential" VTJSC
  (Trust Question 2).

---

## Model

This follows the **Organization-as-trust-anchor** pattern demonstrated by the Hologram Verifiable
Services showcase ([vs.hologram.zone](https://vs.hologram.zone/),
[2060-io/hologram-verifiable-services](https://github.com/2060-io/hologram-verifiable-services)):

> A single **Organization** Verifiable Service is the root of trust. It registers with the Verana
> Network as a verified organization, **creates a Trust Registry with a custom credential schema**,
> and **issues Service credentials to child services**. All other services derive their trust from
> this anchor. The Organization has no public-facing chatbot — it runs in the background issuing
> credentials.

For this pilot the **Organization** is `MOSIP Pilot Authority`, and the **child service** is the
Inji Certify issuer.

You can fork the [2060-io/hologram-verifiable-services](https://github.com/2060-io/hologram-verifiable-services)) to automatically configure the Organization/Ecosystem and the credential schema, and then work on deploying an Inji Certify ISSUER.

## Actors & artifacts

| Component | Name | Role |
|---|---|---|
| Organization (trust anchor VS) | **MOSIP Pilot Authority** | Root of trust. Verified org; creates the Trust Registry + schema; issues Service credentials to child services. Deployed with Verana `vs-agent` (cf. Hologram `organization`) |
| Trust Registry + Credential Schema | **Foundational Resident ID Credential** | Custom schema created by the Organization; defines the credential Inji Certify issues; produces the VTJSC |
| Issuer (child VS) | Inji Certify deployment | Receives a Service credential from the Organization; granted `ISSUER` on the schema |
| Issuer Service credential | **Inji Resident ID Issuer** | ECS-SERVICE issued by the Organization to the Inji Certify DID |

---

## Steps

### 1. Deploy the Organization (trust anchor)
Deploy a Verifiable Service with the Verana **`vs-agent`** to act as the trust anchor (same pattern
as the Hologram `organization` service). It:

- registers with the Verana Network as a **verified Organization** → obtains an `ECS-ORG` credential
  **"MOSIP Pilot Authority"**, and
- obtains its own `ECS-SERVICE` credential,
- publishes both in its DID Document as linked-VPs.

The Organization has no public-facing chatbot; it operates in the background as the credential issuer for the ecosystem.

> Note: if you fork the repo above, this step is just configuration.

### 2. Create the Trust Registry + credential schema
Using the Organization, create a **Trust Registry** with a custom credential schema
**"Foundational Resident ID Credential"**. This produces:

- a `CredentialSchema` entry in the VPR (with its `issuerPermManagementMode`, etc.), and
- a **VTJSC** (Verifiable Trust JSON Schema Credential) — the authoritative schema definition — which
  the Organization publishes in its DID Document as a linked-VP.

> Note: if you fork the repo above, this step is just configuration.

### 3. Deploy Inji Certify and issue it a Service credential

Deploy and configure an **Inji Certify** instance as a child service. The **Organization issues it
a Service credential** (`ECS-SERVICE`) named **"Inji Resident ID Issuer"**. The Inji Certify DID now
resolves as a Trusted Verifiable Service that derives its trust from the MOSIP Pilot Authority anchor.

> Note: To be a Verifiable Service, the Inji issuer just need to obtain a Service credential from the Organization above and present it in its DID document as a linked verifiable presentation.


### 4. Grant the issuer an `ISSUER` permission

The Organization adds the Inji Certify DID as an **`ISSUER`** participant of the
**"Foundational Resident ID Credential"** schema. The issuer DID now holds an active `ISSUER`
permission for that schema.

### 5. Wire the VTJSC as the issued credential's schema (investigation)

Determine **how to make Inji Certify reference the "Foundational Resident ID Credential" VTJSC** as the
schema of the credentials it issues (i.e., populate `credentialSchema.id` / the VTJSC binding in
the issued VC). This is the open technical task of Phase 0 — see open questions below.

> Note: that may require forking the Inji Certify repo.
---

## Validation

After step 5, validate end-to-end against the Verana Trust Resolver:

- **Q1 (is Trusted VS?):** resolve the Inji Certify DID → expect `trustStatus: TRUSTED`.
- **Q2 (authorized issuer?):** resolve `(Inji Certify DID, Foundational Resident ID VTJSC)` → expect
  `authorized: true` with an `ISSUER` permission chaining up to the MOSIP Pilot Authority.

---

## Open questions / risks

- **VTJSC binding in Inji Certify (step 5):** Does Inji Certify's schema/credential registry let an
  operator point `credentialSchema.id` at an external VTJSC URL? If not, what plugin/config hook is
  needed (Data Provider plugin vs. VC Issuance plugin)?
- **DID method alignment:** Inji Certify's issuer DID method vs. Verana's expectation of a DID
  Document carrying linked-VP service entries (`did:web` / `did:webvh`). Confirm the issuer can
  publish/serve its DID Document with the Service Credential as a linked-VP.
- **Credential format:** confirm the issued VC format (W3C JSON-LD / SD-JWT) maps cleanly to a
  Verana W3C VTC for trust resolution.
- **Network:** devnet vs. testnet target (Trust Resolver / Indexer endpoints).
