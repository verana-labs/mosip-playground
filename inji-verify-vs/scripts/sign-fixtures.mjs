// Generates the demo credential fixtures in public/fixtures/.
//
// Requires the Phase-0 issuer keypair (NOT in the repo):
//   KEY_PATH=~/.verana/mosip/inji-certify-vs-key.json npm run fixtures
//
// Fixtures:
//   valid-resident-id.json  signed by the trusted Inji issuer, correct VTJSC
//   wrong-schema.json       signed by the trusted issuer, schema it is NOT authorized for
//   self-signed.json        signed by an ephemeral did:key unknown to Verana
//   tampered.json           valid-resident-id with a mutated claim (breaks the signature)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsigs from "jsonld-signatures";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Ed25519VerificationKey2020 } from "@digitalbazaar/ed25519-verification-key-2020";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "..");
const repoRoot = path.join(appDir, "..");
const outDir = path.join(appDir, "public", "fixtures");

const ISSUER_DID = "did:web:inji-certify-vs.mosip.testnet.verana.network";
const VTJSC = "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json";
const WRONG_VTJSC = "https://ecs-trust-registry.testnet.verana.network/vt/schemas-service-jsc.json";

const KEY_PATH =
  process.env.KEY_PATH ?? path.join(os.homedir(), ".verana", "mosip", "inji-certify-vs-key.json");

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(buf) {
  const d = [0];
  for (const x of buf) {
    let c = x;
    for (let i = 0; i < d.length; i++) {
      c += d[i] << 8;
      d[i] = c % 58;
      c = (c / 58) | 0;
    }
    while (c) {
      d.push(c % 58);
      c = (c / 58) | 0;
    }
  }
  let z = 0;
  for (const x of buf) {
    if (x === 0) z++;
    else break;
  }
  return "1".repeat(z) + d.reverse().map((i) => B58[i]).join("");
}

function issuerKeyPair() {
  const key = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  const seed = Buffer.from(key.privateKeyJwk.d, "base64url");
  const pubRaw = Buffer.from(key.publicKeyJwk.x, "base64url");
  // multicodec ed25519-priv (0x80 0x26) + 64-byte libsodium secret key (seed || pub)
  const privateKeyMultibase = "z" + b58(Buffer.concat([Buffer.from([0x80, 0x26]), seed, pubRaw]));
  return Ed25519VerificationKey2020.from({
    id: `${ISSUER_DID}#key-1`,
    controller: ISSUER_DID,
    type: "Ed25519VerificationKey2020",
    publicKeyMultibase: key.publicKeyMultibase,
    privateKeyMultibase,
  });
}

const contextsDir = path.join(appDir, "lib", "vc", "contexts");
const STATIC_CONTEXTS = {
  "https://www.w3.org/2018/credentials/v1": "credentials-v1.json",
  "https://www.w3.org/ns/credentials/examples/v2": "examples-v2.json",
  "https://w3id.org/security/suites/ed25519-2020/v1": "ed25519-2020-v1.json",
  "https://www.w3.org/ns/did/v1": "did-v1.json",
};

function didKeyDocument(did) {
  const multibase = did.slice("did:key:".length);
  const keyId = `${did}#${multibase}`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: did,
    verificationMethod: [
      { id: keyId, type: "Ed25519VerificationKey2020", controller: did, publicKeyMultibase: multibase },
    ],
    assertionMethod: [keyId],
    authentication: [keyId],
  };
}

function frameVerificationMethod(doc, url) {
  const method = (doc.verificationMethod ?? []).find((m) => m.id === url);
  if (!method) throw new Error(`verification method ${url} not found in DID document`);
  return { "@context": "https://w3id.org/security/suites/ed25519-2020/v1", ...method };
}

async function documentLoader(url) {
  const [base, fragment] = url.split("#");
  if (STATIC_CONTEXTS[url]) {
    const document = JSON.parse(fs.readFileSync(path.join(contextsDir, STATIC_CONTEXTS[url]), "utf8"));
    return { contextUrl: null, documentUrl: url, document };
  }
  let doc;
  if (base === ISSUER_DID) {
    doc = JSON.parse(fs.readFileSync(path.join(repoRoot, "inji-certify-vs", "public", "did.json"), "utf8"));
  } else if (base.startsWith("did:key:")) {
    doc = didKeyDocument(base);
  } else {
    throw new Error(`fixture documentLoader refuses: ${url}`);
  }
  return { contextUrl: null, documentUrl: url, document: fragment ? frameVerificationMethod(doc, url) : doc };
}

function residentIdCredential({ issuer, schemaId, serial }) {
  const issued = new Date();
  const expires = new Date(issued.getTime() + 5 * 365 * 24 * 3600 * 1000);
  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://www.w3.org/ns/credentials/examples/v2",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: `urn:uuid:phase1-demo-${serial}`,
    type: ["VerifiableCredential", "VerifiableTrustCredential"],
    issuer,
    issuanceDate: issued.toISOString(),
    expirationDate: expires.toISOString(),
    credentialSubject: {
      fullName: "Asha Devi Sharma",
      dateOfBirth: "1992-03-14",
      gender: "female",
      nationality: "IN",
      residentAddress: "12 MG Road, Bengaluru 560001, Karnataka, India",
      identifier: "MOSIP-UIN-7841-2231-9056",
    },
    credentialSchema: { id: schemaId, type: "JsonSchemaCredential" },
  };
}

async function sign(credential, key) {
  const { purposes: { AssertionProofPurpose } } = jsigs;
  return jsigs.sign(structuredClone(credential), {
    suite: new Ed25519Signature2020({ key }),
    purpose: new AssertionProofPurpose(),
    documentLoader,
  });
}

async function verify(signed) {
  const { purposes: { AssertionProofPurpose } } = jsigs;
  return jsigs.verify(signed, {
    suite: new Ed25519Signature2020(),
    purpose: new AssertionProofPurpose(),
    documentLoader,
  });
}

const issuerKey = await issuerKeyPair();

const ephemeral = await Ed25519VerificationKey2020.generate();
const ephemeralDid = `did:key:${ephemeral.publicKeyMultibase}`;
const ephemeralKey = await Ed25519VerificationKey2020.from({
  ...(await ephemeral.export({ publicKey: true, privateKey: true })),
  id: `${ephemeralDid}#${ephemeral.publicKeyMultibase}`,
  controller: ephemeralDid,
});

const valid = await sign(
  residentIdCredential({ issuer: ISSUER_DID, schemaId: VTJSC, serial: "0001" }),
  issuerKey
);
const wrongSchema = await sign(
  residentIdCredential({ issuer: ISSUER_DID, schemaId: WRONG_VTJSC, serial: "0002" }),
  issuerKey
);
const selfSigned = await sign(
  residentIdCredential({ issuer: ephemeralDid, schemaId: VTJSC, serial: "0003" }),
  ephemeralKey
);
const tampered = structuredClone(valid);
tampered.credentialSubject.fullName = "Someone Else Entirely";

fs.mkdirSync(outDir, { recursive: true });
const fixtures = {
  "valid-resident-id.json": valid,
  "wrong-schema.json": wrongSchema,
  "self-signed.json": selfSigned,
  "tampered.json": tampered,
};
for (const [name, doc] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(doc, null, 2) + "\n");
  const { verified } = await verify(doc);
  const expectValid = name !== "tampered.json";
  if (verified !== expectValid) {
    throw new Error(`${name}: expected signature verified=${expectValid}, got ${verified}`);
  }
  console.log(`${name}: written, signature verified=${verified} (expected ${expectValid})`);
}
