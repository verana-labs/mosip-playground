// Patches mosip/inji-wallet's OID4VCI proof generation so it works against our
// Inji Certify 0.14.0. Two upstream bugs (see shared/openId4VCI/Utils.ts):
//
//  A) getJWKECR1's Android branch calls jose.JWK.asKey(pem) which fails on
//     Android Keystore EC PEMs; getJWK swallows the throw and returns undefined,
//     so the proof header ships with no jwk/kid and Certify can't parse it. The
//     non-Android branch already builds the P-256 jwk from the raw EC point, so
//     we do the same on Android, extracting the uncompressed point from the DER.
//  B) the proof aud is set to credential_issuer_host (…/v1/certify/issuance) but
//     Certify validates aud against its identifier (the bare origin).
//
// Runs in the build workflow against the freshly-checked-out inji-wallet tree.

const fs = require("fs");

const file = "shared/openId4VCI/Utils.ts";
let c = fs.readFileSync(file, "utf8");

c = c.replace(
  /const publicKeyJWKString = await jose\.JWK\.asKey\(publicKey, 'pem'\);\s*\n\s*jwk = publicKeyJWKString\.toJSON\(\);/,
  [
    "const der = Buffer.from(publicKey.replace(/-----[^-]+-----/g, '').replace(/\\s+/g, ''), 'base64');",
    "    const point = der.slice(der.length - 65); // 0x04 || x(32) || y(32)",
    "    jwk = {",
    "      kty: 'EC',",
    "      crv: 'P-256',",
    "      x: base64url(Buffer.from(point.slice(1, 33))),",
    "      y: base64url(Buffer.from(point.slice(33, 65))),",
    "    };",
  ].join("\n"),
);

c = c.replace(
  /aud: selectedIssuer,/,
  "aud: selectedIssuer.split('/').slice(0, 3).join('/'),",
);

if (!c.includes("der.slice(der.length - 65)")) throw new Error("Fix A (Android EC jwk) did not apply");
if (!c.includes("selectedIssuer.split('/')")) throw new Error("Fix B (aud origin) did not apply");

fs.writeFileSync(file, c);
console.log("Patched shared/openId4VCI/Utils.ts: Android EC jwk + aud origin");
