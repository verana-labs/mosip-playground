# Phase 0 · Step 5 — Wiring the VTJSC into Inji Certify (design note)

> Resolves the open technical task in [phase-0-inji-certify-issuer-integration.md](phase-0-inji-certify-issuer-integration.md):
> how to make an **Inji Certify** issuer stamp the credentials it issues with the Verana
> **VTJSC** so they are independently trust-resolvable. Findings verified against live artifacts
> and the `mosip/inji-certify` source (2026-06-04).

## Target binding (verified against the live org)

The MOSIP Pilot Authority org (TRUSTED on testnet) publishes the schema-240 VTJSC at:

```
https://77.42.86.24.sslip.io/vt/schemas-resident-id-jsc.json   →  vpr:verana:vna-testnet-1/cs/v1/js/240
```

Every Inji-issued "Foundational Resident ID" VC must carry (shape proven by the org's own
ECS-SERVICE credential, which binds the same way to the ECS service VTJSC):

```json
"type": ["VerifiableCredential", "VerifiableTrustCredential", "FoundationalResidentIDCredential"],
"credentialSchema": {
  "id": "https://77.42.86.24.sslip.io/vt/schemas-resident-id-jsc.json",
  "type": "JsonSchemaCredential"
}
```

## How Inji Certify builds the VC (verified)

In **DataProvider mode** (`mosip.certify.plugin-mode=DataProvider`) the issued VC body is *entirely*
defined by the `vcTemplate` stored (base64) in a credential configuration row. Pipeline:
`CertifyIssuanceServiceImpl` → `dataProviderPlugin.fetchData()` → `VelocityTemplatingEngineImpl.format()`
→ `W3CJsonLD.addProof()` (Key Manager signs). Decoding the repo's `farmer-local-config.json` confirms
the template is a full VC body the operator controls (`@context`, `type`, `issuer: ${_issuer}`,
`credentialSubject`) — and `credentialSchema` is **not** present by default.

→ **The binding is config-only.** Add the static `credentialSchema` block (and the extra `type`
entries) to the `vcTemplate`; no code change.

## Recommended approach

`POST /v1/certify/credential-configurations` with a resident-id config whose decoded `vcTemplate`
includes the block above. Key fields (from the real config schema):

| field | value |
|---|---|
| `credentialFormat` | `ldp_vc` (JSON-LD — the format that natively carries `credentialSchema`; SD-JWT does not) |
| `vcTemplate` | base64 of the VC body incl. the `credentialSchema` + `type` above |
| `contextURLs` | must include a context where `credentialSchema`/`JsonSchemaCredential` are defined — prefer W3C VC **2.0** (`https://www.w3.org/ns/credentials/v2`); the farmer sample uses VC 1.1, to confirm in the prototype |
| `didUrl` | the Inji issuer DID (becomes `${_issuer}`) |
| `signatureAlgo` / `signatureCryptoSuite` | `EdDSA` / `Ed25519Signature2020` |
| `keyManagerAppId` / `keyManagerRefId` | Inji Key Manager signing key (private key never leaves KM) |

## The real challenge: making the Inji issuer a Trusted VS (Q1)

Binding `credentialSchema` is easy. The harder part is the **issuer DID**. For Phase-0 validation the
Inji issuer DID must (a) resolve as a **Trusted VS** — its DID document must carry the **ECS-SERVICE
linked-VP** issued by the org — and (b) hold an on-chain **ISSUER** permission for schema 240. Inji
Certify's `DIDDocumentUtil` serves a DID doc at `/v1/certify/.well-known/did.json` with **only
`verificationMethod` entries — no `service` / linked-VP**. Options:

1. **vs-agent-hosted issuer DID (recommended to prototype first).** Let the org's `vs-agent` mint/host
   the Inji issuer's `did:web`/`did:webvh` document (it embeds linked-VPs natively). Add Inji's
   Key-Manager **public** key to that document as a `verificationMethod`; set Inji's `didUrl` to it.
   Inji signs with its KM key; the org publishes the ECS-SERVICE linked-VP into the same doc. Cleanly
   separates "DID-doc hosting" (vs-agent) from "signing" (Inji).
2. **Proxy/augment** Inji's `/.well-known/did.json` (e.g. via the same Caddy) to inject the
   `service` + linked-VP entry alongside Inji's `verificationMethod`.

Either way the org (vs-agent + veranad) issues the ECS-SERVICE credential to the Inji DID and grants
the ISSUER permission on schema 240 — exactly the flow already proven for the org itself.

## Smallest experiment to validate end-to-end

1. Deploy Inji Certify locally (repo `docker-compose/`), `plugin-mode=DataProvider`, trivial CSV data plugin.
2. `POST` the resident-id credential config with the `credentialSchema` block, `ldp_vc`.
3. Issue a test VC (pre-authorized-code flow); assert `credentialSchema.id` == the VTJSC URL and `type` includes `VerifiableTrustCredential`.
4. Give the Inji issuer a Verana-registered DID (option 1), have the org issue it ECS-SERVICE + ISSUER perm on 240.
5. **Gate:** submit to the Verana testnet trust resolver → expect **Q1 `TRUSTED`** and **Q2 authorized-issuer** for the VTJSC.

## Open risks

- **Issuer-DID linked-VP** (above) — the main integration work; validate option 1 first.
- **Context version** — confirm `credentialSchema`/`JsonSchemaCredential` resolve under the template's `@context` (prefer VC 2.0).
- **Issuer-DID resolvability** — the Inji issuer DID must be resolvable by the Verana resolver (did:web/webvh, reachable, valid).
- **VTJSC availability** — the org host (`77.42.86.24.sslip.io`) must be up at verification time (already always-on via the VPS).

## Sources
- Live org artifacts: `…/vt/schemas-resident-id-jsc.json`, `…/vt/schemas-service-c-vp.json`.
- `mosip/inji-certify@master`: `certify-service/src/main/resources/credential-configurations/farmer-local-config.json`, `certify-service/src/main/java/io/mosip/certify/{services/CertifyIssuanceServiceImpl,vcformatters/VelocityTemplatingEngineImpl,credential/W3CJsonLD,utils/DIDDocumentUtil}.java`.
- Verana verifiable-trust-spec (W3C VTC / `credentialSchema` binding).
