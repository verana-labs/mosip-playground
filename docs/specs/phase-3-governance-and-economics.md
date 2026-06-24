# Phase 3 — Governance & Economics

> Fourth integration phase of the Verana × MOSIP/Inji partnership.
> Builds on [phase-0-inji-certify-issuer-integration.md](phase-0-inji-certify-issuer-integration.md),
> [phase-1-inji-verify-trust-check.md](phase-1-inji-verify-trust-check.md), and
> [phase-2-holder-verifier-protection.md](phase-2-holder-verifier-protection.md).
> See the parent analysis: [verana-mosip-inji-integration-analysis.md](verana-mosip-inji-integration-analysis.md).

## Goal

Move from a single, hand-managed pilot ecosystem to a **governed, economically accountable,
multi-party trust network** — so that issuers and verifiers can be onboarded at scale, held
accountable via trust deposits, accredited through delegated grantors, and operated across multiple
jurisdictions/sectors under an Ecosystem Governance Framework (EGF).

## Outcome (definition of done)

- A **second issuer** is onboarded via a **grantor** without direct intervention from the ecosystem root.
- **Trust deposits** are posted by ecosystem, grantors, issuers, and verifiers, with a defined
  slashing/accountability policy.
- **Issuance/verification fees** (and permission sessions) are configured and collected.
- **Revocation** of a permission propagates to the Trust Resolver and is reflected in Inji Verify /
  the wallet within the expected latency.
- An **EGF document** governs the ecosystem and is referenced from the schema/registry.

---

## Model

Phases 0–2 proved the trust triangle (issuer ↔ holder ↔ verifier) for **one** ecosystem managed by
hand. Phase 3 makes that ecosystem **self-governing and economically sustainable**, and enables
**multiple** ecosystems / trust registries to coexist and recognize each other.

```
                 Ecosystem Governance Framework (EGF)
                              │
        ┌─────────────── MOSIP Pilot Authority (ecosystem root) ───────────────┐
        │ trust deposit · fees · management mode · revocation                  │
        ▼                       ▼                          ▼
     GRANTORs              ISSUERs                     VERIFIERs
 (delegated accreditation)  (Inji Certify, …)        (relying parties, …)
```

## Roles introduced

| Role | Example | Purpose |
|---|---|---|
| Ecosystem governance authority | **MOSIP Pilot Authority** | Owns the EGF; sets management modes, deposits, fees |
| Grantor | Regional/sector accreditor | Delegated authority to accredit issuers/verifiers under the schema |
| Issuer | Inji Certify deployments | Issue credentials; hold deposits; may pay/collect fees |
| Verifier | Relying parties | Request presentations; hold deposits; may pay verification fees |

---

## Workstreams

### 1. Ecosystem Governance Framework (EGF)
Author an EGF document (rules for membership, accreditation, revocation, dispute, data protection)
and attach it to the ecosystem and schema governance references in the VPR.

### 2. Trust deposits & accountability
Configure trust deposits for the ecosystem, grantors, issuers, and verifiers, and define the
slashing / accountability policy that backs the trust guarantees.

### 3. Permission management modes
Set the schema's `issuerPermManagementMode` / `verifierPermManagementMode` (e.g. `OPEN`,
`GRANTOR`, `ECOSYSTEM`) to control who may self-register vs. who must be accredited.

### 4. Delegated accreditation (grantors)
Introduce a **`GRANTOR`** tier so the ecosystem root can delegate issuer/verifier accreditation
(e.g. a regional authority accredits local Inji Certify issuers) without being in the loop for each one.

### 5. Economics (fees & sessions)
Enable **issuance / verification fees** and **permission sessions**, with revenue share to the
ecosystem and grantors as policy dictates.

### 6. Revocation & lifecycle
Exercise permission revocation, schema versioning, and credential status — and confirm propagation
to the Trust Resolver consumed by Inji Verify (Phase 1) and the wallet (Phase 2).

### 7. Multi-ecosystem & production hardening
Onboard additional issuers/verifiers and, optionally, additional ecosystems (per-country/per-sector
trust registries) with cross-ecosystem recognition. Harden for **testnet → mainnet** (key
management, monitoring, runbooks).

---

## Validation

- **Delegated onboarding:** a grantor accredits a second issuer; the new issuer resolves as an
  authorized issuer **without** a transaction from the ecosystem root.
- **Economics:** an issuance and a verification each incur the configured fee / consume a permission session.
- **Revocation:** revoking an issuer's permission flips Inji Verify's verdict to unauthorized within
  the expected latency.
- **Multi-ecosystem:** a credential from a second ecosystem resolves correctly under cross-ecosystem rules.

---

## Open questions / risks

- **Economic design:** fee levels, deposit sizing, and revenue-share splits that are sustainable
  without deterring adoption.
- **Slashing policy:** what misconduct triggers slashing, and the dispute/appeal process.
- **Governance process:** who can change the EGF, schemas, and management modes, and how.
- **Legal:** mapping the EGF to real-world legal agreements and jurisdictional requirements.
- **Mainnet cutover:** migration of devnet/testnet artifacts, key custody, and operational SLAs.
