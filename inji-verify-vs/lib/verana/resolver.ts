import { BoundedCache } from "../bounded-cache";
import { fetchJsonCapped, parseEnvInt } from "../safe-fetch";
import type { IssuerAuthorization, ResolverOutcome, TrustResolution } from "./types";
import { validateIssuerAuthorization, validateTrustResolution } from "./validate";

const RESOLVER_URL = process.env.VERANA_RESOLVER_URL ?? "https://resolver.testnet.verana.network";
const TIMEOUT_MS = parseEnvInt(process.env.VERANA_RESOLVER_TIMEOUT_MS, 10_000);
const CACHE_TTL_MS = parseEnvInt(process.env.VERANA_RESOLVER_CACHE_TTL_MS, 300_000);
const MAX_RESPONSE_BYTES = parseEnvInt(process.env.VERANA_RESOLVER_MAX_BYTES, 1_000_000);
const MAX_CACHE_ENTRIES = 1_000;

const cache = new BoundedCache<ResolverOutcome<unknown>>(MAX_CACHE_ENTRIES, CACHE_TTL_MS);

function hasStatus(err: unknown, status: number): boolean {
  return typeof err === "object" && err !== null && (err as { status?: number }).status === status;
}

async function query<T>(
  cacheKey: string,
  url: URL,
  validate: (raw: unknown) => T
): Promise<ResolverOutcome<T>> {
  const outcome = await cache.resolve(
    cacheKey,
    async (): Promise<ResolverOutcome<unknown>> => {
      try {
        const raw = await fetchJsonCapped(url.toString(), {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "error",
          maxBytes: MAX_RESPONSE_BYTES,
        });
        return { ok: true, data: validate(raw) };
      } catch (err) {
        if (hasStatus(err, 404)) return { ok: false, notFound: true };
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    // Cache only definitive answers; transient transport errors must be retried.
    (value) => value.ok || value.notFound === true
  );
  return outcome as ResolverOutcome<T>;
}

export function resolveTrust(did: string): Promise<ResolverOutcome<TrustResolution>> {
  const url = new URL("/v1/trust/resolve", RESOLVER_URL);
  url.searchParams.set("did", did);
  url.searchParams.set("detail", "full");
  return query(`q1:${did}`, url, (raw) => validateTrustResolution(raw, did));
}

export function resolveIssuerAuthorization(
  did: string,
  vtjscId: string
): Promise<ResolverOutcome<IssuerAuthorization>> {
  const url = new URL("/v1/trust/issuer-authorization", RESOLVER_URL);
  url.searchParams.set("did", did);
  url.searchParams.set("vtjscId", vtjscId);
  return query(`q2:${did}:${vtjscId}`, url, (raw) => validateIssuerAuthorization(raw, did, vtjscId));
}

export function clearResolverCache(): void {
  cache.clear();
}
