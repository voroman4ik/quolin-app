// Backtests on the year of real weekly prices in market-data.json. A backtest is not a
// forecast, and the screen says so: the worst fall is shown first, the return second.

import type { AssetId } from './catalog';
import { LAST_WEEK, priceAt } from './market';

export type Line = { asset: AssetId; weight_bps: number };

/** A basket's value index (starts at 1), rebalanced to its weights every 4 weeks. */
export function basketIndex(lines: Line[], from = 0, to = LAST_WEEK, rebalanceEvery = 4): number[] {
  const idx = [1];
  let units = lines.map((l) => (l.weight_bps / 10_000) / priceAt(l.asset, from));
  for (let w = from + 1; w <= to; w++) {
    const v = lines.reduce((s, l, i) => s + units[i] * priceAt(l.asset, w), 0);
    idx.push(v);
    if ((w - from) % rebalanceEvery === 0) units = lines.map((l) => ((l.weight_bps / 10_000) * v) / priceAt(l.asset, w));
  }
  return idx;
}

export interface Metrics {
  totalReturnPct: number;
  /** Compound annual growth rate over the period. */
  annualReturnPct: number;
  /** Annualised standard deviation of weekly returns. */
  volatilityPct: number;
  maxDrawdownPct: number;
  bestWeekPct: number;
  worstWeekPct: number;
  /** Return above cash (4%), per unit of volatility. */
  sharpe: number;
}

export function metrics(index: number[]): Metrics {
  const rets = index.slice(1).map((v, i) => v / index[i] - 1);
  const years = (index.length - 1) / 52;
  const total = index[index.length - 1] / index[0] - 1;
  const annual = Math.pow(1 + total, 1 / years) - 1;
  const logs = index.slice(1).map((v, i) => Math.log(v / index[i]));
  const mean = logs.reduce((s, x) => s + x, 0) / logs.length;
  const vol = Math.sqrt(logs.reduce((s, x) => s + (x - mean) ** 2, 0) / (logs.length - 1)) * Math.sqrt(52);
  let peak = index[0], mdd = 0;
  for (const v of index) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  return {
    totalReturnPct: total * 100,
    annualReturnPct: annual * 100,
    volatilityPct: vol * 100,
    maxDrawdownPct: mdd * 100,
    bestWeekPct: Math.max(...rets) * 100,
    worstWeekPct: Math.min(...rets) * 100,
    sharpe: vol > 0 ? (annual - 0.04) / vol : 0,
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

export interface Backtest {
  basket: { index: number[]; metrics: Metrics };
  bitcoin: { index: number[]; metrics: Metrics };
  cash: { index: number[]; metrics: Metrics };
  plan: ReturnType<typeof simulatePlan>;
}

export function backtest(lines: Line[], initialPence: number, weeklyPence: number): Backtest {
  const b = basketIndex(lines);
  const btc = basketIndex([{ asset: 'BTC', weight_bps: 10_000 }]);
  const cash = basketIndex([{ asset: 'TBILL', weight_bps: 10_000 }]);
  return {
    basket: { index: b, metrics: metrics(b) },
    bitcoin: { index: btc, metrics: metrics(btc) },
    cash: { index: cash, metrics: metrics(cash) },
    plan: simulatePlan(b, initialPence, weeklyPence),
  };
}
