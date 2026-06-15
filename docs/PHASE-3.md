# MOSIP × Verana — Phase 3 (Governance & Economics)

Design + plan + state for Phase 3. Spec: `verana-labs/integration-sandbox` →
`mosip/phase-3-governance-and-economics.md`. Builds on [PHASE-0](PHASE-0.md) (issuer, schema 241,
VTJSC), [PHASE-1](PHASE-1.md) (resolver client + Inji Verify add-on) and [PHASE-2](PHASE-2.md) (the
holder-side verify-the-verifier gate).

> Status: **3a + 3b DONE on-chain.** Phases 0–2 re-verified this session. EGF v2 live on TR 167 (3a);
> new grantor-mode **schema 242** + ECOSYSTEM **root perm 748** live (3b, fees 0/0/0 per decision).
> Next: **3c** — a grantor accredits a second issuer with no root tx (headline DoD). Each on-chain step
> is gated on a per-tx confirmation (exact command + signing account + effect, dry-run first).
> Irreversible — testnet throwaways only.

## TL;DR

Phases 0–2 proved the trust triangle for **one** hand-managed ecosystem. Phase 3 makes it
**self-governing and economically accountable**: a real **EGF** governs it, a **grantor** accredits a
**second issuer** with no root transaction, schemas carry **fees + trust deposits**, **revocation**
propagates to the resolver (and flips Inji Verify / the wallet), and **slashing** backs the trust
guarantees. Same DNA as before: small, real, on-chain-verifiable steps, local-first, observed through
the Phase-1 (Inji Verify) and Phase-2 (Inji Web gate) surfaces already built.

## Verified baseline (re-checked against the live chain this session, not memory)

`veranad v0.9.4`, chain `vna-testnet-1`, RPC `https://rpc.testnet.verana.network`, FEES `600000uvna`.

| Object | State |
|---|---|
| **TR 167** | controller `mosip-deploy` (`verana1dz8…`); deposit 10 VNA; `active_version=1`; **already has a GF document** (v1, placeholder `verana-labs.github.io/governance-docs/EGF/example.pdf`); language `en` |
| **Schema 241** | `issuer_mode=ECOSYSTEM`, `verifier_mode=OPEN`; deposit 10 VNA; fees 0 |
| **Perm 745** | ECOSYSTEM root, grantee `mosip-deploy`, no fees |
| **Perm 746** | ISSUER, `did:web:inji-certify-vs…`, validator 745, `vp_state=VALIDATED`, no fees |
| **Perm 747** | VERIFIER, `did:web:inji-verify…:v1:verify`, validator 745, no fees |
| **Resolver** | issuer Q1 TRUSTED + Q2 authorized; verifier Q1 TRUSTED + Q3 authorized; `fees:{}` on both |
| **Accounts** (keyring `test`) | `mosip-deploy` 476 VNA · `mosip-pilot-admin` 427 VNA · `mosip-verifier-vs` 999 VNA |

The exact deployed source is tagged `v0.9.4` (`7a42e02`) in the local `verana/` clone — semantics
below are read from that tag, not the `v0.10.1-dev` working HEAD.

## Economic model

**Chain constants (verified live):**

| Param | Value | Meaning |
|---|---|---|
| `td.trust_unit_price` | `1_000_000 uvna` = **1 VNA / trust unit** | fees + deposits are denominated in trust units |
| `td.trust_deposit_rate` | `0.20` | fraction of a paid fee locked as the payer's trust deposit |
| `td.trust_deposit_reclaim_burn_rate` | `0.60` | burned when a trust deposit is reclaimed |
| `td.trust_deposit_max_yield_rate` | `0.15` | cap on deposit yield |
| `tr.trust_registry_trust_deposit` | `10` units | TR creation deposit (already paid) |
| `cs.credential_schema_trust_deposit` | `10` units | schema creation deposit |
| `dd.did_directory_trust_deposit` | `5` units | DID-directory entry deposit |
| `cs.*_validation_validity_period_max_days` | `3650` | max accreditation validity (10y) |
| `perm.validation_term_requested_timeout_days` | `7` | a VP request expires unfulfilled after 7 days |

**Where fees live:** `create-root-perm [schema] [did] [validation-fees] [issuance-fees]
[verification-fees]` sets the base fee schedule on the schema's root perm; issuer perms also take
`--validation-fees` / `--verification-fees`. Root perm 745 has zero fees and there is **no
`update-root-perm`** — so the fee demo (3d) rides the **new** schema's root perm (3b), which we create
anyway because 241's modes are immutable. Fees are `uint` trust units → minimum granularity 1 VNA.

**Proposed pilot economics — ILLUSTRATIVE, TO CONFIRM at 3b** (after reading the perm/td fee-flow +
slashing source and an architect-review consensus pass; numbers chosen to demonstrate the mechanics
without large testnet spend):

