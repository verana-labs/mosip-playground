# Phase 1 — Inji Verify Trust Check

> Second integration phase of the Verana × MOSIP/Inji partnership.
> Builds on [phase-0-inji-certify-issuer-integration.md](phase-0-inji-certify-issuer-integration.md).
> See the parent analysis: [verana-mosip-inji-integration-analysis.md](verana-mosip-inji-integration-analysis.md).

## Goal

Turn Inji Verify's **cryptographic** check ("the signature is valid") into a **governed trust**
check ("the signature is valid **and** the issuer is an accredited, accountable issuer of this
credential type"). After `vc-verifier` validates a credential, Inji Verify queries the Verana
**Trust Resolver** and surfaces the issuer's accreditation and real-world identity.

This phase requires no changes to Inji's wire protocols — it is an **additive layer** on the
verifier, exactly as Inji Verify is designed to be ("an additional layer to existing verifier systems").

## Outcome (definition of done)

When Inji Verify scans/uploads a credential issued in Phase 0:

- the issuer DID resolves as `TRUSTED` (Trust Question 1), and
- the issuer DID is shown as an **authorized issuer** of the "Foundational Resident ID Credential"
  VTJSC (Trust Question 2), and
- the UI displays the issuer's organization identity, e.g. *"Issued by **MOSIP Pilot Authority** —
  accredited issuer of Foundational Resident ID Credential"*.

A self-signed credential from an unregistered DID is flagged **UNTRUSTED** even though its signature
is cryptographically valid.

---

## Model

Phase 0 made the issuer trust-resolvable. Phase 1 makes the **verifier consume** that trust:

```
credential ──> vc-verifier (signature OK) ──> Verana Trust Resolver (Q1 + Q2) ──> trust verdict + issuer identity ──> Inji Verify UI
```

The Verana Trust Resolver is the concrete implementation of Inji's abstract "Verifiable Data
Registry" — instead of a hardcoded trusted-issuer list, Inji Verify asks the network.

## Actors & artifacts

| Component | Name / repo | Role |
|---|---|---|
| Verifier portal | `mosip/inji-verify` | Scans/uploads credentials, renders the trust panel |
| Verifier library | `mosip/vc-verifier` | Validates signature, status, QR (PixelPass/CBOR) |
| Trust resolver client | new module / SDK add-on | Calls the Verana Trust Resolver and maps the response |
| Verana Trust Resolver | `verana-resolver` (REST) | Answers Q1 (Trusted VS?) and Q2 (authorized issuer for VTJSC?) |

---

## Steps

### 1. Extract the trust inputs from the verified credential
After `vc-verifier` confirms the signature, extract the **issuer DID** and the credential's **schema
/ VTJSC reference** (`credentialSchema.id`) from the credential — the binding established in Phase 0.

### 2. Query the Verana Trust Resolver
Call the resolver:

- **Q1 — is Trusted VS?** resolve the issuer DID → `trustStatus`.
- **Q2 — authorized issuer?** resolve `(issuer DID, Foundational Resident ID VTJSC)` → authorized
  flag + the `ISSUER` permission chain up to the MOSIP Pilot Authority.

> Note: this is a thin, read-only HTTP call; the resolver caches deterministically against block height.

### 3. Map the result to a verdict + display metadata
Combine signature + status + trust into a single verdict, and collect the issuer's
`organizationName`, `legalJurisdiction`, ecosystem, and `permState` for display.

### 4. Render the trust panel
Show the verdict in the Inji Verify UI: trusted/accredited issuer with org identity, or a clear
warning for `UNTRUSTED` / `PARTIAL` / unauthorized-for-this-schema.

> Note: this likely requires forking `mosip/inji-verify` (and possibly `mosip/vc-verifier`) to inject
> the resolver call and the trust panel. Keep it behind a feature flag / config toggle.

### 5. Caching and offline (Claim 169)
Cache resolver responses (TTL or block-height keyed). For offline Claim 169 / PixelPass scans, fall
back to last-known trust status with a freshness indicator, and run the full check when back online.

---

## Validation

- **Trusted path:** scan a Phase-0 credential → verdict `TRUSTED` + "authorized issuer", org identity displayed.
- **Untrusted path:** scan a self-signed credential from a DID with no Verana registration →
  signature may be valid but verdict is `UNTRUSTED`.
- **Wrong-schema path:** scan a credential from the Phase-0 issuer but for a different VTJSC →
  Q2 returns not-authorized.

---

## Open questions / risks

- **Injection point:** resolver call in the `vc-verifier` SDK vs. the Inji Verify portal backend vs.
  the React SDK component — which gives the cleanest upstream contribution?
- **Schema reference extraction:** how `credentialSchema.id` / VTJSC is carried for **SD-JWT** and
  **mDoc** credentials (vs. W3C JSON-LD).
- **Resolver endpoint config:** devnet/testnet endpoint, auth (if any), and rate limits.
- **Caching policy:** TTL vs. block-height invalidation; revocation latency tolerance.
- **UX:** how to present `PARTIAL` trust and multi-ecosystem results without confusing operators.
