# MOSIP × Verana — Phase 1 (Inji Verify Trust Check)

Implementation + runbook + state for Phase 1. Spec: `verana-labs/integration-sandbox` →
`mosip/phase-1-inji-verify-trust-check.md`. Builds directly on [PHASE-0](PHASE-0.md) — read that
first; the issuer, schema and VTJSC referenced everywhere here were created there.

## TL;DR

Phase 1 turns "the signature is valid" into "the issuer is accredited" — as an **additive layer on
the real MOSIP Inji Verify**, recreating none of its verification. The **`inji-verify-vs/`** portal
(Next.js) delegates verification to MOSIP's official **`verify-service`** (image
`injistack/inji-verify-service:0.18.1`, the same code Inji Verify ships) and then adds the Verana
trust check on top:

1. POST the credential to `verify-service` `/v1/verify/v2/vc-verification` → real MOSIP
   signature + schema + expiry verification.
2. If valid, extract `issuer` + `credentialSchema.id` and ask the Verana Trust Resolver **Q1** (is
   the issuer a Trusted Verifiable Service?) and **Q2** (is it an accredited ISSUER of this schema?).
3. Render one combined verdict with the issuer's real-world identity ("Issued by **MOSIP Pilot
   Authority**, IN — accredited issuer of Foundational Resident ID").

This was an explicit **pivot** (2026-06-10): an earlier build did its own `@digitalbazaar`
verification, but that reconstruction diverged from MOSIP's real verifier. We confirmed the Phase-0
credential verifies cleanly in the real `verify-service`, so Phase 1 now integrates with the official
suite and only owns the trust layer.

| Credential | MOSIP verify-service | Verana | Verdict |
|---|---|---|---|
| Phase-0 issuer, resident-id VTJSC | sig+expiry valid | TRUSTED + accredited | `TRUSTED_AUTHORIZED` + org identity |
| self-signed `did:key` | **valid** | not on network | `UNTRUSTED` — authentic ≠ accredited |
| Phase-0 issuer, schema it has no permission for | valid | trusted, not accredited | `TRUSTED_NOT_AUTHORIZED` |
| tampered after signing | **invalid** (`ERR_SIGNATURE_VERIFICATION_FAILED`) | — | `INVALID_CREDENTIAL` |
| no `credentialSchema` reference | valid | trusted | `TRUSTED_NO_SCHEMA` |
| resolver unreachable | valid | — | `RESOLVER_UNAVAILABLE` (fails closed) |
| verify-service unreachable | — | — | `VERIFY_SERVICE_UNAVAILABLE` (fails closed) |

## What this is (and is not)

