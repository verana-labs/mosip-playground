# Phase 2 — Holder Protection (Verify the Verifier)

> Third integration phase of the Verana × MOSIP/Inji partnership.
> Builds on [phase-0-inji-certify-issuer-integration.md](phase-0-inji-certify-issuer-integration.md)
> and [phase-1-inji-verify-trust-check.md](phase-1-inji-verify-trust-check.md).
> See the parent analysis: [verana-mosip-inji-integration-analysis.md](verana-mosip-inji-integration-analysis.md).

## Goal

Protect the **holder**. Before an Inji wallet presents a credential in response to an OpenID4VP
request, it verifies that the **relying party (verifier)** is a Trusted Verifiable Service holding an
active **`VERIFIER`** permission for the requested credential type — and shows the user *who* is
asking and whether they are accountable, **before any data leaves the device**.

This closes the over-asking / unknown-verifier gap that plain OpenID4VP does not address.

## Outcome (definition of done)

When a relying party sends an OpenID4VP request to an Inji wallet:

- the wallet resolves the verifier DID as `TRUSTED` (Trust Question 1), and
- confirms the verifier is an **authorized verifier** of the "Foundational Resident ID Credential"
  VTJSC (Trust Question 3), and
- displays the verifier's organization identity and trust verdict on the consent screen.

An unregistered or unauthorized verifier is clearly flagged, and the user can decline before sharing.

---

## Model

Phase 1 verified the **issuer** (verifier-side). Phase 2 verifies the **verifier** (holder-side),
using the same Verana Trust Resolver — the symmetric half of the trust triangle:

```
OpenID4VP request ──> wallet extracts verifier DID + requested VTJSC ──> Verana Trust Resolver (Q1 + Q3) ──> verifier identity + verdict ──> consent screen ──> present / decline
```

This phase introduces a **new actor**: a relying party registered in Verana as a `VERIFIER`, using
the same Organization-as-trust-anchor pattern as Phase 0.

## Actors & artifacts

| Component | Name / repo | Role |
|---|---|---|
| Relying party (verifier VS) | **Resident Services Portal** | Requests presentations; registered as `VERIFIER` for the schema |
| Verifier Service credential | **Resident Services Verifier** | ECS-SERVICE issued by the Organization to the verifier DID |
| Organization (trust anchor) | **MOSIP Pilot Authority** | Issues the verifier's Service credential; grants the `VERIFIER` permission (from Phase 0) |
| Wallet (holder) | `mosip/inji-wallet`, `mosip/inji-openid4vp` (Kotlin/Swift), `mosip/inji-web` | Receives the request, runs the verifier trust check, gets user consent |
| Verana Trust Resolver | `verana-resolver` (REST) | Answers Q1 (Trusted VS?) and Q3 (authorized verifier for VTJSC?) |

---

## Steps

### 1. Register the verifier (relying party)
Deploy the relying party as a Verifiable Service. The **Organization (MOSIP Pilot Authority) issues
it a Service credential** ("Resident Services Verifier") and grants its DID a **`VERIFIER`**
permission on the "Foundational Resident ID Credential" schema.

> Note: if you fork [2060-io/hologram-verifiable-services](https://github.com/2060-io/hologram-verifiable-services),
> a verifier service can reuse the same Organization/child-service wiring as Phase 0 — this step is mostly configuration.

### 2. Extract the trust inputs from the OpenID4VP request
On receiving a presentation request, the wallet extracts the **verifier DID** and the **requested
credential type / VTJSC** from the OpenID4VP request.

### 3. Query the Verana Trust Resolver
Call the resolver:

- **Q1 — is Trusted VS?** resolve the verifier DID → `trustStatus`.
- **Q3 — authorized verifier?** resolve `(verifier DID, Foundational Resident ID VTJSC)` → authorized
  flag + the `VERIFIER` permission chain up to the MOSIP Pilot Authority.

### 4. Show identity and ask for consent
Render the verifier's organization identity and trust verdict on the consent screen **before** any
attributes are disclosed. The user explicitly approves or declines.

> Note: this likely requires forking `mosip/inji-openid4vp` (Kotlin/Swift) and the wallet UIs
> (`mosip/inji-wallet`, `mosip/inji-web`) to add the resolver call and the verifier-identity consent panel.

### 5. Handle untrusted verifiers
For `UNTRUSTED` / unauthorized verifiers, warn prominently and default to blocking the presentation
(configurable policy).

---

## Validation

- **Trusted path:** trusted, authorized verifier → consent screen shows org identity + green verdict; presentation proceeds on approval.
- **Unknown path:** request from a DID with no Verana registration → `UNTRUSTED` warning; presentation blocked/declined.
- **Wrong-scope path:** verifier authorized for a different VTJSC → Q3 returns not-authorized.

---

## Open questions / risks

- **DID binding in OpenID4VP:** how the verifier DID is conveyed and bound to the request
  `client_id` (signed request objects / `client_id_scheme`); preventing spoofing.
- **Cross-device vs. same-device flows:** where the resolver call runs in each Inji Verify SDK flow.
- **Offline presentations:** trust resolution is online; define fallback/UX for offline verifiers.
- **Latency/UX:** keeping the consent screen responsive while the resolver call completes (caching).
- **Privacy:** ensure the trust check leaks no holder data to the resolver.
