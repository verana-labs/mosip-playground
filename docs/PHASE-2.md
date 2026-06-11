# MOSIP × Verana — Phase 2 (Holder Protection: Verify the Verifier)

Design + plan + state for Phase 2. Spec: `verana-labs/integration-sandbox` →
`mosip/phase-2-holder-verifier-protection.md`. Builds on [PHASE-0](PHASE-0.md) (the issuer, schema
and VTJSC) and [PHASE-1](PHASE-1.md) (the resolver client + add-on pattern).

> Status: **DESIGN — not yet implemented.** This doc is the agreed architecture and the de-risk-first
> build plan. It becomes the implementation/runbook/state doc as we build (same as PHASE-0/1).

## TL;DR

Phase 1 verified the **issuer** (verifier-side). Phase 2 verifies the **verifier** (holder-side): before
an Inji wallet presents a credential over OpenID4VP, it asks the Verana Trust Resolver whether the
**relying party** is a Trusted Verifiable Service (Q1) holding an active **`VERIFIER`** permission for
the requested credential type (Q3), shows *who is asking* and the verdict on the consent screen, and
**defaults to blocking** unknown/over-asking verifiers — before any attribute leaves the wallet.

Same DNA as Phase 1: **official Inji components + a thin Verana add-on**, deployed to
`*.mosip.testnet.verana.network` from `main`. The resolver `verifier-authorization` endpoint is already
live (returns `authorized:false` for the inji-verify DID today — registering the VERIFIER permission
flips it to `true`).

```
RP sends OpenID4VP request ──> inji-web validates it (mimoto resolves verifier DID + verifies signed request)
                                   │  (Verana add-on reads the VALIDATED verifier DID)
                                   ▼
                          Verana Resolver Q1 + Q3 ──> verifier identity + verdict ──> consent screen ──> present / decline
```

## Actors (spec → this implementation)

| Spec actor | Spec name | This implementation |
|---|---|---|
| Relying party (verifier VS) | Resident Services Portal | **official `inji-verify`** driving an OpenID4VP `vp-request` with `client_id_scheme=did`, its `did:web:inji-verify.mosip.testnet.verana.network:v1:verify` registered as a Verana VERIFIER |
| Verifier Service credential | Resident Services Verifier | ECS-SERVICE issued by the org to the inji-verify DID (holder-signed linked-VP in its did.json) |
| Organization (trust anchor) | MOSIP Pilot Authority | `organization-vs` (unchanged from Phase 0) — issues the ECS-SERVICE, grants the `VERIFIER` permission |
| Wallet (holder) | `mosip/inji-web` | official `injistack/inji-web` + `mimoto` + a Verana trust-gate add-on |
| Verana Trust Resolver | `verana-resolver` (REST) | `resolver.testnet.verana.network` **Q1 + Q3** |

## Spec compliance (deep-check vs `phase-2-holder-verifier-protection.md`)

| Spec requirement | This design |
|---|---|
| Wallet resolves verifier DID `TRUSTED` (Q1) | browser-side `GET /v1/trust/resolve?did=` |
| Wallet confirms authorized verifier of the resident-id VTJSC (Q3) | browser-side `GET /v1/trust/verifier-authorization?did=&vtjscId=` |
| Display org identity + verdict on the consent screen, before attributes disclosed | Verana panel in `TrustVerifierModal`, which precedes `CredentialRequestModal` (attribute selection) |
| New actor registered as `VERIFIER`, org-as-anchor pattern | register inji-verify's `did:web`: ECS-SERVICE + `create-perm verifier 241` |
| Step 2: extract verifier DID **+ requested VTJSC from the request** | DID from the validated request; VTJSC derived from `presentation_definition`, pilot-config fallback |
| Step 5: untrusted → warn + **default to blocking** (configurable) | gate the present action on Q1=UNTRUSTED / Q3=not-authorized, policy-configurable |
| Open-q: DID binding / spoofing | check the **mimoto-validated** DID (DID-resolved + signed-request-verified), not the raw URL param |
| Open-q: privacy | only `{verifier DID, vtjscId}` reach the resolver; zero holder PII |
| Open-q: offline / cross-device | online, same-device (browser) only; documented out of scope for the pilot |