This is the **additive Phase-1 trust layer** over the real MOSIP verifier — exactly the "additional
layer to existing verifier systems" the spec describes. The portal owns only orchestration +
trust + UI; **all credential verification is MOSIP's** (`verify-service`, deployed unmodified). The
guided end-to-end showcase UI is a separate thing (issue #2) and should consume this portal.

`lib/verana/` (resolver client + verdict mapping) is the portable trust core: pure logic, no Next.js
imports, unit-tested — the module to port into `vc-verifier` for an upstream contribution.

## Architecture

```
POST /api/verify  { ...arbitrary VC JSON... }
  │
  ├─ 1. verify   lib/mosip/verify-service.ts   → POST verify-service /v1/verify/v2/vc-verification
  │              (real MOSIP: signature + schema + expiry; injistack/inji-verify-service:0.18.1)
  ├─ 2. extract  lib/vc/extract.ts             issuer DID + credentialSchema.id (VTJSC URL)
  ├─ 3. resolve  lib/verana/resolver.ts        Q1 /v1/trust/resolve?detail=full · Q2 /v1/trust/issuer-authorization
  └─ 4. verdict  lib/verana/verdict.ts         single Verdict + IssuerIdentity (org name, country, registry id, ecosystem)
```

Resolver semantics learned by probing (handle all three!):
- Q1 unknown DID → **HTTP 404** `{error: "Not Found"}` — means "no trust evaluation", i.e. UNTRUSTED.
- Q2 wrong schema or unknown DID → **HTTP 200** `{authorized: false}`.
- Q1 `detail=full` → `credentials[]` with `ecsType: ECS-SERVICE / ECS-ORG`; the org identity shown in
  the UI comes from the ECS-ORG entry (`claims.name/countryCode/registryId`), the service name from
  the ECS-SERVICE entry whose `id` equals the resolved DID. Only `result: "VALID"` entries are used.

## Non-obvious things learned (read before touching this)

1. **Verification is MOSIP's, not ours.** The portal does NOT verify signatures — it POSTs the raw VC
   to `verify-service` `/v1/verify/v2/vc-verification` (`{verifiableCredential: <string>,
   skipStatusChecks, includeClaims}`) and reads `{allChecksSuccessful, schemaAndSignatureCheck,
   expiryCheck, claims}`. The standalone `io.mosip:vcverifier-jar:1.2.0` Maven lib behaves
   differently (stricter id rule, did:web `/did.json` not `.well-known`, Ed25519 canonicalization) —
   do NOT use the library as a proxy for the service; test against the real `verify-service`.
2. **Phase-0 credentials verify cleanly in the real service.** The committed fixtures (did:web issuer,
   `@digitalbazaar` Ed25519Signature2020, `urn:uuid` or https id) all pass `verify-service`; tampering
   yields `ERR_SIGNATURE_VERIFICATION_FAILED`. No Phase-0 issuer changes were needed.
3. **Test credentials are config-only to produce.** `scripts/sign-fixtures.mjs` signs what Inji
   Certify's DataProvider template emits (ldp_vc, `credentialSchema: {id: <VTJSC>, type:
   JsonSchemaCredential}`, type includes `VerifiableTrustCredential`). Needs the issuer key, NOT in
   the repo: `KEY_PATH=~/.verana/mosip/inji-certify-vs-key.json npm run fixtures`. (These are dev-only;
   the runtime no longer depends on `@digitalbazaar`.)
4. **Fail-closed both ways.** verify-service unreachable → `VERIFY_SERVICE_UNAVAILABLE`; resolver
   unreachable/malformed → `RESOLVER_UNAVAILABLE`. Neither ever becomes a trusted verdict.

## Runbook

```bash
# local — run the real MOSIP stack, then the portal against it
cd inji-verify-official/docker-compose && docker compose up -d   # verify-service :8080, ui, postgres
cd inji-verify-vs && npm install && npm test                     # 36 unit tests
VERIFY_SERVICE_URL=http://localhost:8080 npm run dev             # portal at http://localhost:3000

# deploy — verify-service first (workflow #9), then the portal (workflow #8)
gh workflow run 9_deploy-verify-service.yml -R verana-labs/mosip-playground --ref vs/testnet-mosip
gh workflow run 8_deploy-inji-verify-vs.yml -R verana-labs/mosip-playground --ref vs/testnet-mosip
# → verify-service (injistack/inji-verify-service:0.18.1) + postgres in-cluster at verify-service:8080
# → portal at https://inji-verify.mosip.testnet.verana.network (VERIFY_SERVICE_URL wired to it)

# validate live
BASE=https://inji-verify.mosip.testnet.verana.network
for f in valid-resident-id self-signed wrong-schema tampered; do
  curl -s -X POST "$BASE/api/verify" -H 'content-type: application/json' \
    --data-binary @inji-verify-vs/public/fixtures/$f.json | jq '{f: "'$f'", verdict}'
done
```

Config (env): `VERIFY_SERVICE_URL` (default `http://localhost:8080`, set to `http://verify-service:8080`
in-cluster), `VERANA_RESOLVER_URL` (default `https://resolver.testnet.verana.network`),
`VERANA_RESOLVER_TIMEOUT_MS` (10000), `VERANA_RESOLVER_CACHE_TTL_MS` (300000).

