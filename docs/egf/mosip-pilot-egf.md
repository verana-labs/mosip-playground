# MOSIP Pilot Authority — Ecosystem Governance Framework

**Ecosystem:** MOSIP Pilot Authority
**Trust network:** Verana Public Registry (Verana Trust Network)
**Chain:** `vna-testnet-1` (testnet pilot)
**Trust Registry:** `167` — `did:webvh:QmUNEzd1z2TktGLNhQKYuhNp6ckq4xzetHD5oVdH2YD3PA:organization-vs.mosip.testnet.verana.network`
**Document version:** 2
**Status:** Pilot / testnet. This framework governs a demonstration ecosystem on a test network. It is
not a production trust framework and creates no binding legal obligation; it exists to exercise and
validate the Verana governance and economic model end-to-end with real MOSIP Inji components.

---

## 1. Purpose and scope

This Ecosystem Governance Framework (EGF) defines the rules under which the MOSIP Pilot Authority
operates its credential ecosystem on the Verana Trust Network: who may participate, how issuers and
verifiers are accredited, what economic commitments back their trust, how credentials are issued,
presented, and revoked, and how the framework itself is changed.

It governs Trust Registry `167` and the credential schemas registered under it — at minimum the
**Foundational Resident ID** schema (`cs` id `241`) and any further schemas the Authority registers
under this registry. It is referenced on-chain as the active governance framework document of Trust
Registry `167` and is resolved alongside trust decisions by the Verana Trust Resolver.

## 2. The ecosystem

| Component | Identity |
|---|---|
| Ecosystem governance authority | MOSIP Pilot Authority |
| Trust Registry | `167`, controller account `verana1dz8zaec3q25xc4rwfu3s02wa53z5d2qcauktzd` |
| Ecosystem root permission | `perm 745` (type `ECOSYSTEM`) on schema `241` |
| Reference schema | `241` — Foundational Resident ID (`issuer` mode `ECOSYSTEM`, `verifier` mode `OPEN`) |
| Trust evaluation | Verana Trust Resolver — `resolve` (is the party a trusted entity), `issuer-authorization`, `verifier-authorization` |

Trust decisions are made by the Verana chain and surfaced through the resolver. A credential consumer
(e.g. MOSIP Inji Verify, or a wallet during presentation) is expected to consult the resolver and to
**fail closed** — treating "untrusted" or "not authorized" as a refusal, never as an allow.

## 3. Roles and responsibilities

- **Ecosystem governance authority (MOSIP Pilot Authority).** Owns this EGF and the Trust Registry.
  Sets permission management modes, fee schedules, and trust-deposit requirements on its schemas;
  appoints grantors; may revoke any permission in its tree; arbitrates disputes.
- **Grantor.** An entity delegated by the Authority to accredit issuers and/or verifiers under a
  schema, so the Authority need not transact for each onboarding. A grantor validates applicants
  against this EGF, may charge a validation fee, and is accountable through its own trust deposit.
- **Issuer.** Issues credentials of a governed schema (e.g. an Inji Certify deployment issuing
  Foundational Resident ID). Holds a trust deposit; may pay or collect issuance fees as the schedule
  dictates; must honour the revocation and status rules below.
- **Verifier.** A relying party that requests presentation of governed credentials. Holds a trust
  deposit; must identify itself to holders and request only the attributes it needs.
- **Holder.** A natural person holding credentials in a wallet. Holders are protected by the
  data-minimisation and consent rules in §8; holders are not required to post a deposit in this pilot.

## 4. Accreditation and permission management modes

Each schema declares, immutably at creation, how its issuers and verifiers are managed:

- **`OPEN`** — any account may self-register a permission for that role directly.
- **`GRANTOR_VALIDATION`** — a permission is granted only after a grantor validates the applicant
  through the on-chain validation process (`start-perm-vp` by the applicant against the grantor's
  permission, then `set-perm-vp-validated` by the grantor).
- **`ECOSYSTEM`** — only the ecosystem authority validates and grants the permission.

Schema `241` uses `ECOSYSTEM` issuer management and `OPEN` verifier management. To demonstrate
**delegated accreditation**, the Authority registers a further schema under `GRANTOR_VALIDATION` issuer
management, appoints a regional/sector grantor, and that grantor accredits a second issuer **without a
transaction from the ecosystem root**. Accreditations are time-bounded: an accreditation is valid for
the validity period configured on the schema (e.g. annual re-accreditation) and lapses if not renewed.

A grantor must, before validating an applicant: verify the applicant's identity and DID control, check
that the applicant meets the eligibility rules of §5, and record the basis for the decision. A grantor
that accredits a non-compliant party is itself accountable under §9.

## 5. Membership and eligibility

Participation is permissioned. To be accredited as an issuer or verifier under this ecosystem an
applicant must: control a resolvable DID; operate the corresponding service (an issuing service for
issuers, a verifying service for verifiers) reachable at that DID; agree to this EGF and to the schema
it operates under; and post the required trust deposit (§6). The Authority and its grantors may decline
or withdraw membership for non-compliance with this framework.

