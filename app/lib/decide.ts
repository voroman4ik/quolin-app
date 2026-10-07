// Turns what the person told us into frozen snapshots, and engine determinations into
// what they see. Nothing here knows a regime: every number comes from the pack.

import { evaluate } from './engine/evaluate';
import { CALCS } from './engine/calcs';
import type { Determination, Finding, Pack, Snapshot } from './engine/types';
import { ASSETS, type AssetId } from './catalog';
import { COUNTRIES, PACKS, type Jurisdiction } from './packs';

export interface Profile {
  name: string;
  age: number | null;
  country: string;
  taxCountry: string;
  dependants: number;
  incomeMonthly: number;
  spendMonthly: number;
  emergencyMonths: number | null;
  highInterestDebt: boolean | null;
  /** Savings and investments in GBP. */
  savings: number;
  goal: string;
  horizonYears: number | null;
  attitude: 'cautious' | 'balanced' | 'adventurous' | null;
  fallReaction: 'need' | 'hurt' | 'fine' | null;
  vulnerability: boolean | null;
  knowledgeScore: number | null;
  knowledgeLevel: number;
}

export const EMPTY_PROFILE: Profile = {
  name: '', age: null, country: 'GB', taxCountry: 'GB', dependants: 0,
  incomeMonthly: 0, spendMonthly: 0, emergencyMonths: null, highInterestDebt: null, savings: 0,
  goal: '', horizonYears: null, attitude: null, fallReaction: null, vulnerability: null,
  knowledgeScore: null, knowledgeLevel: 0,
};

export function packFor(country: string): Pack | null {
  const j = COUNTRIES.find((c) => c.code === country)?.pack;
  return j ? PACKS[j] : null;
}

export function jurisdictionOf(country: string): Jurisdiction | null {
  return COUNTRIES.find((c) => c.code === country)?.pack ?? null;
}

/** Capacity for loss, 1 (can't lose any) to 5. The reaction to a 50% fall sets it;
 *  a cautious attitude or dependants with a thin buffer pull it down. */
export function lossBand(p: Profile): number | null {
  if (!p.fallReaction) return null;
  let band = { need: 1, hurt: 3, fine: 4 }[p.fallReaction];
  if (p.attitude === 'adventurous' && band === 4) band = 5;
  if (p.attitude === 'cautious') band = Math.min(band, 2);
  if (p.dependants > 0 && (p.emergencyMonths ?? 0) < 6) band = Math.max(1, band - 1);
  return band;
}

/** Fields the person hasn't answered are left out of the snapshot, so the engine refers
 *  on them by name rather than deciding on a guess. */
function clientFacts(p: Profile, extra: Record<string, unknown> = {}) {
  const c: Record<string, unknown> = {
    residence: p.country,
    tax_residence: p.taxCountry,
    assessable_portfolio_cents: Math.round(p.savings * 100),
    knowledge_score: p.knowledgeScore,
    knowledge_level: p.knowledgeLevel,
    ...extra,
  };
  if (p.age !== null) c.age_years = p.age;
  const band = lossBand(p);
  if (band !== null) c.loss_capacity_band = band;
  if (p.emergencyMonths !== null) c.emergency_fund_months = p.emergencyMonths;
  if (p.highInterestDebt !== null) c.high_interest_debt = p.highInterestDebt;
  if (p.horizonYears !== null) c.horizon_years = p.horizonYears;
  if (p.vulnerability !== null) c.vulnerability_flag = p.vulnerability;
  return c;
}

export type ConsumerOutcome = 'ALLOW' | 'NOT_YET' | 'REFER' | 'NOT_FOR_YOU';

export interface OnboardingResult {
  outcome: ConsumerOutcome;
  determination: Determination | null;
  snapshot: Snapshot;
  limitPence: number;
  limitBps: number;
  reasons: { title: string; plain_english: string; rule_id: string }[];
}

export function consumerOutcome(d: Determination): ConsumerOutcome {
  if (d.outcome === 'ALLOW') return 'ALLOW';
  if (d.outcome === 'REFER') return 'REFER';
  return d.findings.some((f) => f.outcome === 'BLOCK' && f.reason.consumer === 'not_for_you')
    ? 'NOT_FOR_YOU' : 'NOT_YET';
}

