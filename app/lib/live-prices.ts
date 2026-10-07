// Live coin prices (CoinGecko via /api/prices), refreshed every two minutes while open.
import type { AssetId } from './catalog';

export interface LivePrice { gbp: number; change24h: number | null; marketCapGbp: number; rank: number }
export interface LivePrices { at: string | null; prices: Partial<Record<AssetId, LivePrice>> }

let current: LivePrices = { at: null, prices: {} };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export const getLivePrices = () => current;

async function refresh() {
  try {
    const res = await fetch('/api/prices');
    if (!res.ok) return;
    const j = await res.json();
    current = { at: j.at, prices: j.prices };
    listeners.forEach((fn) => fn());
  } catch {
    /* offline: screens fall back to the latest weekly close */
  }
}

export function subscribeLivePrices(fn: () => void): () => void {
  listeners.add(fn);
  if (!timer && typeof window !== 'undefined') { void refresh(); timer = setInterval(refresh, 120_000); }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}
