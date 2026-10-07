// Exchange rates from GBP, the engine's base currency. Live ECB reference rates via
// Frankfurter when the browser can reach it; otherwise the snapshot below (7 Oct 2026).
// Rules never read a rate: limits are shares of savings, so they hold in any currency.

import type { Currency } from './catalog';

export interface Rates { rates: Record<Currency, number>; asOf: string; source: 'live' | 'snapshot' }

const SNAPSHOT: Rates = {
  rates: { GBP: 1, SGD: 1.6907, EUR: 1.1814, HKD: 10.3635, AUD: 1.8996, MYR: 5.3981, USD: 1.3205 },
  asOf: '2026-10-07',
  source: 'snapshot',
};

let current: Rates = SNAPSHOT;
const listeners = new Set<() => void>();
let started = false;

export const getRates = () => current;

export function subscribeFx(fn: () => void): () => void {
  listeners.add(fn);
  if (!started && typeof window !== 'undefined') { started = true; void refreshRates(); }
  return () => listeners.delete(fn);
}

export async function refreshRates(): Promise<Rates> {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=GBP&symbols=SGD,EUR,HKD,AUD,MYR,USD');
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { date: string; rates: Record<string, number> };
    current = { rates: { ...SNAPSHOT.rates, ...j.rates, GBP: 1 } as Rates['rates'], asOf: j.date, source: 'live' };
    listeners.forEach((fn) => fn());
  } catch {
    /* offline: the snapshot stands */
  }
  return current;
}

/** For tests: pin the rates. */
export function setRatesForTest(r: Partial<Record<Currency, number>>) {
  current = { ...SNAPSHOT, rates: { ...SNAPSHOT.rates, ...r } };
}
