# MOSIP / Inji × Verana, design specs

The design specs for connecting the **MOSIP Inji** verifiable-credential stack (Inji Certify, Inji
Wallet, Inji Verify, OpenID4VCI / OpenID4VP, Claim 169 QR) to the **Verana Trust Network**.

Inji is complete credential plumbing (issue, hold, present, verify) but deliberately leaves the
**trust / governance layer** open. It checks signatures against a "Verifiable Data Registry" but has
no decentralized answer to *"is this issuer accredited, and is this verifier accountable?"*. **That
registry is Verana.** Verana plugs in behind Inji's "Verifiable Data Registry" abstraction as the
VPR, Trust Resolver and Essential Credential Schemas, with no changes to Inji's wire protocols.

> These are the **design specs** (the what and the why). The **as-built implementation, runbooks and
> live state** for each phase live one level up, in [`../PHASE-0.md`](../PHASE-0.md),
> [`../PHASE-1.md`](../PHASE-1.md), [`../PHASE-2.md`](../PHASE-2.md), [`../PHASE-3.md`](../PHASE-3.md).
> Brought in from [`verana-labs/integration-sandbox`](https://github.com/verana-labs/integration-sandbox)
> so everything sits in one repo (see issue #24).

## Start here

- **[verana-mosip-inji-integration-analysis.md](verana-mosip-inji-integration-analysis.md)**, the
  full analysis: how Inji works today, the precise trust gap, where Verana fits, the target
  architecture, the phased roadmap, and source material.

## Phases

- **[Phase 0, Inji Certify Issuer Integration](phase-0-inji-certify-issuer-integration.md)**, make an
  Inji Certify issuer a Verana Verifiable Service and an authorized `ISSUER` for a schema, and have it
  issue credentials that reference that schema's VTJSC. See also the
  [step 5 VTJSC binding note](phase-0-step5-vtjsc-binding.md).
- **[Phase 1, Inji Verify Trust Check](phase-1-inji-verify-trust-check.md)**, Inji Verify calls the
  Verana Trust Resolver after the signature check to display issuer accreditation (additive, no
  protocol changes).
- **[Phase 2, Holder Protection (Verify the Verifier)](phase-2-holder-verifier-protection.md)**, the
  wallet verifies the relying party before presenting, closing the over-asking gap.
- **[Phase 3, Governance & Economics](phase-3-governance-and-economics.md)**, EGF, trust deposits,
  delegated grantors, issuance / verification fees, revocation, multi-ecosystem.

## Pilot naming (used across the phase docs)

- **Organization / trust anchor:** `MOSIP Pilot Authority`
- **Credential schema:** `Foundational Resident ID Credential`
- **Issuer service credential:** `Inji Resident ID Issuer`
- **Verifier (Phase 2):** `Resident Services Portal`
