// The portfolio, event-sourced: every buy, sale and transfer is a transaction at a real
// price from that week. Values, gains, the limit meter and the chart are all derived from
// the transactions, so every number on screen moves with what the person does.

import { ASSET_IDS, type AssetId } from './catalog';
import { priceAt, type Shock } from './market';

export type TxnKind = 'buy' | 'sell' | 'transfer_out';

export interface Txn {
  id: number;
  week: number;
  kind: TxnKind;
  asset: AssetId;
  /** GBP pence at that week's price (cost for buys, proceeds for sales, value for transfers). */
  pence: number;
  units: number;
  note?: string;
}

export type Line = { asset: AssetId; weight_bps: number };

const px = (a: AssetId, week: number, shocks: Shock[]) => priceAt(a, week, shocks) * 100;

export function unitsAt(txns: Txn[], week: number): Partial<Record<AssetId, number>> {
  const u: Partial<Record<AssetId, number>> = {};
  for (const t of txns) {
    if (t.week > week) continue;
    u[t.asset] = (u[t.asset] ?? 0) + (t.kind === 'buy' ? t.units : -t.units);
  }
  for (const k of Object.keys(u) as AssetId[]) if ((u[k] ?? 0) < 1e-12) delete u[k];
  return u;
}

export function valueAt(txns: Txn[], week: number, shocks: Shock[] = []): number {
  const u = unitsAt(txns, week);
  return Math.round((Object.keys(u) as AssetId[]).reduce((s, a) => s + (u[a] ?? 0) * px(a, week, shocks), 0));
}

/** Buy `pence` of a basket at its weights, at this week's prices. */
export function buyLines(lines: Line[], pence: number, week: number, shocks: Shock[], nextId: number, note?: string): Txn[] {
  let id = nextId;
  return lines.map((l) => {
    const part = Math.round((pence * l.weight_bps) / 10_000);
    return { id: id++, week, kind: 'buy' as const, asset: l.asset, pence: part, units: part / px(l.asset, week, shocks), note };
  }).filter((t) => t.pence > 0);
}

/** Sell `pence` worth, pro rata across what is held (everything if pence ≥ value). */
export function sellPro(txns: Txn[], pence: number, week: number, shocks: Shock[], nextId: number, kind: TxnKind = 'sell', note?: string): Txn[] {
  const u = unitsAt(txns, week);
  const total = valueAt(txns, week, shocks);
  if (total <= 0) return [];
  const share = Math.min(1, pence / total);
  let id = nextId;
  return (Object.keys(u) as AssetId[]).map((a) => {
    const units = (u[a] ?? 0) * share;
    return { id: id++, week, kind, asset: a, units, pence: Math.round(units * px(a, week, shocks)), note };
  }).filter((t) => t.units > 0);
}

export interface Summary {
  valuePence: number;
  /** Money still in: buys minus the cost of what has been sold (average cost). */
  costPence: number;
  paidInPence: number;
  takenOutPence: number;
  /** Unrealised gain on what is held, plus gains already realised. */
  gainPence: number;
  realisedPence: number;
  changeBps: number;
  byAsset: { asset: AssetId; units: number; valuePence: number; costPence: number }[];
}

export function summarise(txns: Txn[], week: number, shocks: Shock[] = []): Summary {
  const cost: Partial<Record<AssetId, number>> = {};
  const units: Partial<Record<AssetId, number>> = {};
  let paidIn = 0, takenOut = 0, realised = 0;
  for (const t of [...txns].filter((x) => x.week <= week).sort((x, y) => x.week - y.week || x.id - y.id)) {
    const u = units[t.asset] ?? 0, c = cost[t.asset] ?? 0;
    if (t.kind === 'buy') {
      units[t.asset] = u + t.units; cost[t.asset] = c + t.pence; paidIn += t.pence;
    } else {
      const avg = u > 0 ? c / u : 0;
      const basis = avg * t.units;
      units[t.asset] = Math.max(0, u - t.units); cost[t.asset] = Math.max(0, c - basis);
      takenOut += t.pence;
      if (t.kind === 'sell') realised += t.pence - basis;
    }
  }
  const byAsset = ASSET_IDS.filter((a) => (units[a] ?? 0) > 1e-12).map((a) => ({
    asset: a, units: units[a]!, valuePence: Math.round(units[a]! * px(a, week, shocks)), costPence: Math.round(cost[a] ?? 0),
  }));
  const valuePence = byAsset.reduce((s, x) => s + x.valuePence, 0);
  const costPence = byAsset.reduce((s, x) => s + x.costPence, 0);
  return {
    valuePence, costPence, paidInPence: paidIn, takenOutPence: takenOut, realisedPence: Math.round(realised),
    gainPence: valuePence - costPence + Math.round(realised),
    changeBps: costPence > 0 ? Math.round(((valuePence - costPence) / costPence) * 10_000) : 0,
    byAsset,
  };
}

/** Value at the end of each week from `from` to `to`, for the chart. */
export function valueSeries(txns: Txn[], from: number, to: number, shocks: Shock[] = []): number[] {
  const out: number[] = [];
  for (let w = from; w <= to; w++) out.push(valueAt(txns, w, shocks));
  return out;
}

/** Money still in (cost of what is held) at the end of each week, for the "paid in" line. */
export function costSeries(txns: Txn[], from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = from; w <= to; w++) out.push(summarise(txns, w).costPence);
  return out;
}
