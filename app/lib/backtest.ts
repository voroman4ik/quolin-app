// Backtests on real weekly prices (lib/market.ts, ten years). A backtest is not a forecast,
// and the screen says so: the biggest fall is shown first, the return second.

import type { AssetId } from './catalog';
import { getHistory, priceAtIndex } from './market';

export type Line = { asset: AssetId | string; weight_bps: number };
export type Period = '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y';

export const PERIODS: { id: Period; weeks: number; label: string }[] = [
  { id: '3M', weeks: 13, label: '3 months' },
  { id: '6M', weeks: 26, label: '6 months' },
  { id: '1Y', weeks: 52, label: '1 year' },
  { id: '3Y', weeks: 156, label: '3 years' },
  { id: '5Y', weeks: 260, label: '5 years' },
  { id: '10Y', weeks: 520, label: '10 years' },
];

const last = () => getHistory().dates.length - 1;

/** The first grid index at which every id has a price. */
export function earliestIndex(ids: string[]): number {
  const h = getHistory();
  return Math.max(0, ...ids.map((id) => {
    const s = h.series[id] ?? [];
    const i = s.findIndex((x) => x != null);
    return i < 0 ? s.length : i;
  }));
}

/** Whether there is enough history for this period. */
export function periodAvailable(ids: string[], p: Period): boolean {
  const weeks = PERIODS.find((x) => x.id === p)!.weeks;
  return last() - weeks >= earliestIndex(ids);
}

/** A basket's value index (starts at 1), rebalanced to its weights every 4 weeks. */
export function basketIndex(lines: Line[], from: number, to: number, rebalanceEvery = 4): number[] {
  const px = (id: string, i: number) => priceAtIndex(id, i) as number;
  const idx = [1];
  let units = lines.map((l) => (l.weight_bps / 10_000) / px(l.asset, from));
  for (let i = from + 1; i <= to; i++) {
    const v = lines.reduce((s, l, k) => s + units[k] * px(l.asset, i), 0);
    idx.push(v);
    if ((i - from) % rebalanceEvery === 0) units = lines.map((l) => ((l.weight_bps / 10_000) * v) / px(l.asset, i));
  }
  return idx;
}

export interface Metrics {
  totalReturnPct: number;
  /** Compound annual growth rate; only meaningful over a year or more. */
  annualReturnPct: number;
  /** Annualised standard deviation of weekly returns. */
  volatilityPct: number;
  maxDrawdownPct: number;
  bestWeekPct: number;
  worstWeekPct: number;
  /** Return above cash, per unit of volatility. */
  sharpe: number;
  years: number;
}

export function metrics(index: number[], cashAnnualPct = 4): Metrics {
  const rets = index.slice(1).map((v, i) => v / index[i] - 1);
  const years = (index.length - 1) / 52;
  const total = index[index.length - 1] / index[0] - 1;
  const annual = Math.pow(1 + total, 1 / years) - 1;
  const logs = index.slice(1).map((v, i) => Math.log(v / index[i]));
  const mean = logs.reduce((s, x) => s + x, 0) / logs.length;
  const vol = Math.sqrt(logs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, logs.length - 1)) * Math.sqrt(52);
  let peak = index[0], mdd = 0;
  for (const v of index) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  return {
    totalReturnPct: total * 100,
    annualReturnPct: annual * 100,
    volatilityPct: vol * 100,
    maxDrawdownPct: mdd * 100,
    bestWeekPct: Math.max(...rets) * 100,
    worstWeekPct: Math.min(...rets) * 100,
    sharpe: vol > 0 ? (annual - cashAnnualPct / 100) / vol : 0,
    years,
  };
}

/** What a plan would have become: a lump sum at the start, then a weekly amount. */
export function simulatePlan(index: number[], initialPence: number, weeklyPence: number) {
  let units = initialPence / index[0];
  let paidIn = initialPence;
  const value: number[] = [Math.round(initialPence)];
  for (let w = 1; w < index.length; w++) {
    units += weeklyPence / index[w];
    paidIn += weeklyPence;
    value.push(Math.round(units * index[w]));
  }
  return { paidInPence: paidIn, finalPence: value[value.length - 1], value };
}

export interface BacktestItem {
  id: string;
  label: string;
  index: number[];
  metrics: Metrics;
  plan: ReturnType<typeof simulatePlan>;
}

export interface BacktestResult {
  period: Period;
  from: string;
  to: string;
  basket: BacktestItem;
  comparisons: BacktestItem[];
  /** Comparisons left out because they don't go back that far. */
  skipped: { id: string; label: string; since: string }[];
}

export function benchmarkLabel(id: string): string {
  return getHistory().benchmarks[id]?.label ?? ASSET_NAMES[id] ?? id;
}

const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ether', USDT: 'Tether', BNB: 'BNB', XRP: 'XRP', USDC: 'USD Coin', SOL: 'Solana', TRX: 'TRON',
  ZEC: 'Zcash', HYPE: 'Hyperliquid', DOGE: 'Dogecoin', XMR: 'Monero', LINK: 'Chainlink', ADA: 'Cardano', XLM: 'Stellar',
  PAXG: 'Tokenised gold', TBILL: 'Tokenised T-bills',
};

export function runBacktest(
  name: string, lines: Line[], period: Period, compare: string[], initialPence: number, weeklyPence: number,
): BacktestResult | null {
  const h = getHistory();
  const weeks = PERIODS.find((p) => p.id === period)!.weeks;
  const to = last();
  const from = to - weeks;
  if (from < earliestIndex(lines.map((l) => l.asset as string))) return null;
  const cash = metrics(basketIndex([{ asset: 'CASH', weight_bps: 10_000 }], from, to)).annualReturnPct;

  const item = (id: string, label: string, ls: Line[]): BacktestItem => {
    const index = basketIndex(ls, from, to);
    return { id, label, index, metrics: metrics(index, cash), plan: simulatePlan(index, initialPence, weeklyPence) };
  };
  const skipped: BacktestResult['skipped'] = [];
  const comparisons: BacktestItem[] = [];
  for (const id of compare) {
    if (earliestIndex([id]) > from) { skipped.push({ id, label: benchmarkLabel(id), since: h.starts[id] }); continue; }
    comparisons.push(item(id, benchmarkLabel(id), [{ asset: id, weight_bps: 10_000 }]));
  }
  return { period, from: h.dates[from], to: h.dates[to], basket: item('basket', name, lines), comparisons, skipped };
}