| Lever | Proposed | Rationale |
|---|---|---|
| New schema deposit | 10 VNA (fixed) | chain param, not a choice |
| Grantor accreditation validity | 365 days | realistic annual re-accreditation |
| Root `validation-fees` | 5 units | one-time accreditation fee an applicant pays the validator |
| Root `issuance-fees` | 1 unit | per-issuance economic signal |
| Root `verification-fees` | 1 unit | per-verification economic signal |
| Slashing (3f) | exercise once, small amount | prove `slash-perm-td` + `repay-perm-slashed-td` round-trip |

## Roles introduced (spec → this pilot)

| Role | This pilot | Account |
|---|---|---|
| Ecosystem governance authority | MOSIP Pilot Authority (owns EGF, modes, deposits, fees) | `mosip-deploy` (TR controller) |
| Grantor | a regional/sector accreditor on the new schema | new throwaway acct (faucet-funded) |
| Second issuer | a second Inji Certify deployment, accredited by the grantor | new throwaway acct + DID |
| Verifier | unchanged from Phase 2 (`inji-verify`) | `mosip-verifier-vs` |

## Build plan (3a→3g, de-risk first; each step real + on-chain-verifiable, local-first)

### 3a — Real EGF document ✅ DONE (2026-06-15)
TR 167 already carries a placeholder v1 doc, so this **bumps to v2** with a real authored EGF.
- **Signing account: `mosip-deploy`** (TR 167 controller — the keeper rejects any other signer).
- Author a concise pilot EGF (membership, accreditation, revocation, dispute/appeal, data protection,
  governance process, economics) at `docs/egf/mosip-pilot-egf.md`; commit + push to `main` so the raw
  URL is live; compute `sha384` SRI over the exact served bytes.
- `veranad tx tr add-governance-framework-document 167 en <raw-url> sha384-<b64> 2 --from mosip-deploy …`
  (version **must be 2** = maxVersion+1 and > active_version; creates draft v2 + attaches the doc).
