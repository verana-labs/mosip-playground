import dns from "node:dns/promises";
import net from "node:net";
import { BoundedCache } from "../bounded-cache";
import { fetchJsonCapped, parseEnvInt } from "../safe-fetch";
import credentialsV1 from "./contexts/credentials-v1.json";
import didV1 from "./contexts/did-v1.json";
import ed25519V1 from "./contexts/ed25519-2020-v1.json";
import examplesV2 from "./contexts/examples-v2.json";

const STATIC_CONTEXTS: Record<string, unknown> = {
  "https://www.w3.org/2018/credentials/v1": credentialsV1,
  "https://www.w3.org/ns/credentials/examples/v2": examplesV2,
  "https://w3id.org/security/suites/ed25519-2020/v1": ed25519V1,
  "https://www.w3.org/ns/did/v1": didV1,
};

const FETCH_TIMEOUT_MS = parseEnvInt(process.env.DID_FETCH_TIMEOUT_MS, 10_000);
const MAX_DOC_BYTES = parseEnvInt(process.env.DID_DOC_MAX_BYTES, 256_000);
const DID_DOC_TTL_MS = parseEnvInt(process.env.DID_DOC_CACHE_TTL_MS, 300_000);
const MAX_CACHE_ENTRIES = 500;

const didDocCache = new BoundedCache<unknown>(MAX_CACHE_ENTRIES, DID_DOC_TTL_MS);

interface LoadedDocument {
  contextUrl: null;
  documentUrl: string;
  document: unknown;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => acc * 256 + Number(oct), 0) >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (base: string, bits: number) => (n >>> (32 - bits)) === (ipv4ToInt(base) >>> (32 - bits));
  return (
    inRange("0.0.0.0", 8) || // unspecified / "this" network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (incl. 169.254.169.254 metadata)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  );
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true; // link-local + ULA
  if (lower.startsWith("ff")) return true; // multicast
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // not a recognizable IP → refuse
}

// Reject hostnames that are really numeric IP literals in disguise (decimal,
// hex, or zero-padded octal octets) — Node normalizes these to loopback/private.
function looksNumericHost(host: string): boolean {
  if (/^0x/i.test(host) || /^\d+$/.test(host)) return true;
  const labels = host.split(".");
  return labels.length === 4 && labels.every((l) => /^(0x[0-9a-f]+|0\d+|\d+)$/i.test(l));
}

async function assertSafePublicHost(host: string): Promise<void> {
  if (!host.includes(".")) throw new Error(`refusing single-label host: ${host}`);
  if (looksNumericHost(host)) throw new Error(`refusing numeric host literal: ${host}`);
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error(`refusing private/reserved IP: ${host}`);
    return;
  }
  const addresses = await dns.lookup(host, { all: true });
  if (addresses.length === 0) throw new Error(`host did not resolve: ${host}`);
  for (const { address } of addresses) {
    if (isBlockedIp(address)) throw new Error(`host ${host} resolves to a private/reserved IP`);
  }
}

function didWebToUrl(did: string): { url: string; host: string } {
  const parts = did.slice("did:web:".length).split(":").map(decodeURIComponent);
  const hostPort = parts.shift();
  if (!hostPort) throw new Error(`invalid did:web (no host): ${did}`);
  const [host, port] = hostPort.split(":");
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error(`invalid did:web host: ${did}`);
  if (port !== undefined && port !== "443") throw new Error(`refusing non-443 did:web port: ${did}`);
  for (const part of parts) {
    if (part === "." || part === ".." || part.includes("/") || part.includes("\\")) {
      throw new Error(`invalid path component in did:web: ${did}`);
    }
  }
  const url =
    parts.length === 0
      ? `https://${host}/.well-known/did.json`
      : `https://${host}/${parts.join("/")}/did.json`;
  return { url, host };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(str: string): Uint8Array {
  const bytes = [0];
  for (const ch of str) {
    const value = B58.indexOf(ch);
    if (value === -1) throw new Error("invalid base58 character");
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

function didKeyToDocument(did: string): unknown {
  const multibase = did.slice("did:key:".length).split("#")[0];
  if (!multibase.startsWith("z")) throw new Error(`unsupported did:key encoding: ${did}`);
  const decoded = base58Decode(multibase.slice(1));
  // multicodec ed25519-pub header (0xed 0x01) + exactly 32 public-key bytes
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error(`unsupported did:key (only Ed25519 z6Mk… is supported): ${did}`);
  }
  const keyId = `did:key:${multibase}#${multibase}`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: `did:key:${multibase}`,
    verificationMethod: [
      { id: keyId, type: "Ed25519VerificationKey2020", controller: `did:key:${multibase}`, publicKeyMultibase: multibase },
    ],
    assertionMethod: [keyId],
    authentication: [keyId],
  };
}

async function fetchDidWebDocument(did: string): Promise<unknown> {
  const { url, host } = didWebToUrl(did);
  return didDocCache.resolve(
    did,
    async () => {
      await assertSafePublicHost(host);
      return fetchJsonCapped(url, {
        headers: { accept: "application/did+json, application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "error",
        maxBytes: MAX_DOC_BYTES,
      });
    },
    () => true
  );
}

interface DidDocumentShape {
  verificationMethod?: Array<{ id?: string; [k: string]: unknown }>;
}

// ed25519-signature-2020 ≥5.4 resolves the verification method via
// ed25519-multikey, which requires the key sub-document to carry its own
// suite @context — returning the whole DID document for #fragment URLs
// fails its context assertion.
function frameVerificationMethod(doc: unknown, url: string): unknown {
  const methods = (doc as DidDocumentShape).verificationMethod ?? [];
  const method = methods.find((m) => m.id === url);
  if (!method) throw new Error(`verification method ${url} not found in DID document`);
  return { "@context": "https://w3id.org/security/suites/ed25519-2020/v1", ...method };
}

export async function documentLoader(url: string): Promise<LoadedDocument> {
  if (STATIC_CONTEXTS[url]) {
    return { contextUrl: null, documentUrl: url, document: STATIC_CONTEXTS[url] };
  }

  const [base, fragment] = url.split("#");
  if (base.startsWith("did:web:") || base.startsWith("did:key:")) {
    const doc = base.startsWith("did:web:") ? await fetchDidWebDocument(base) : didKeyToDocument(base);
    const document = fragment ? frameVerificationMethod(doc, url) : doc;
    return { contextUrl: null, documentUrl: url, document };
  }

  // Anything else (unknown contexts, http URLs, other DID methods) is refused:
  // remote @context substitution would silently change what was signed.
  throw new Error(`refusing to load remote document: ${url}`);
}

export function clearDidDocumentCache(): void {
  didDocCache.clear();
}
