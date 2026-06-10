# MOSIP × Verana — Phase 0 (Inji Certify Issuer Integration)

Handoff doc for this repo's MOSIP work. Audience: the next person/agent (Phase 1+). Spec lives in
`verana-labs/integration-sandbox` → `mosip/phase-0-inji-certify-issuer-integration.md` (+ the
`phase-0-step5-vtjsc-binding.md` design note). This file is the **implementation + runbook + state**.

## TL;DR

Phase 0 makes a **MOSIP Inji Certify issuer** a first-class member of the **Verana Trust Network** so
its credentials are independently *trust-resolvable*. Two questions must pass on the Verana Trust
Resolver:

- **Q1** — the issuer DID resolves as a **TRUSTED** Verifiable Service
- **Q2** — it is an **authorized ISSUER** for the *Foundational Resident ID* schema (the VTJSC)

This was **proven end-to-end on a throwaway VPS** (both the org and the Inji issuer reached `TRUSTED`,
Inji `authorized: true`, VTJSC binding confirmed config-only). This repo re-platforms that proven
result onto the canonical infra: **`mosip-playground` → GitHub Actions → Kubernetes →
`*.mosip.testnet.verana.network`**.

## The trust model (org-as-anchor)

```
MOSIP Pilot Authority (organization-vs)         ← root of trust (a Verana vs-agent)
  • verified Organization (ECS-ORG) + Service (ECS-SERVICE) credentials from the Verana ECS TR
  • owns a Trust Registry + the "Foundational Resident ID" credential schema (→ its VTJSC)
        │ issues an ECS-SERVICE credential to ↓ , and grants it an ISSUER permission on the schema
  Inji Certify issuer (did:web)                  ← the credential issuer being onboarded
        • DID document carries the ECS-SERVICE as a holder-signed LinkedVerifiablePresentation
        • issues "Foundational Resident ID" VCs whose credentialSchema points at the VTJSC
```

A verifier later (Phase 1) takes a credential, extracts `issuer` + `credentialSchema`, and asks the
resolver Q1/Q2 — turning "the signature is valid" into "the issuer is accredited."

## Two non-obvious things we learned (read before touching the issuer)

1. **The issuer's ECS-SERVICE linked-VP must be holder-SIGNED.** The resolver rejects an unsigned VP
   (`"a valid proof must be added"`). For a non-vs-agent issuer (Inji Certify), you control the DID
   document yourself, so you must sign the VP with the issuer key (Ed25519Signature2020,
   `proofPurpose: assertionMethod`). A `@digitalbazaar`-signed proof verifies fine against the Verana
   resolver — cross-impl interop works.
2. **The VTJSC binding into Inji Certify is config-only — no fork.** In DataProvider mode the issued
   VC body is a Velocity template in the `credential_config` DB row; add a static
   `"credentialSchema": { "id": "<VTJSC url>", "type": "JsonSchemaCredential" }` block and the
   `VerifiableTrustCredential` type. Format must be `ldp_vc` (JSON-LD); SD-JWT can't carry this.

## This repo: deploy model

Cloned from `verana-demos`. Each service has `config.env` (identity/schema) + `deployment.yaml`
(Helm values for `vs-agent-chart`, **v1.9.1** — the version the testnet resolver accepts; do NOT use
`:latest`/v1.11.0, it emits a `did:webvh` the resolver rejects). Deployment is **GitHub Actions
`workflow_dispatch`**, run in order (1 org → … → 6 playground).

