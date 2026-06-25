# Inji Mobile wallet (Android)

The native MOSIP Inji Wallet, pointed at our Verana testnet, so it downloads the
same Foundational Resident ID the web wallet does and the credential carries the
Verana trust layer end to end.

## How it fits

The backend is the same one the web wallet already uses, nothing new to deploy:

- **mimoto** (the wallet BFF, in `inji-web-vs`) serves the issuer list from
  `inji-web-vs/config/mimoto-issuers-config.json`, which points at our Certify.
- **eSignet** handles the auth-code + OTP login.
- **Inji Certify** issues the credential over OID4VCI.

Inji Mobile talks to that same mimoto, so the `VeranaResidentId` issuer shows up
in the app automatically. The only thing that changes is the **app**: the
`MIMOTO_HOST` / `ESIGNET_HOST` it points at are baked in at build time.

## Building the APK

The app is built in CI, no Android Studio needed: `.github/workflows/13_build-inji-wallet.yml`
(`workflow_dispatch`). It clones `mosip/inji-wallet@v0.22.1`, writes a `.env` with our
hosts, applies the proof patch (below), and builds a universal debug APK as an artifact.
Run it from the Actions tab; set `arm64_only: true` for a faster single-ABI build when iterating.

The latest universal build is published as a release asset:

**https://github.com/verana-labs/mosip-playground/releases/download/inji-wallet-android/inji-wallet-verana.apk**

## The proof patch (upstream bug)

`inji-wallet v0.22.x` cannot issue an OID4VCI proof our Certify accepts, because of two
bugs in `shared/openId4VCI/Utils.ts`. `.github/scripts/patch-inji-proof.js` fixes both at
build time:

1. **No holder key in the proof.** On Android, `getJWKECR1` calls `jose.JWK.asKey(pem)`,
   which fails on Android Keystore EC PEMs, and `getJWK` swallows the error and returns
   `undefined`. The proof JWT then ships with neither `jwk` nor `kid`, and Certify rejects
   it (`invalid_proof`, "Error encountered during proof jwt parsing"). The fix builds the
   P-256 JWK from the PEM's uncompressed EC point, the same way the non-Android branch already does.
2. **Wrong `aud`.** The proof `aud` was the full `credential_issuer_host`
   (`…/v1/certify/issuance`); Certify validates it against its identifier (the bare origin).
   The fix takes the origin.

This is a real upstream bug present in both v0.22.0 and v0.22.1 (the only releases compatible
with Certify 0.14.0), so there is no version to swap to, it has to be patched. Worth filing on
`mosip/inji-wallet`.

## Test it

1. On an Android phone, download the APK above and install it (allow "install from unknown sources").
2. Open Inji Wallet, set a passcode.
3. **Add Credential** → **Foundational Resident ID**.
4. Sign in as a seeded resident: UIN `7841223190` (or `3320114588`), OTP `111111`.
5. The credential downloads and appears in the wallet.

## Known follow-ups

- Each CI build auto-generates its own debug keystore, so a new APK won't update over an
  older install (signature mismatch), uninstall first. A committed debug keystore would make
  the signature stable.
- A release-signed build would be needed for wider distribution beyond demo sideloading.
