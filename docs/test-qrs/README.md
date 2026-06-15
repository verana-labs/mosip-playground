# Sample credentials (test QRs)

Upload any of these QR codes to the live **[Inji Verify UI](https://inji-verify-ui.mosip.testnet.verana.network)**
(*Upload QR Code* tab) to reproduce each trust outcome. You'll see the **MOSIP Inji Verify** result and the
**Verana Trust Network** panel side by side — that pairing is the whole point of this integration: a valid
signature is not the same as a trusted, authorized issuer.

| QR | Inji Verify (signature) | Verana Trust Network panel | What it shows |
|---|---|---|---|
| `valid-resident-id.png` · `REAL-certify-issued.png` | ✅ valid | **Accredited issuer** — a Trusted Verifiable Service with an active accreditation for this credential type | the happy path: authentic **and** legitimate |
| `self-signed.png` | ✅ valid | **Untrusted issuer** — the signature is valid, but the issuer is not a trusted Verana participant | authentic, but **not** legitimate |
| `wrong-schema.png` | ✅ valid | **Trusted service — not accredited for this credential** — the issuer is trusted, but not accredited to issue *this* credential type | trusted, but **not authorized** here |
| `tampered.png` | ❌ invalid | *(no trust check — an invalid credential never reaches it)* | rejected at the signature step |

These are the four verdicts the integration must get right: **authentic + accredited** (allow),
**authentic but untrusted** (deny), **trusted but not authorized for this type** (deny), and **tampered**
(reject). `REAL-certify-issued.png` is a real credential issued by the live Inji Certify issuer;
`valid-resident-id.png` is a committed fixture. All carry **synthetic / mock** identity data only.
