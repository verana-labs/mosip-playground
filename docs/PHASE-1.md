# MOSIP × Verana — Phase 1 (Inji Verify Trust Check)

Implementation + runbook + state for Phase 1. Spec: `verana-labs/integration-sandbox` →
`mosip/phase-1-inji-verify-trust-check.md`. Builds on [PHASE-0](PHASE-0.md) — the issuer, schema and
VTJSC referenced here were created there.

## TL;DR

Phase 1 turns Inji Verify's "the signature is valid" into "the issuer is **accredited**" — as an
**additive layer on the real MOSIP Inji stack**, reusing the official components unmodified and
wiring Verana on top by hooking the existing API calls. Nothing is reconstructed and nothing is
forked:

- **Verification** is the official `injistack/inji-verify-service:0.18.1` (which embeds
  `mosip/vc-verifier`) — signature, schema, expiry, status.
- **The portal** is the official `injistack/inji-verify-ui:0.18.1` — used as the Docker **base
  image**, with one add-on script layered on top (no source fork).
- **The trust layer** is a small browser add-on (`verana-trust-panel.js`) that hooks the
  verify-service `fetch`, and after Inji Verify confirms the credential, asks the Verana Trust
  Resolver **Q1** (Trusted VS?) + **Q2** (accredited issuer for this VTJSC?) and renders a trust
  panel into the result screen.

```
upload QR → Inji Verify UI → verify-service (vc-verifier: sig/schema/expiry)
                                   │  (add-on hooks this fetch)
                                   ▼
                          Verana Trust Resolver Q1+Q2 → trust panel in the UI
```

| Credential | Inji Verify (MOSIP) | Verana | Panel |
|---|---|---|---|
| Phase-0 issuer, resident-id VTJSC | valid | TRUSTED + accredited | **Accredited issuer — MOSIP Pilot Authority** |
| self-signed `did:key` | **valid** | not on network | **Untrusted issuer** — authentic ≠ legitimate |
| Phase-0 issuer, wrong schema | valid | trusted, not accredited | Trusted service, not accredited for this credential |
| tampered | **invalid** | — | (no panel — Inji Verify rejects it) |

## Spec compliance (Actors & artifacts)

| Spec component | Spec name/repo | This implementation |
|---|---|---|
| Verifier portal | `mosip/inji-verify` | official `inji-verify-ui` image, used as base (add-on layered on) |
| Verifier library | `mosip/vc-verifier` | embedded in the official `verify-service` we deploy |
| Trust resolver client | new module / SDK add-on | `inji-verify-ui/public/verana-trust-panel.js` |
| Verana Trust Resolver | `verana-resolver` (REST) | `resolver.testnet.verana.network` Q1 + Q2 |

This is the spec's "additive layer to existing verifier systems" — the trust panel renders **inside
the official Inji Verify UI** (spec step 4), gated by the presence of the add-on (a feature flag).

## How the add-on works (read before touching it)

`inji-verify-ui/Dockerfile` is `FROM injistack/inji-verify-ui:0.18.1` and does three things: copy
`verana-trust-panel.js` into the web root, `sed`-inject a `<script>` tag into `index.html`, and
append `VERANA_RESOLVER_URL` to the image's `.env` (so it flows into `window._env_` via the image's
own `configure_start.sh`). The script (vanilla JS, no build step):

1. **Hooks `window.fetch`** — when it sees a `POST .../vc-verification`, it captures the request
   (the credential being verified) and the response (`allChecksSuccessful` / `verificationStatus`).
2. **On a successful verification**, extracts the issuer DID + `credentialSchema.id` and calls the
   Verana resolver Q1 (`/v1/trust/resolve?detail=full`) + Q2 (`/v1/trust/issuer-authorization`).
   The resolver is **CORS-open** (`access-control-allow-origin: *`), so this is a direct browser
   call — no proxy, the UI pod never touches the resolver.
3. **Renders** a `#verana-trust-panel` into `#result-section` with the verdict + issuer identity.
   Fail-closed: a 404/malformed/unreachable resolver never yields a trusted verdict.

