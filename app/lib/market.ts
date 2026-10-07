// Real prices for the whole app: ten years of weekly GBP closes (lib/data/yahoo.ts).
// The bundled snapshot loads first; the browser then fetches /api/history (live, cached
// server-side) and every screen re-renders on the fresh data.
//
// The demo "replays" the last year: demo week 0 is a year ago, week 52 is the latest close.

import snapshot from './history.json';
import coingecko from './market-data.json';
import type { History } from './data/yahoo';

export const LAST_WEEK = 52;

let current: History = { ...(snapshot as History), live: false };
const listeners = new Set<() => void>();
let started = false;

export const getHistory = () => current;

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn);
  if (!started && typeof window !== 'undefined') { started = true; void refreshHistory(); }
  return () => listeners.delete(fn);
}

export async function refreshHistory(): Promise<History> {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error(String(res.status));
    const h = (await res.json()) as History;
    if (!h.series?.BTC?.length) throw new Error('empty');
    current = { ...h, live: true };
    listeners.forEach((fn) => fn());
  } catch {
    /* offline or rate-limited: the snapshot stands */
  }
  return current;
}

/** For tests. */
export function setHistoryForTest(h: History) { current = h; }

/** Index into the ten-year grid for a demo week. */
const offset = () => current.dates.length - 1 - LAST_WEEK;

/** CoinGecko snapshot: rank, logo, market cap. Live prices come from /api/prices. */
interface CoinData { id: string; ticker: string; name: string; rank: number; logo: string; price_gbp: number; market_cap_gbp: number; below_peak_pct: number | null }
export const COIN_DATA: Record<string, CoinData> = Object.fromEntries(
  (coingecko.coins as CoinData[]).map((c) => [c.ticker, c]),
);

export interface Shock { week: number; pct: number }

/** How much of a market-wide shock each kind of asset takes. Illustrative betas. */
const SHOCK_BETA: Record<string, number> = { TBILL: 0, CASH: 0, USDT: 0, USDC: 0, PAXG: 0.15, GOLD: 0.15, BONDS: 0.1 };

/** Price in GBP at a grid index (0 = ten years ago). Falls forward to the first known price. */
export function priceAtIndex(id: string, i: number): number | null {
  const s = current.series[id];
  if (!s) throw new Error(`no price series for ${id}`);
  return s[Math.max(0, Math.min(s.length - 1, i))];
}

/** Price in GBP at a demo week, with any "what if" shocks from the demo applied from that week on. */
export function priceAt(id: string, week: number, shocks: Shock[] = []): number {
  const w = Math.max(0, Math.min(LAST_WEEK, Math.round(week)));
  let p = priceAtIndex(id, offset() + w);
  if (p == null) {
    // Younger than the demo year (e.g. launched mid-year): use its first price.
    p = current.series[id].find((x) => x != null) ?? 0;
  }
  const beta = SHOCK_BETA[id] ?? 1;
  for (const sh of shocks) if (w >= sh.week) p *= 1 + (sh.pct / 100) * beta;
  return p;
}

export function weekDate(week: number): Date {
  return new Date(current.dates[offset() + Math.max(0, Math.min(LAST_WEEK, week))]);
}

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtWeek = (week: number) => fmtDate(weekDate(week));

/** Change over the last year, in percent. */
export function yearChangePct(id: string): number {
  const end = priceAt(id, LAST_WEEK), start = priceAt(id, 0);
  return ((end - start) / start) * 100;
}

export function marketSource(): string {
  const h = current;
  return `Yahoo Finance${h.live ? ' (live)' : ' snapshot'}, to ${fmtDate(h.dates[h.dates.length - 1])}`;
}

/** Worst fall in the asset's whole history, in GBP. */
export function worstFall(id: string) {
  return current.worst[id] ?? null;
}
