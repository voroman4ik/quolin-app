// The evidence chain, kept in this browser so the consumer app and the bank console
// (in another tab) share one record. A demo stand-in for the engine's real store.

import { append, type ChainEntry } from './engine/chain';
import type { Determination, Snapshot } from './engine/types';
import type { ConsumerOutcome } from './decide';
import { PACKS, PACK_UPDATES, type Jurisdiction } from './packs';
import type { Pack } from './engine/types';

export type EntryKind = 'onboarding' | 'plan' | 'replay' | 'sell_request' | 'withdrawal';

export interface LedgerBody {
  kind: EntryKind;
  client_id: string;
  client_name: string;
  jurisdiction: string | null;
  pack_id: string | null;
  pack_version: number | null;
  outcome: ConsumerOutcome | 'ALLOW' | 'REFER' | 'BLOCK' | 'NOTED';
  summary: string;
  reasons: { rule_id: string; title: string; plain_english: string }[];
  limit_pence?: number;
  snapshot?: Snapshot;
  determination?: Determination | null;
  source: 'app' | 'seed' | 'console';
}

const CHAIN_KEY = 'quolin.chain.v1';
const PACKVER_KEY = 'quolin.packver.v1';
export const CHANGE_EVENT = 'quolin:ledger';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: the demo still runs, it just doesn't persist */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const loadChain = () => read<ChainEntry<LedgerBody>[]>(CHAIN_KEY, []);
export const saveChain = (c: ChainEntry<LedgerBody>[]) => write(CHAIN_KEY, c);

// Appends are serialised so two quick decisions can't both claim the same previous hash.
let queue: Promise<unknown> = Promise.resolve();
export function record(body: LedgerBody): Promise<ChainEntry<LedgerBody>> {
  const next = queue.then(async () => {
    const chain = loadChain();
    const entry = await append(chain, body, new Date().toISOString());
    saveChain([...chain, entry]);
    return entry;
  });
  queue = next.catch(() => undefined);
  return next;
}

export function clearChain() {
  write(CHAIN_KEY, []);
}

export function packVersions(): Record<Jurisdiction, number> {
  return read(PACKVER_KEY, { UK: 1, SG: 1, EU: 1, HK: 1 });
}

export function setPackVersion(j: Jurisdiction, v: number) {
  write(PACKVER_KEY, { ...packVersions(), [j]: v });
}

export function activePack(j: Jurisdiction): Pack {
  return packVersions()[j] === 2 ? PACK_UPDATES[j].pack : PACKS[j];
}

/** Re-render when this tab or another one changes the ledger or the active packs. */
export function subscribe(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHAIN_KEY || e.key === PACKVER_KEY) fn();
  };
  window.addEventListener(CHANGE_EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, fn);
    window.removeEventListener('storage', onStorage);
  };
}