## 6. Economics: trust deposits and fees

Economic commitments are denominated in **trust units** (on this network, one trust unit = one VNA).

- **Trust deposits.** Creating a Trust Registry, a schema, and certain permissions requires locking a
  trust deposit, sized by on-chain parameters (`tr`, `cs`, `td` modules). A portion of every fee a
  participant pays is added to that participant's trust deposit (the `trust_deposit_rate`, currently
  20%). Deposits back the trust guarantees and are the value at risk under §9. Reclaiming a deposit
  burns a fraction of it (`trust_deposit_reclaim_burn_rate`), discouraging churn; deposits may accrue a
  capped yield (`trust_deposit_max_yield_rate`).
- **Fees.** A schema may carry a **validation fee** (paid by an applicant to its validator/grantor at
  accreditation), an **issuance fee**, and a **verification fee**, set on the schema's root permission
  and on individual permissions. The authoritative, current fee schedule for each schema is the value
  published **on-chain**; this document deliberately does not hardcode amounts so that schedules can be
  tuned without amending the framework. Where fees are non-zero, the consuming flow settles them
  on-chain (and, where applicable, consumes a permission session) before the protected action proceeds.

Fee levels, deposit sizing, and any revenue share to the Authority and grantors are set so as to back
accountability without deterring participation, and are reviewed by the Authority under §11.

## 7. Credential lifecycle

- **Issuance.** An accredited issuer issues credentials of a governed schema as standard W3C Verifiable
  Credentials, carrying the schema's credential-schema reference (VTJSC). Issuance must be backed by a
  currently-active issuer permission.
- **Presentation and verification.** A verifier requests presentation over the agreed protocol
  (OpenID4VP in this pilot). Before honouring a request, the holder's wallet and/or the verifier-side
  check consult the resolver for the verifier's authorization (§2). Verification of a credential checks
  the issuer's authorization at evaluation time.
- **Revocation and status.** The Authority, a grantor (within its delegation), or the chain rules may
  **revoke** a permission. Revocation propagates to the resolver and flips the corresponding
  authorization result; consumers must re-evaluate and must not rely on cached "authorized" verdicts
  beyond their evaluation window. Credential-level status (e.g. status lists) is the issuer's
  responsibility and is independent of permission revocation.

## 8. Holder protection and data minimisation

Holders are protected before any attribute leaves their device:

- A wallet must show the holder **who is requesting** (the verifier's resolved identity) and the trust
  verdict, and must **default to blocking** presentation to an unknown or unauthorized verifier.
- Verifiers must request the **minimum** attributes necessary for their stated purpose; schemas and
  requests should support selective disclosure where available.
- Only the verifier's identity and the requested credential type are sent to the resolver for a trust
  decision — never holder attributes or personal data.

These rules are implemented by the Phase-2 holder gate and the Phase-1 verifier-side check in this
pilot, both of which fail closed.

## 9. Accountability and slashing

A participant that violates this framework — issuing or accrediting outside its mandate, operating a
verifier that over-collects, or otherwise breaching the rules above — may have its trust deposit
**slashed** by the Authority through the chain (`slash-perm-td`), up to the deposit at risk. A slashed
participant may repay to restore standing (`repay-perm-slashed-td`). Slashing is a measure of last
resort, proportionate to the breach, and subject to the dispute process in §10.

## 10. Disputes and appeals

A participant affected by an accreditation refusal, a revocation, or a slashing may dispute it by
notifying the Authority with the relevant facts. The Authority reviews the matter, may consult the
grantor involved, and issues a reasoned decision within a reasonable period. Pending resolution, the
Authority may maintain a precautionary revocation where holder safety or ecosystem integrity is at
risk. In this pilot the process is operated informally by the Authority; a production successor to this
framework would bind it to a formal dispute-resolution and appeal mechanism.

## 11. Amendment and versioning of this framework

This EGF is versioned on-chain as the governance framework of Trust Registry `167`. The Authority (the
registry controller) amends it by publishing a new document version
(`add-governance-framework-document`) and activating it (`increase-active-gf-version`); the active
version is the one resolved with trust decisions. Material changes — to management modes, deposit
requirements, fee schedules, or the accountability rules — are made by the Authority and take effect
when the new version is activated. Only the registry controller may change this framework, the schemas,
and their management modes.

## 12. Data protection

Personal data carried in credentials (e.g. the Foundational Resident ID attributes) is processed by
issuers and holders, not by the trust network: the chain and resolver hold only identifiers,
permissions, schemas, and economic state — never credential subject data. Verifiers must process
disclosed attributes only for their stated purpose and in accordance with applicable law. This pilot
operates on synthetic/mock identities only.

---

*Governed object:* Verana Trust Registry `167`, schema(s) thereunder.
*This document is the active (v2) governance framework document of that registry and is referenced
on-chain with a SHA-384 subresource-integrity digest of its exact published bytes.*
