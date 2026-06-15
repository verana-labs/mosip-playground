<p align="center">
  <img src="docs/assets/mosip-x-verana.png" alt="MOSIP × Verana" width="440">
</p>

<h1 align="center">MOSIP × Verana</h1>

<p align="center"><b>Verifiable trust for MOSIP Inji credentials, on the Verana Trust Network.</b></p>

<p align="center">
  Real MOSIP <a href="https://docs.inji.io/">Inji</a> components, a thin Verana trust layer on top.<br>
  A valid signature proves a credential is <i>authentic</i>. Verana proves the issuer and verifier are <i>legitimate</i>.
</p>

---

## Why this exists

A digitally signed credential tells you the data wasn't tampered with. It does **not** tell you whether the
issuer is a real, accredited authority, or whether the verifier asking for your data is one you should trust.
That gap is where fraud and over-collection live.

This repository wires the **Verana Trust Network** into the **MOSIP Inji** stack so that, at every point in the
credential lifecycle, a participant can ask the chain *"is this party actually trusted, and authorized for this
exact credential?"* and get a fail-closed answer, before anything sensitive is issued, presented, or accepted.

It is built and run as a public pilot on the Verana testnet (`vna-testnet-1`) under a demonstration ecosystem,
the **MOSIP Pilot Authority**.

## The four phases

Each phase is a real, deployed, independently verifiable step. The deep design → runbook → live-state write-up
for each lives in [`docs/`](docs/).

| Phase | What it proves | Built on | Docs |
|---|---|---|---|
| **0 — Issuer** | Inji Certify issues a **Foundational Resident ID** credential under the MOSIP Pilot Authority's trust registry; it resolves as TRUSTED + an authorized issuer. | Inji Certify + eSignet | [PHASE-0](docs/PHASE-0.md) |
| **1 — Verify the issuer** | Inji Verify checks the credential, then a Verana add-on shows *who issued it and whether they're accredited* — fail-closed on untrusted/unauthorized. | Inji Verify (verify-service + UI) | [PHASE-1](docs/PHASE-1.md) |
| **2 — Protect the holder** | Before an Inji Web wallet presents a credential over OpenID4VP, it asks Verana whether the **relying party** is a trusted, authorized verifier, and **blocks** unknown or over-asking verifiers. | Inji Web wallet + eSignet | [PHASE-2](docs/PHASE-2.md) |
| **3 — Governance & economics** | A **grantor** accredits a second issuer with no transaction from the ecosystem root; trust deposits, issuance/verification **fees + permission sessions**, slashing, revocation, an **EGF**, and a **second ecosystem** are all exercised on-chain. | Verana chain (`veranad`) | [PHASE-3](docs/PHASE-3.md) |

The trust triangle the phases close:

```
            issuer  ──issues──▶  holder  ──presents──▶  verifier
              ▲                    ▲                       ▲
        is it accredited?   am I protected?        is it authorized?
        (Phase 0/1)         (Phase 2)              (Phase 2)
                         all governed + accountable (Phase 3)
```

## Architecture: official Inji + a thin Verana add-on

The guiding principle is **integrate, don't fork**. Every MOSIP component runs from its official image,
unmodified. Verana trust is layered on as additive pieces:

- **Browser-side trust widgets** that hook the Inji UI's network calls and render a trust verdict
  (the Inji Verify trust panel, the Inji Web wallet gate), and
- **On-chain registration + a Trust Resolver** the components consult.

```
   MOSIP Pilot Authority  ──  Verana Trust Registry 167  ──  Foundational Resident ID schema (241)
            │                              │
   ┌────────┴─────────┐          Verana Trust Resolver  (resolver.testnet.verana.network)
   ▼                  ▼            Q1 resolve · Q2 issuer-auth · Q3 verifier-auth
 Inji Certify       Inji Verify  ◀── trust panel add-on
 (issuer)           Inji Web     ◀── verify-the-verifier gate add-on
                    eSignet (auth-code AS for wallet download)
```

| Component | Role | Live endpoint |
|---|---|---|
| `organization-vs` | MOSIP Pilot Authority (trust registry, schema, ECS) | `organization-vs.mosip.testnet.verana.network` |
| `inji-certify-vs` | Issuer — Inji Certify | `inji-certify-vs.mosip.testnet.verana.network` |
| `verify-service-vs` | Inji Verify backend + the Verana verifier DID | `inji-verify.mosip.testnet.verana.network` |
| `inji-verify-ui` | Inji Verify UI + Verana trust panel | `inji-verify-ui.mosip.testnet.verana.network` |
| `esignet-vs` | eSignet (OIDC AS for the wallet download flow) | `esignet-vs.mosip.testnet.verana.network` · UI `esignet-ui-vs…` |
| `inji-web-vs` | Inji Web wallet + the `verana-vp-gate` add-on | runs locally (see [PHASE-2](docs/PHASE-2.md)) |
| Verana Trust Resolver | Trust evaluation consumed by the above | `resolver.testnet.verana.network/v1/trust` |

