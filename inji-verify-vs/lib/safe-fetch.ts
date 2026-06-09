export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`response exceeded ${limit} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

export function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Reads a response body with a hard byte ceiling: rejects early on an oversized
// Content-Length, then counts decoded bytes while streaming and aborts the moment
// the cap is crossed — so a lying or chunked response can't buffer past the limit.
export async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = res.headers.get("content-length");
  if (declared !== null) {
    const len = Number(declared);
    if (Number.isFinite(len) && len > maxBytes) throw new ResponseTooLargeError(maxBytes);
  }

  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new ResponseTooLargeError(maxBytes);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError(maxBytes);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

export async function fetchJsonCapped(
  url: string,
  init: RequestInit & { maxBytes: number }
): Promise<unknown> {
  const { maxBytes, ...rest } = init;
  const res = await fetch(url, rest);
  if (res.status === 404) {
    const err = new Error("not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return JSON.parse(await readBodyCapped(res, maxBytes));
}