const asReasons = (fs: Finding[]) => fs.map((f) => ({
  rule_id: f.rule_id,
  title: f.reason.title,
  plain_english: f.missing_field
    ? `${f.reason.plain_english} (Missing: ${f.missing_field.replace('client.', '').replaceAll('_', ' ')}.)`
    : f.reason.plain_english,
}));

export function personalLimit(pack: Pack, snapshot: Snapshot): { pence: number; bps: number } {
  const read = (path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], snapshot);
  if (read('client.loss_capacity_band') === undefined) return { pence: 0, bps: 0 };
  return {
    pence: CALCS.personal_limit_cents(read, pack.thresholds),
    bps: CALCS.personal_limit_bps(read, pack.thresholds),
  };
}

export function decideOnboarding(p: Profile, pack: Pack | null = packFor(p.country)): OnboardingResult {
  const snapshot: Snapshot = { stage: 'onboarding', client: clientFacts(p) };
  if (!pack) {
    const country = COUNTRIES.find((c) => c.code === p.country)?.name ?? p.country;
    return {
      outcome: 'REFER', determination: null, snapshot, limitPence: 0, limitBps: 0,
      reasons: [{
        rule_id: '—', title: `No rules signed for ${country} yet`,
        plain_english: 'Your bank hasn’t signed off a rule pack for where you live, so a person will look at this rather than us guessing.',
      }],
    };
  }
  const d = evaluate(pack, 'onboarding', snapshot);
  const outcome = consumerOutcome(d);
  const limit = outcome === 'ALLOW' ? personalLimit(pack, snapshot) : { pence: 0, bps: 0 };
  return { outcome, determination: d, snapshot, limitPence: limit.pence, limitBps: limit.bps, reasons: asReasons(d.findings) };
}

export interface LineCheck {
  asset: AssetId;
  weight_bps: number;
  determination: Determination;
}

export function checkLine(pack: Pack, p: Profile, asset: AssetId, weight_bps: number): LineCheck {
  const cls = pack.assets[asset];
  const snapshot: Snapshot = {
    stage: 'asset',
    client: clientFacts(p),
    asset: { id: asset, ...cls },
    line: { weight_bps },
  };
  return { asset, weight_bps, determination: evaluate(pack, 'asset', snapshot) };
}

export interface ResolvedBasket {
  available: boolean;
  /** Weights after removing anything this person or country can't hold, re-normalised. */
  lines: { asset: AssetId; weight_bps: number }[];
  removed: { asset: AssetId; reason: string; detail: string }[];
}

/** Where an asset isn't allowed, the engine leaves it out and the basket rebalances.
 *  If too little is left, the basket isn't offered at all. */
export function resolveBasket(pack: Pack, p: Profile, lines: { asset: AssetId; weight_bps: number }[]): ResolvedBasket {
  const checks = lines.map((l) => checkLine(pack, p, l.asset, l.weight_bps));
  const kept = checks.filter((c) => c.determination.outcome === 'ALLOW');
  const removed = checks
    .filter((c) => c.determination.outcome !== 'ALLOW')
    .map((c) => ({
      asset: c.asset,
      reason: c.determination.findings[0].reason.title,
      detail: c.determination.findings[0].reason.plain_english,
    }));
  const coverage = kept.reduce((s, c) => s + c.weight_bps, 0);
  const min = pack.thresholds.min_basket_coverage_bps as number;
  if (coverage < min || coverage === 0) return { available: false, lines: [], removed };

  // Integer re-normalisation; the largest line absorbs the rounding remainder.
  const scaled = kept.map((c) => ({ asset: c.asset, weight_bps: Math.floor((c.weight_bps * 10_000) / coverage) }));
  const rest = 10_000 - scaled.reduce((s, l) => s + l.weight_bps, 0);
  scaled.sort((a, b) => b.weight_bps - a.weight_bps)[0].weight_bps += rest;
  return { available: true, lines: scaled, removed };
}

export function checkPurchase(
  pack: Pack, p: Profile,
  opts: { amountPence: number; heldPence: number; priorPurchases: number; coolingOffComplete: boolean },
): Determination {
  const snapshot: Snapshot = {
    stage: 'purchase',
    client: clientFacts(p, {
      prior_crypto_purchases: opts.priorPurchases,
      cooling_off_complete: opts.coolingOffComplete,
    }),
    positions: { crypto_value_cents: opts.heldPence },
    trade: { amount_cents: opts.amountPence },
  };
  return evaluate(pack, 'purchase', snapshot);
}