## Security

The portal accepts arbitrary, unauthenticated credential JSON. After the pivot, the portal no longer
fetches anything attacker-controlled (no more `did:web` resolution in our code — `verify-service`
does that internally, inside the cluster), so the earlier SSRF surface is gone with the deleted
`lib/vc/document-loader.ts`. What remains hardened (from the earlier code review + security audit):

- **Fail-closed trust decisions.** The resolver response is runtime-validated
  (`lib/verana/validate.ts`): `trustStatus` must be an exact enum value, `authorized` a real boolean,
  and the echoed `did`/`vtjscId` must match the request — otherwise the verdict becomes
  `RESOLVER_UNAVAILABLE`, never trusted. `buildTrustReport` requires `trustStatus === "TRUSTED"` to
  reach the authorization gate; everything else is non-trusted. A malformed/spoofed resolver payload
  cannot mint `TRUSTED_AUTHORIZED`. This is the bug that mattered most and it travels with `lib/verana/`.
- **Fail-closed on both backends.** verify-service unreachable → `VERIFY_SERVICE_UNAVAILABLE`; resolver
  unreachable → `RESOLVER_UNAVAILABLE`. A valid signature with no reachable trust check is never trusted.
- **DoS limits:** 128KB body cap (byte-accurate + ingress `proxy-body-size`), a structural pre-check
  capping JSON depth/node-count/proof-count (`lib/vc/structural-guard.ts`), capped response reads
  (`lib/safe-fetch.ts`), and bounded LRU+TTL resolver cache with in-flight coalescing
  (`lib/bounded-cache.ts`).
- **NetworkPolicy egress** (workflow #8): portal egress restricted to DNS + the in-cluster
  `verify-service:8080` + public HTTPS (the Verana resolver); cluster-internal/metadata IPs otherwise
  blocked. `verify-service` itself is internal ClusterIP only (no public ingress).

Known limitations, acceptable for the testnet pilot, documented for production:
- **No schema-conformance check.** Authorization verifies the issuer is accredited for the schema the
  credential *names*; it does not fetch the VTJSC and validate the claims *against* it.
- **verify-service is unmodified MOSIP** (`injistack/inji-verify-service:0.18.1`) with an ephemeral
  postgres; revocation (`credentialStatus`) checks are skipped in the demo (`skipStatusChecks: true`).

## Deployment status

**DEPLOYED + all spec paths validated live on testnet (2026-06-10)** — via workflow #8 (push to
`vs/testnet-mosip`) to the Verana K8s (namespace `mosip`):

- **URL:** `https://inji-verify.mosip.testnet.verana.network` (valid TLS, nginx ingress)
- **Image:** `veranalabs/inji-verify:4a635fd` (commit `4a635fd`)
- **Live validation** (`POST /api/verify`, fixtures in `public/fixtures/`):
  - `valid-resident-id` → `TRUSTED_AUTHORIZED`, org "MOSIP Pilot Authority"
  - `self-signed` (valid sig, unregistered `did:key`) → `UNTRUSTED`
  - `wrong-schema` (trusted issuer, unauthorized schema) → `TRUSTED_NOT_AUTHORIZED`
  - `tampered` → `INVALID_CREDENTIAL`
  - SSRF probe `did:web:169.254.169.254` → refused (`INVALID_CREDENTIAL`, host blocked pre-fetch)

## Phase 2 starting point

Phase 2 = holder protection (`mosip/phase-2-holder-verifier-protection.md`): the wallet verifies the
**verifier** before presenting (resolver Trust Question 3, `/v1/trust/verifier-authorization`-style).
The pieces that carry over: `lib/verana/` (add the Q3 call next to Q2), the documentLoader, and the
fixture-signing recipe. The missing piece from Phase 0 is still live OID4VCI issuance
(Inji Certify + eSignet) — without it, Phase 2's "verifier asks, wallet checks" flow needs the same
hand-signed-credential approach used here.
