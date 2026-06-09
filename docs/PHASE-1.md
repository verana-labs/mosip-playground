# MOSIP × Verana — Phase 1 (Inji Verify Trust Check)

Implementation + runbook + state for Phase 1. Spec: `verana-labs/integration-sandbox` →
`mosip/phase-1-inji-verify-trust-check.md`. Builds directly on [PHASE-0](PHASE-0.md) — read that
first; the issuer, schema and VTJSC referenced everywhere here were created there.

## TL;DR

Phase 1 turns "the signature is valid" into "the issuer is accredited". The **`inji-verify-vs/`**
service is a standalone trust-check portal (Next.js): paste/upload a credential → it verifies the
Ed25519Signature2020 proof → extracts `issuer` + `credentialSchema.id` → asks the Verana Trust
Resolver **Q1** (is the issuer a Trusted Verifiable Service?) and **Q2** (is it an authorized
ISSUER of this schema?) → renders one combined verdict with the issuer's real-world identity
("Issued by **MOSIP Pilot Authority**, IN — accredited issuer of Foundational Resident ID").

Per the Phase-1 spec, all three validation paths work, plus the failure modes:

| Credential | Signature | Verdict |
|---|---|---|
| issued by the Phase-0 Inji issuer, resident-id VTJSC | valid | `TRUSTED_AUTHORIZED` + org identity |
| self-signed by an unregistered `did:key` | **valid** | `UNTRUSTED` — the headline behavior: cryptographic validity ≠ trust |
| from the Phase-0 issuer but a schema it has no permission for | valid | `TRUSTED_NOT_AUTHORIZED` |
| tampered after signing | invalid | `INVALID_CREDENTIAL` (trust is never evaluated) |
| no `credentialSchema` reference | valid | `TRUSTED_NO_SCHEMA` (Q2 impossible, said explicitly) |
| resolver unreachable | valid | `RESOLVER_UNAVAILABLE` (fails closed, never silently trusted) |

## What this is (and is not)

This is the **functional Phase-1 layer**: the verifier-side trust check, equivalent to what would be
injected into `mosip/vc-verifier` / `mosip/inji-verify` upstream. It is deliberately a single-purpose
tool — paste credential, get verdict. The guided end-to-end showcase UI is a separate thing
(issue #2, the future `playground.mosip.testnet.verana.network`) and should consume/link this
portal rather than duplicate it.

`lib/verana/` (resolver client + verdict mapping) is the portable core: pure logic, no Next.js
imports, unit-tested — this is the module to port into `vc-verifier` (Kotlin) for an upstream
contribution.

## Architecture

```
POST /api/verify  { ...arbitrary VC JSON... }
  │
  ├─ 1. signature  lib/vc/verify-signature.ts   @digitalbazaar/vc + Ed25519Signature2020
  │                lib/vc/document-loader.ts    static JSON-LD contexts + did:web fetch + did:key synth
  ├─ 2. extract    lib/vc/extract.ts            issuer DID + credentialSchema.id (VTJSC URL)
  ├─ 3. resolve    lib/verana/resolver.ts       Q1 /v1/trust/resolve?detail=full · Q2 /v1/trust/issuer-authorization
  └─ 4. verdict    lib/verana/verdict.ts        single Verdict + IssuerIdentity (org name, country, registry id, ecosystem)
```

Resolver semantics learned by probing (handle all three!):
- Q1 unknown DID → **HTTP 404** `{error: "Not Found"}` — means "no trust evaluation", i.e. UNTRUSTED.
- Q2 wrong schema or unknown DID → **HTTP 200** `{authorized: false}`.
- Q1 `detail=full` → `credentials[]` with `ecsType: ECS-SERVICE / ECS-ORG`; the org identity shown in
  the UI comes from the ECS-ORG entry (`claims.name/countryCode/registryId`), the service name from
  the ECS-SERVICE entry whose `id` equals the resolved DID. Only `result: "VALID"` entries are used.

## Non-obvious things learned (read before touching the verifier)

1. **`#fragment` documentLoader framing.** `@digitalbazaar/ed25519-signature-2020` ≥5.4 resolves the
   verification method through `ed25519-multikey`, which asserts the key sub-document carries its own
   suite `@context`. Returning the whole DID document for `did:…#key-1` (as the Phase-0 signing
   script did — it only signed, never verified) fails with `"key" must be a Multikey…`. The loader
   must return the matching `verificationMethod` entry wrapped in the `ed25519-2020/v1` context.
2. **JSON-LD contexts are pinned, not fetched.** The four contexts (credentials/v1, examples/v2,
   ed25519-2020/v1, did/v1) are bundled in `lib/vc/contexts/`; any other remote document except
   `did:web`/`did:key` resolution is refused. Remote `@context` substitution would let an attacker
   change the meaning of signed data; a poisoned context now just fails verification.
3. **Test credentials are config-only to produce.** `scripts/sign-fixtures.mjs` signs exactly what
   Inji Certify's DataProvider template emits per the Phase-0 binding (ldp_vc, JSON-LD,
   `credentialSchema: {id: <VTJSC>, type: JsonSchemaCredential}`, type includes
   `VerifiableTrustCredential`). It needs the issuer key, which is NOT in the repo:
   `KEY_PATH=~/.verana/mosip/inji-certify-vs-key.json npm run fixtures`.