The Trust Resolver answers three questions, and the integration **fails closed** on all of them:

- **Q1 `resolve`** — is this DID a trusted entity in the network?
- **Q2 `issuer-authorization`** — is this issuer authorized for this exact credential type?
- **Q3 `verifier-authorization`** — is this verifier authorized to request it?

## See it working

No setup required, these are live:

- **Verify a credential:** open [inji-verify-ui.mosip.testnet.verana.network](https://inji-verify-ui.mosip.testnet.verana.network),
  scan/upload a Resident ID QR, and watch the **MOSIP Inji Verify** result appear alongside the **Verana Trust
  Network** panel (accredited issuer vs. "valid signature, untrusted issuer").
- **Ask the resolver yourself:**

  ```bash
  curl -sG https://resolver.testnet.verana.network/v1/trust/issuer-authorization \
    --data-urlencode 'did=did:web:inji-certify-vs.mosip.testnet.verana.network' \
    --data-urlencode 'vtjscId=https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json'
  # -> {"authorized": true, ...}
  ```

- **The holder-protection wallet gate** (Phase 2) is demonstrated in a local Inji Web wallet; the full
  walk-through is in [PHASE-2](docs/PHASE-2.md).

## Repository layout

```
organization-vs/      MOSIP Pilot Authority: trust registry, schema, ECS credentials
inji-certify-vs/      Phase 0 — Inji Certify issuer (config + deploy)
verify-service-vs/    Phase 1 — Inji Verify backend + the verifier did:web edge
inji-verify-ui/       Phase 1 — Inji Verify UI + public/verana-trust-panel.js add-on
esignet-vs/           Phase 2 — eSignet (OIDC AS) + mock identities + wallet client
inji-web-vs/          Phase 2 — Inji Web wallet image + public/verana-vp-gate.js add-on
common/               Shared shell helpers (network config, veranad, VS Agent API)
docs/                 PHASE-0..3 design/runbook/state + this README's assets
```

> This repo is forked from [`verana-demos`](https://github.com/hologram-verifiable-services/verana-demos).
> The inherited AnonCreds services (`issuer-chatbot-vs`, `issuer-web-vs`, `verifier-chatbot-vs`,
> `verifier-web-vs`, `playground/`) are the upstream base and are **not** part of the MOSIP integration;
> `playground/` is the seed for the hosted showcase UI ([issue #2](https://github.com/verana-labs/mosip-playground/issues/2)).

## Deploy

Deployment is **push-to-`main`, path-filtered per service** (GitHub Actions → OVH Kubernetes, namespace
`mosip`). Editing a service's directory and pushing redeploys only that service.

| Workflow | Service | Trigger path |
|---|---|---|
| `1_deploy-organization-vs` | MOSIP Pilot Authority | `workflow_dispatch` (bootstrap) |
| `7_deploy-inji-certify-vs` | Inji Certify | `inji-certify-vs/**` |
| `9_deploy-verify-service` | Inji Verify backend | `verify-service-vs/**` |
| `10_deploy-inji-verify-ui` | Inji Verify UI | `inji-verify-ui/**` |
| `11_deploy-esignet-vs` | eSignet | `esignet-vs/**` |

(Workflows `2`–`6` belong to the inherited verana-demos base.)

## Status & known limitations

Phases **0–3 are complete and validated** against the live testnet (phases 0/1 deployed; phase 2 proven
end-to-end in a local wallet; phase 3 fully on-chain). Two honest caveats:

- **Revocation → resolver (Phase 3e).** On-chain revocation is correct and immediate, but the deployed
  Trust Resolver library (`verre@0.2.5`) validates a permission by its type and effective window and does
  **not** check the `revoked` flag, so a revoked issuer/verifier keeps resolving as authorized. Filed
  upstream as [`verana-labs/verre#107`](https://github.com/verana-labs/verre/issues/107); no change needed
  in this repo once it lands.
- **Local wallet PDF export ([#10](https://github.com/verana-labs/mosip-playground/issues/10)).** Exporting a
  stored card to PDF needs `datashare-service`, which isn't in the minimal local stack. Unrelated to the trust
  integration.

## Links

- **Verana** — [docs](https://docs.verana.io) · [spec](https://github.com/verana-labs/verana-spec) · [Trust Resolver](https://github.com/verana-labs/verre)
- **MOSIP Inji** — [docs](https://docs.inji.io) · [Inji Certify](https://docs.inji.io/inji-certify) · [Inji Verify](https://docs.inji.io/inji-verify) · [Inji Web](https://docs.inji.io/inji-web)
- **This integration** — phase write-ups in [`docs/`](docs/); the parent analysis + specs live in
  [`verana-labs/integration-sandbox`](https://github.com/verana-labs/integration-sandbox) under `mosip/`.
</content>