## Spec-faithfulness refinements (do not regress these)

1. **Anti-spoofing — gate on the validated DID.** Use `verifierData.id` returned by mimoto *after*
   `authenticateVerifier` resolved the DID and verified the signed request JWT against the DID's key —
   **not** `new URLSearchParams(location.search).get('client_id')`, which is unauthenticated and
   spoofable. The raw param may seed an optimistic pre-render; the verdict must use the validated DID.
2. **Default-block, not just warn.** On Q1=UNTRUSTED or Q3=not-authorized, the present/trust action is
   gated by default (configurable policy), per spec step 5 + the unknown/wrong-scope validation paths.
3. **Derive the VTJSC from the request.** The request's `presentation_definition` carries the schema
   constraint (`$.credentialSchema[*].id`); derive `vtjscId` from it, with the single-schema constant
   `https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json` as fallback.
4. **Privacy.** The trust check is about the *verifier*; only the verifier DID + vtjscId are sent to the
   resolver. No holder credential data leaves the wallet for the trust check.

## Architecture (4 pieces, all k8s namespace `mosip`, deployed from `main`)

1. **eSignet (new) — issuer authorization server.** `mimoto` (inji-web's backend) has **no
   pre-authorized_code path** (only the auth-code flow against an external AS), so the holder can only
   download the resident-id credential via eSignet. Deploy real eSignet + a sample-identity system
   (same spirit as Phase 0's CSV: real component, sample data) as certify's AS. Phase 0 keeps its
   pre-auth path; this adds the auth-code path. **Heaviest piece** — de-risk first (2b).
2. **inji-web + mimoto (new) — the holder wallet.** Official `injistack/inji-web` (frontend) +
   `injistack/mimoto` (backend) + postgres. The Verana trust-gate is an **add-on** (`Dockerfile FROM
   injistack/inji-web` + injected `verana-vp-gate.js` + appended `.env`, exactly like inji-verify-ui).
   Wallet login is **Google OAuth2** (the only login in the official image — needs a real Google OAuth
   client + redirect URIs).
3. **inji-verify (reuse, deployed) — the relying party.** Drive its `vp-request` with
   `client_id_scheme=did`; serve the ECS-SERVICE linked-VP in its did.json so Q1 passes. 1-line patch
   to verify-service to emit `client_id_scheme:"did"` (or confirm inji-openid4vp's `did:`-prefix
   inference is active in the bundled version).
4. **Verana VERIFIER registration (recipe exists).** `verifier-*-vs/scripts/` already do
   ECS-SERVICE + `create-perm verifier <schemaId> <did>`. Schema 241 is `verifier_mode=OPEN`, so it's a
   single direct tx, ~21s to ACTIVE — no VP/grantor flow.

## End-to-end flow

```
inji-verify (RP):  POST /v1/verify/vp-request  ──>  { requestId, request_uri (signed JWT) }
                   build authorize URL: client_id=did:web:inji-verify…:v1:verify, client_id_scheme=did,
                                        request_uri=…/vp-request/{id}, presentation_definition(ldp_vc,
                                        constraints: type=FoundationalResidentID + credentialSchema.id=VTJSC),
                                        response_uri=…/vp-submission/vp-direct-post, nonce, state
inji-web:          /authorize → /user/authorize (VPAuthorizationPage.tsx), wallet unlocked (Google)
                   POST /v1/mimoto/wallets/{id}/presentations { authorizationRequestUrl }
mimoto:            inji-openid4vp.authenticateVerifier → fetch request_uri JWT → resolve did:web key
                                                        → verify JWT sig → extract presentation_definition
                   returns verifier { id: <VALIDATED DID>, name, logo, isTrusted, redirectUri }
Verana add-on:     on verifierData.id (validated DID) + vtjscId(from presentation_definition):
                     GET resolver /v1/trust/resolve?did=…                 (Q1)
                     GET resolver /v1/trust/verifier-authorization?did=…&vtjscId=…  (Q3)   [browser-side, CORS-open]
                   render verdict + org identity into TrustVerifierModal; DEFAULT-BLOCK if untrusted/not-authorized
holder consents:   credential selection (CredentialRequestModal) → mimoto builds + signs the ldp_vp
                   POST vp_token → inji-verify /vp-submission/vp-direct-post → verify-service verifies
```

## Build plan (de-risk first; each step independently real + verifiable)

- **2a — Register the RP as a Verana VERIFIER.** Issue inji-verify's `did:web` an ECS-SERVICE + add the
  linked-VP to its did.json; `create-perm verifier 241 <inji-verify-did>`. **Verify live:** Q1 TRUSTED
  + Q3 flips `authorized:false → true`. Smallest, fully real, no Inji changes. *(Q3 is `false` today.)*
- **2b — Spike eSignet + certify auth-code download.** Stand up eSignet + identity system; wire certify
  to use it as AS; confirm the resident-id credential downloads via the auth-code flow. **Highest-risk
  step** — it gates the whole holder-credential loop and the identity-data alignment (eSignet auth sub
  ↔ certify CSV identifier).
- **2c — Deploy inji-web + mimoto** (official images + postgres) to `*.mosip.testnet` from `main`;
  configure the Google OAuth client; register inji-certify as an issuer in `mimoto-issuers-config.json`;
  download + hold a real resident-id credential end to end.
- **2d — RP request flow.** Drive inji-verify's `vp-request` with `client_id_scheme=did`; confirm
  inji-web parses the request and shows the (un-gated) trust modal with the verifier DID available.
- **2e — Verana trust-gate add-on** in inji-web (`verana-vp-gate.js`): validated-DID Q1+Q3, identity +
  verdict panel, default-block. Fail-closed like the Phase-1 panel.
- **2f — Validate the spec's 3 paths live:** trusted+authorized → green consent, presents on approval ·
  unknown DID → Q1 UNTRUSTED → blocked · wrong-scope → Q3 not-authorized.

## Open risks / known limitations

- **eSignet weight** — adds ~2-4 containers + identity-data setup; the biggest infra cost of Phase 2.
- **Holder VP-envelope binding** — inji-web has no holder `did:web`; the VP proof's `verificationMethod`
  may not be independently resolvable. Orthogonal to Phase 2 (holder-verifies-verifier, not the
  reverse); documented, not blocking.
- **Google OAuth dependency** — the official inji-web wallet requires a real Google OAuth client.
- **`client_id_scheme` patch** — verify whether inji-openid4vp infers `did` from the `did:` prefix in
  the bundled mimoto version; if not, the 1-line verify-service patch is required.
- **Resolver metadata** — the browser-side resolver call exposes the holder's IP + which verifier is
  being checked to the resolver, but no holder credential data. Acceptable for the pilot.

## Config / deploy notes (to fill in as built)

- New workflow(s): `11_deploy-esignet.yml`, `12_deploy-inji-web.yml` (push-trigger on `main`, paths
  `esignet-vs/**` / `inji-web/**`, namespace `mosip`, hosts `*.mosip.testnet.verana.network`).
- `inji-web/` add-on: `Dockerfile` (`FROM injistack/inji-web`) + `public/verana-vp-gate.js` +
  appended `VERANA_RESOLVER_URL` + `VERANA_VTJSC_ID` in the image `.env`.
- VERIFIER registration: reuse `verifier-*-vs/scripts/` logic against the inji-verify `did:web`.