4. **did:web SSRF surface.** The issuer field of an arbitrary credential drives a did:web fetch —
   the main attack surface on this public, unauthenticated endpoint. See the Security section below.

## Runbook

```bash
# local
cd inji-verify-vs && npm install
npm test                      # 18 unit tests (verdict matrix + extraction)
npm run fixtures              # regenerate public/fixtures (needs KEY_PATH, see above)
npm run dev                   # http://localhost:3000

# deploy (workflow #8 — push-triggered on vs/testnet-mosip for inji-verify-vs/**, or manual)
gh workflow run 8_deploy-inji-verify-vs.yml -R verana-labs/mosip-playground --ref vs/testnet-mosip
# → builds veranalabs/inji-verify image → deploys to namespace mosip
# → https://inji-verify.mosip.testnet.verana.network

# validate live (the three spec paths)
BASE=https://inji-verify.mosip.testnet.verana.network
for f in valid-resident-id self-signed wrong-schema tampered; do
  curl -s -X POST "$BASE/api/verify" -H 'content-type: application/json' \
    --data-binary @inji-verify-vs/public/fixtures/$f.json | jq '{f: "'$f'", verdict}'
done
```

Config (env): `VERANA_RESOLVER_URL` (default `https://resolver.testnet.verana.network`),
`VERANA_RESOLVER_TIMEOUT_MS` (10000), `VERANA_RESOLVER_CACHE_TTL_MS` (300000 — resolver itself
caches ~1h against block height; `POST /v1/trust/refresh {did}` busts it after on-chain changes).

## Security

The portal accepts arbitrary, unauthenticated credential JSON, so it was reviewed by an independent
code review (Codex + CodeRabbit) and a security audit before deploy. What that hardened:

- **Fail-closed trust decisions.** The resolver response is runtime-validated
  (`lib/verana/validate.ts`): `trustStatus` must be an exact enum value, `authorized` a real boolean,
  and the echoed `did`/`vtjscId` must match the request — otherwise the verdict becomes
  `RESOLVER_UNAVAILABLE`, never trusted. `buildTrustReport` requires `trustStatus === "TRUSTED"` to
  even reach the authorization gate; everything else is non-trusted. A malformed or spoofed resolver
  payload can no longer mint `TRUSTED_AUTHORIZED`. (This is the bug that mattered most — it would have
  travelled into `vc-verifier` with `lib/verana/`.)
- **SSRF defense in depth** (`lib/vc/document-loader.ts`): https-only, `redirect: "error"`, port must
  be 443, single-label and numeric/hex/octal host literals refused, path-traversal segments rejected,
  and the host is DNS-resolved with every address checked against loopback/private/link-local/CGNAT/
  reserved ranges (this blocks `127.0.0.1`, `169.254.169.254`, `*.svc` cluster names, decimal-IP
  forms, etc. — all verified by `tests/document-loader.test.ts` and live probes). Backed at the
  network layer by a **NetworkPolicy** (workflow #8) restricting egress to TCP/443 to public IPs plus
  DNS — the decisive control, provided the cluster CNI enforces NetworkPolicy.
- **DoS limits:** 128KB body cap (byte-accurate + ingress `proxy-body-size`), a structural pre-check
  capping JSON depth/node-count/proof-count before the unbounded JSON-LD canonicalization
  (`lib/vc/structural-guard.ts`), capped+streamed response reads (`lib/safe-fetch.ts`), and bounded
  LRU+TTL caches with in-flight coalescing (`lib/bounded-cache.ts`) so attacker-keyed DIDs can't grow
  memory without bound.
- **did:key** values are multicodec-validated (Ed25519 `0xed01` + 32 bytes), not just prefix-matched.

Known limitations, acceptable for the testnet pilot, documented for production:
- **No schema-conformance check.** Authorization verifies the issuer is permitted for the schema the
  credential *names*; it does not fetch the VTJSC and validate the claims *against* it. A legitimately
  trusted issuer could sign off-schema claims and still pass. (Not reachable by an external attacker.)
- **DNS rebinding** is not fully closed (validate-then-fetch has no IP pinning); the NetworkPolicy
  egress restriction is the mitigation. Revisit with connection-level IP pinning for production.
- **CPU-bound canonicalization** isn't isolated in a killable worker; the structural pre-check + body
  cap + rate limiting at ingress are the pilot mitigations.
- Crypto/trust-bypass via the credential is closed by `@digitalbazaar/vc` defaults
  (`CredentialIssuancePurpose` binds `issuer` to the verification-method controller; expiry enforced).
  Revocation (`credentialStatus`) is not checked in the demo and fails closed.

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
