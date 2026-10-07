// Real prices for the demo: a CoinGecko snapshot of 53 weekly GBP closes per coin
// (scripts/fetch-market-data.mjs). Week 0 is a year ago, week 52 is the snapshot date.
// The demo "replays" the last year on these prices, so every number moves with real markets.

import data from './market-data.json';

export const LAST_WEEK = 52;
export const SNAPSHOT_AT = data.fetched_at;
export const MARKET_SOURCE = `${data.source}, ${new Date(data.fetched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

interface CoinData {
  id: string; ticker: string; name: string; rank: number; logo: string;
  price_gbp: number; market_cap_gbp: number; volume_24h_gbp: number;
  below_peak_pct: number | null; weekly_gbp: number[];
}

export const COIN_DATA: Record<string, CoinData> = Object.fromEntries(
  (data.coins as CoinData[]).map((c) => [c.ticker, c]),
);

/** Tokenised T-bills have no CoinGecko series: a dollar token earning ~4% a year,
 *  priced in GBP through the USDC series so the dollar's moves show up. */
const TBILL_WEEKLY = COIN_DATA.USDC.weekly_gbp.map((p, i) => p * (1 + 0.04 * (i / 52)));

function series(ticker: string): number[] {
  if (ticker === 'TBILL') return TBILL_WEEKLY;
  const s = COIN_DATA[ticker]?.weekly_gbp;
  if (!s) throw new Error(`no price series for ${ticker}`);
  return s;
}

export interface Shock { week: number; pct: number }

/** How much of a market-wide shock each kind of asset takes. Illustrative betas. */
const SHOCK_BETA: Record<string, number> = { TBILL: 0, USDT: 0, USDC: 0, PAXG: 0.15 };

/** Price in GBP at a week, with any "what if" shocks from the demo applied from that week on. */
export function priceAt(ticker: string, week: number, shocks: Shock[] = []): number {
  const s = series(ticker);
  const w = Math.max(0, Math.min(LAST_WEEK, Math.round(week)));
  let p = s[Math.min(w, s.length - 1)];
  const beta = SHOCK_BETA[ticker] ?? 1;
  for (const sh of shocks) if (w >= sh.week) p *= 1 + (sh.pct / 100) * beta;
  return p;
}

export function weekDate(week: number): Date {
  const end = new Date(SNAPSHOT_AT).getTime();
  return new Date(end - (LAST_WEEK - week) * 7 * 86400_000);
}

export const fmtWeek = (week: number) =>
  weekDate(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Change over the snapshot year, in percent. */
export function yearChangePct(ticker: string): number {
  const s = series(ticker);
  return ((s[s.length - 1] - s[0]) / s[0]) * 100;
}