- `veranad tx tr increase-active-gf-version 167 --from mosip-deploy …` (activates v2; requires a doc in
  the TR's default language `en`).
- **Verify:** `query tr get-trust-registry 167` → `active_version=2`, new doc URL+digest present.
- Chain stores URL+digest only (no on-chain fetch); clients/resolver fetch it.

### 3b — New schema: grantor-mode + fees ✅ DONE (2026-06-15)
- Reuse the **resident-id JSON** of schema 241 (decision confirmed), new `cs` entry with
  **`issuer-mode=2` (GRANTOR_VALIDATION)**, `verifier-mode` TBD (likely OPEN to keep verifier path
  simple), `--issuer-grantor-validation-validity-period 365`.
- `create-root-perm <newSchema> <ecosystem-DID> <validation-fees> <issuance-fees> <verification-fees>`
  with the confirmed pilot fees → this root perm both anchors the grantor chain (3c) and carries the
  fee schedule (3d). Signing account: `mosip-deploy`.
- A new VTJSC (`schemas-resident-id-grantor-jsc.json`) served from `organization-vs` if the resolver
  authorization queries key on VTJSC id (confirm during build).
- **Verify:** `query cs get-schema <id>` shows modes + validity periods; root perm shows fees.

### 3c — Grantor tier + second issuer (headline DoD)
- Ecosystem root creates a **GRANTOR** perm for the regional accreditor on the new schema.
- The **second issuer** runs `start-perm-vp issuer <grantor-perm-id>` (may request fees via
  `--issuance-fees`/`--validation-fees`), the **grantor** (not the root) runs
  `set-perm-vp-validated <vp-id>`.
- **Verify (the headline):** resolver `issuer-authorization` for the second issuer's DID + new VTJSC
  returns `authorized:true` **with zero transaction signed by `mosip-deploy`**.

### 3d — Fees + permission sessions
- With non-zero fees on the new schema, drive an issuance and a verification that incur the fee /
  consume a `perm-session` (`create-or-update-perm-session`).
- **Verify:** on-chain trust-deposit / fee movement (`query td get-trust-deposit <acct>` before/after),
  and the resolver `fees`/session field is now populated (was `{}`).

### 3e — Revocation latency
- `revoke-perm <issuer-perm>` and measure how fast the resolver flips Q2 → unauthorized and the
  **Inji Verify verdict** + **Inji Web gate** follow.
- Resolver caches resolve verdicts ~1h but **re-evaluates block-driven** (Phase 2 saw a re-eval well
  inside the TTL) — measure the real latency; the Phase-2 gate already avoids over-caching.

### 3f — Trust deposits & slashing
- Inspect the deposits backing each perm; exercise `slash-perm-td <id> <amount>` +
  `repay-perm-slashed-td <id>` once to prove the accountability loop (read the td slashing math at
  `v0.9.4` first; this burns value — small amount, explicit confirm).

### 3g — Multi-ecosystem (optional / stretch)
- A second TR + schema + cross-ecosystem recognition; a credential from ecosystem B resolves under
  cross-ecosystem rules. Treated as stretch unless prioritized.

## Open risks / decisions still pending
- **Economic numbers (3b/3d):** the proposed pilot fees/validity are illustrative — confirm with
  Maxime + architect-review consensus before the fee-bearing `create-root-perm`.
- **Fee flow semantics:** who pays issuance/verification fees (issuer vs holder vs verifier) and how
  the 20% deposit + revenue share move — read `x/perm` + `x/td` at `v0.9.4` before 3d.
- **Grantor perm type string:** confirm the exact `[type]` enum (`issuer_grantor` vs `grantor` …)
  against the binary/source before 3c.
- **VTJSC for the new schema:** confirm whether authorization queries require a distinct VTJSC id and
  whether `organization-vs` must serve it.
- **Second issuer surface:** a full second Inji Certify deployment vs. a lightweight DID that proves
  the accreditation topology — decide at 3c (lean toward lightweight unless an issuing demo is wanted).
- **Slashing (3f):** confirm appetite to actually execute on testnet (burns value) vs. document-only.
- **Mainnet:** out of scope for now; key custody + runbooks deferred.

## Decisions confirmed this session
- **Sequencing:** 3a→3g in order (incremental, de-risk-first).
- **EGF:** author a concise pilot EGF in `mosip-playground`, host via GitHub raw/Pages, attach as v2.
- **Grantor schema:** reuse the resident-id JSON; new schema with grantor-mode + fees (story told by
  permission topology, fewest moving parts).

## Validation results (to fill in as built)

**3a — EGF v2 (2026-06-15).** EGF authored at `docs/egf/mosip-pilot-egf.md`, pushed to `main`,
SHA-pinned URL (commit `0835414`) → `sha384-PP6AbuFetAmv4S6DTXzOVV69+nTZXzsooHyAmifQq/I4dir7cUavg17UnLjnh0yn`
(served bytes byte-identical to local). Both txs signed by `mosip-deploy` (TR 167 controller):
- `add-governance-framework-document 167 en <url> <sri> 2` → tx `706CBCC…`, height 3906812 → GF version 2
  (gfv 197) + doc 198 created (draft, `active_since` zero).
- `increase-active-gf-version 167` → **first attempt out-of-gas** (code 11): default gas limit 200000 <
  226071 needed; reverted (no state change). Retried with `--gas 320000 --fees 1000000uvna` → tx
  `CC1A4F4…`, height 3906832 → `active_version=2`, doc 198 is the active governance framework.

> **Gotcha (carry to all Phase-3 txs):** `increase-active-gf-version` needs ~226k gas, over the 200000
> default. On this testnet `--fees 600000uvna` implies min gas price ≤ 3 uvna/gas, so for any tx above
> the default gas limit use `--gas ~320000 --fees 1000000uvna` (or `--gas auto --gas-adjustment 1.5`
> with a proportionally larger fee). `create-credential-schema` / `create-perm` likely exceed it too —
> dry-run first to read the estimate.

**3b — grantor-mode schema + root perm (2026-06-15).** Both signed by `mosip-deploy` (TR 167 controller):
- `create-credential-schema 167 <inline JSON> 2 1 --issuer-grantor-validation-validity-period {"value":365} --issuer-validation-validity-period {"value":365} --verifier-grantor/verifier/holder {"value":0}` → tx `0510A7A…`, height 3907195 → **schema 242** (`issuer_mode=GRANTOR_VALIDATION`, `verifier_mode=OPEN`, `$id` reinjected to `…/242`, 10 VNA deposit). Reuses schema 241's resident-id JSON verbatim.
- `create-root-perm 242 <eco-webvh-did> 0 0 0 --effective-from <now+30s>` → tx `BB8A94B…`, height 3907207 → **root perm 748** (ECOSYSTEM, grantee `mosip-deploy`, fees 0/0/0, `Deposit=0`). This is the validator the grantor VP chains to in 3c.

> **CLI gotchas (3b, carry forward):** (1) `create-credential-schema [json-schema]` does NOT read a file
> path — autocli passes it literally; pass **inline JSON** (`JSON=$(jq -c . file); …"$JSON"…`). (2) The
> `--*-validation-validity-period` flags take `OptionalUInt32` JSON `{"value":N}`, **not** a bare integer
> (the autocli doc example `365` is wrong); all five are mandatory. (3) `InjectCanonicalID` strips any
> `$id` and reinjects `vpr:verana:<chain>/cs/v1/js/<id>`, so reusing another schema's JSON is safe.
> (4) **Perm `[type]` is kebab-case**: `issuer`, `verifier`, `issuer-grantor`, `verifier-grantor`,
> `ecosystem`, `holder` — all-caps / snake_case / numeric are all REJECTED by the CLI enum parser.