Non-obvious things:
- **`.env` append needs a leading newline** — the base image's `.env` has no trailing newline, so a
  bare `>>` merges the new key into `DISPLAY_TIMEOUT`. Use `printf '\n...\n'`.
- **Input is QR only.** Inji Verify verifies credentials presented as QR (scan or image upload), not
  raw JSON. Generate a test QR with `@injistack/pixelpass` `generateQRData(<vc json>)` → render with
  `qrcode`. (Decode pairs with `decode`, not `toJson` — `toJson` is the CBOR / Claim-169 path.)
- **The standalone `inji-verify-vs` portal was retired** — it was an earlier, non-spec-faithful
  reconstruction. The official-UI add-on replaces it.

## Architecture (in this repo)

- `verify-service-vs/` — official `verify-service` + ephemeral postgres (workflow #9).
- `inji-verify-ui/` — the add-on: `Dockerfile` (FROM the official UI image) + `public/verana-trust-panel.js` (workflow #10).
- `verify-service` is internal ClusterIP only; the UI's nginx proxies `/v1/verify` → `verify-service:8080`.

## Runbook

```bash
# local — official Inji stack, then the add-on UI against it
cd inji-verify-official/docker-compose && docker compose up -d   # verify-service :8080 + postgres
cd inji-verify-ui && docker build -t inji-verify-ui:dev .
docker run -d --network docker-compose_default -p 3030:8000 inji-verify-ui:dev
# open http://localhost:3030 → Upload QR Code → upload a test QR

# deploy — verify-service first (#9), then the UI add-on (#10)
gh workflow run 9_deploy-verify-service.yml  -R verana-labs/mosip-playground --ref vs/testnet-mosip
gh workflow run 10_deploy-inji-verify-ui.yml -R verana-labs/mosip-playground --ref vs/testnet-mosip
# → https://inji-verify-ui.mosip.testnet.verana.network

# generate test QRs from the fixtures (PixelPass)
#   node -e "import('@injistack/pixelpass').then(async p => { ... generateQRData(vc) ... })"
```

Config (env on the UI deploy): `VERANA_RESOLVER_URL` (default `https://resolver.testnet.verana.network`).

## Deployment status

**DEPLOYED + validated live on testnet (2026-06-10):**

- **Portal:** `https://inji-verify-ui.mosip.testnet.verana.network` — official `inji-verify-ui` +
  Verana add-on (`veranalabs/inji-verify-ui`, workflow #10).
- **verify-service:** official `injistack/inji-verify-service:0.18.1` + postgres, in-cluster
  `verify-service:8080` (workflow #9).
- **Validated in a real browser** (QR upload): trusted credential → "Accredited issuer — MOSIP Pilot
  Authority"; self-signed `did:key` → "Untrusted issuer" (valid signature, not on Verana).

## Resolver semantics (handle all three)

- Q1 unknown DID → **HTTP 404** → "no trust evaluation", i.e. UNTRUSTED.
- Q2 wrong schema / unknown DID → **HTTP 200** `{authorized:false}`.
- Q1 `detail=full` → `credentials[]` with `ecsType: ECS-SERVICE / ECS-ORG`; org identity comes from
  the ECS-ORG entry, service name from the ECS-SERVICE entry whose `id` equals the resolved DID;
  only `result: "VALID"` entries are used.

## Known limitations (testnet pilot)

- The panel reads `organizationName`, `countryCode`, `registryId`, `ecosystem`; the spec also names
  `legalJurisdiction` and `permState` — deferred.
- No offline Claim 169 / PixelPass freshness fallback (spec step 5) — deferred.
- `verify-service` runs with `skipStatusChecks: true` (revocation not checked in the demo).

## Phase 2 starting point

Phase 2 (holder protection) is the **same add-on shape**: hook the wallet/presentation flow, call the
resolver's verifier-authorization (Trust Question 3), surface "is this verifier accountable?" before
presenting. The reusable pieces: the official-stack-plus-add-on pattern, the resolver client, and the
fixture/QR tooling.
