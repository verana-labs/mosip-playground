interface Entry<V> {
  expiresAt: number;
  value: V;
}

// Bounded TTL + insertion-order LRU. Caches are keyed by attacker-controlled
// strings on a public endpoint, so an unbounded Map is a memory-exhaustion sink.
export class BoundedCache<V> {
  private readonly store = new Map<string, Entry<V>>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number
  ) {}

  private evictIfNeeded(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // refresh LRU recency
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    this.evictIfNeeded();
  }

  // Coalesces concurrent misses for the same key into one upstream call.
  async resolve(key: string, loader: () => Promise<V>, shouldCache: (value: V) => boolean): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const value = await loader();
      if (shouldCache(value)) this.set(key, value);
      return value;
    })().finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}