- **Branch → domain:** the workflow derives `NETWORK`/`VS_NAME` from the branch. `vs/testnet-mosip` →
  `VS_NAME=mosip`, so services land at `<svc>.mosip.testnet.verana.network`. (We dropped the
  `.demos.` segment from the `deployment.yaml` domain pattern to match Fabrice's `*.mosip.testnet.verana.network`.)
- **Secrets** (on this repo): `OVH_KUBECONFIG`, `VS_DEMO_MNEMONIC`, `K8S_NAMESPACE`, Docker Hub creds.
- Workflow #1 is a one-shot Milestone A: deploy agent → get ECS credentials → create Trust Registry + schema.

### What Phase 0 edits / adds here

- **Edited** (Milestone A′, done, on branch `vs/testnet-mosip`):
  - `organization-vs/config.env` → MOSIP Pilot Authority identity + `CUSTOM_SCHEMA_BASE_ID=resident-id`
  - `organization-vs/schema.json` → Foundational Resident ID Credential (required: `fullName`, `dateOfBirth`, `identifier`)
  - all `*/deployment.yaml` → ingress/domain `*.mosip.testnet.verana.network`
- **Adds** (Milestone B′, the Inji issuer — new service, in progress):
  - an Inji Certify deployment (certify + Postgres) in the same namespace (Inji ships a `helm/` chart)
  - its `did:web` document + holder-signed ECS-SERVICE linked-VP, served on a `*.mosip.testnet.verana.network` ingress
  - the on-chain ISSUER permission + the credential-config VTJSC binding

## Runbook (deploy + verify)

```bash
# 1. deploy the org (Milestone A′) — from branch vs/testnet-mosip
gh workflow run 1_deploy-organization-vs.yml -R verana-labs/mosip-playground \
  --ref vs/testnet-mosip -f step=all
gh run watch -R verana-labs/mosip-playground   # ~several minutes

# 2. verify the org is TRUSTED (Q1)
ORG=did:web... # printed in the workflow summary; host organization-vs.mosip.testnet.verana.network
curl -sG https://resolver.testnet.verana.network/v1/trust/resolve \
  --data-urlencode "did=$ORG" --data-urlencode detail=full | jq '.trustStatus'   # → TRUSTED

# 3. (Milestone B′) deploy the Inji issuer, then verify Q1 + Q2
INJI=did:web:inji-certify-vs.mosip.testnet.verana.network   # exact host TBD
VTJSC=https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json
curl -sG https://resolver.testnet.verana.network/v1/trust/resolve --data-urlencode "did=$INJI" | jq '.trustStatus'        # → TRUSTED
curl -sG https://resolver.testnet.verana.network/v1/trust/issuer-authorization \
  --data-urlencode "did=$INJI" --data-urlencode "vtjscId=$VTJSC" | jq '.authorized'   # → true
```

Resolver API: `GET /v1/trust/resolve?did=&detail=full` (Q1), `GET /v1/trust/issuer-authorization?did=&vtjscId=` (Q2),
`POST /v1/trust/refresh {did}` (bust the ~1h cache after a change).

## Deployment status

**Org (Milestone A′): DEPLOYED + TRUSTED on testnet (2026-06-09)** — via workflow #1 from
`vs/testnet-mosip` to the Verana K8s (namespace `mosip`, Helm `vs-agent-chart v1.9.1`, valid TLS):

- **DID:** `did:webvh:QmUNEzd1z2TktGLNhQKYuhNp6ckq4xzetHD5oVdH2YD3PA:organization-vs.mosip.testnet.verana.network`
- **Host:** `https://organization-vs.mosip.testnet.verana.network`
- **Trust Registry `167`**, **schema `241`** (Foundational Resident ID), root permission `745`
- **Q1 → TRUSTED** (2 VerifiableTrustCredentials: ECS-ORG from the Verana ECS TR + self-issued ECS-SERVICE)
- On-chain controller: `verana1dz8zaec3q25xc4rwfu3s02wa53z5d2qcauktzd` — set as the `VS_DEMO_MNEMONIC`
  repo secret; a throwaway funded testnet account, seed **not** committed.

The namespace defaults to `mosip` in the workflow (`CHART_NAMESPACE:-mosip`), so no `K8S_NAMESPACE`
secret is required. The only secret needed for the org deploy is `VS_DEMO_MNEMONIC` (plus the org-level
`OVH_KUBECONFIG` scoped to this repo).

**Inji issuer (Milestone B′): REAL Inji Certify ISSUING + verifiable + TRUSTED on testnet (2026-06-11).**

The static `did:web` stand-in was replaced with the **real MOSIP Inji Certify** (`injistack/inji-certify-with-plugins:0.14.0`)
that actually issues the credential. Full real chain validated end to end:

- **Issue** — real Inji Certify, real OID4VCI Pre-Authorized Code flow (no eSignet, Certify is its own
  authorization server), DataProvider mode with the bundled CSV plugin, real **Ed25519Signature2020**
  signing. Issues the *Foundational Resident ID* VC carrying `credentialSchema` → the Verana VTJSC and
  the `VerifiableTrustCredential` type (the binding is config-only, in the `credential_config` Velocity
  template — no fork).
- **Verify** — the issued VC verifies in the real MOSIP `verify-service` (`allChecksSuccessful: true`),
  its Ed25519 proof checked against the issuer's published `did:web` key.
- **Q1 → TRUSTED**, **Q2 → authorized** for the resident-id VTJSC (ISSUER permission `746`, ACTIVE).

Architecture (`inji-certify-vs/`, workflow #7): real Certify + postgres (both persistent PVCs, so the
signing key is stable) + a tiny nginx serving the `did:web` document. The DID doc carries **two** keys:
the holder-signed-VP key (`#key-1`, keeps the ECS-SERVICE linked-VP valid → Q1 TRUSTED) **and** Certify's
signing key (`#eY-odk…`, verifies issued VCs). Ingress routes `/v1/certify/*` → Certify and
`/.well-known/did.json` + `/vt/*` → nginx.

Issuance flow (test harness at `~/.verana/issue-vc/issue.mjs`): `POST /v1/certify/pre-authorized-data`
`{credential_configuration_id, claims:{identifier}}` → offer → `POST /oauth/token` (pre-auth grant) →
access token → `POST /v1/certify/issuance/credential` with `{format: ldp_vc, credential_definition:
{@context, type}, proof: {jwt}}` → the signed VC. Config + DB init live in `inji-certify-vs/certify/`.

## Known follow-up (not a Phase-0 blocker)

The CSV DataProvider is the sample data source (no real population registry on testnet) — the issuance,
OID4VCI, and signing are all real Certify, exactly as MOSIP's own demos supply sample data. A production
deployment would point the DataProvider at a real registry. (The earlier eSignet requirement was avoided
entirely via the Pre-Authorized Code self-AS flow.)

## Phase 1 starting point

Phase 1 = **Inji Verify trust check** (`mosip/phase-1-inji-verify-trust-check.md`): after a verifier
checks a signature, call the Verana resolver Q2 to display issuer accreditation. It builds directly on
Phase 0 — the schema/VTJSC and the trusted/authorized issuer already exist, so Phase 1 is additive
(no protocol change). Reuse this repo's deploy model for the verifier services
(`verifier-web-vs` / `verifier-chatbot-vs`).
