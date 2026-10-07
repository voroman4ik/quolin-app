// Tamper-evident record: each entry's hash covers its body and the previous hash,
// so editing any past decision breaks every hash after it.

export interface ChainEntry<T = unknown> {
  seq: number;
  at: string;
  body: T;
  prev_hash: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

/** JSON with sorted keys, so the same record always hashes the same. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

export async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashOf(seq: number, at: string, body: unknown, prev: string) {
  return sha256(canonical({ seq, at, body, prev_hash: prev }));
}

export async function append<T>(chain: ChainEntry<T>[], body: T, at: string): Promise<ChainEntry<T>> {
  const prev = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const seq = chain.length + 1;
  return { seq, at, body, prev_hash: prev, hash: await hashOf(seq, at, body, prev) };
}

/** Returns the seq of the first broken entry, or null when the whole chain holds. */
export async function verify(chain: ChainEntry[]): Promise<number | null> {
  let prev = GENESIS;
  for (const e of chain) {
    if (e.prev_hash !== prev) return e.seq;
    if ((await hashOf(e.seq, e.at, e.body, e.prev_hash)) !== e.hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
