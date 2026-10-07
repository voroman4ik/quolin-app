// Rule packs: content, not code. Every pack here is ILLUSTRATIVE: modelled on each regime,
// not reviewed by anyone qualified, not to be relied on. The bank signs off real ones.
//
// The four packs share one rule set and differ in thresholds and in how each country
// treats each asset, which is exactly where the real regimes differ.

import type { AssetClassification, Pack, ReasonCode, Rule, ThresholdValue } from '../engine/types';

export type Jurisdiction = 'UK' | 'SG' | 'EU' | 'HK';

const RULES: Rule[] = [
  // ── Onboarding: the adviser's fact-find, decided ─────────────────────────────
  {
    rule_id: 'ON-AGE-01', title: 'Customer is an adult', stage: 'onboarding',
    predicate: { op: 'gte', left: { field: 'client.age_years' }, right: { threshold: 'adult_age_years' } },
    on_fail: 'BLOCK', reason_code: 'AGE', severity: 1,
  },
  {
    rule_id: 'ON-LOSS-01', title: 'Can absorb some loss', stage: 'onboarding',
    predicate: { op: 'gte', left: { field: 'client.loss_capacity_band' }, right: { threshold: 'min_loss_band' } },
    on_fail: 'BLOCK', reason_code: 'NO_LOSS_CAPACITY', severity: 1,
  },
  {
    rule_id: 'ON-KNOW-01', title: 'Risk-awareness course passed', stage: 'onboarding',
    predicate: { op: 'gte', left: { field: 'client.knowledge_score' }, right: { threshold: 'knowledge_pass_mark' } },
    on_fail: 'BLOCK', reason_code: 'KNOWLEDGE', severity: 2,
  },
  {
    rule_id: 'ON-BUFFER-01', title: 'Emergency fund in place', stage: 'onboarding',
    predicate: {
      op: 'gte', left: { field: 'client.emergency_fund_months' }, right: { threshold: 'min_emergency_fund_months' },
    },
    on_fail: 'BLOCK', reason_code: 'NO_BUFFER', severity: 2,
  },
  {
    rule_id: 'ON-DEBT-01', title: 'No expensive debt', stage: 'onboarding',
    predicate: { op: 'eq', left: { field: 'client.high_interest_debt' }, right: { const: false } },
    on_fail: 'BLOCK', reason_code: 'DEBT', severity: 2,
  },
  {
    rule_id: 'ON-HORIZON-01', title: 'Money not needed soon', stage: 'onboarding',
    predicate: { op: 'gte', left: { field: 'client.horizon_years' }, right: { threshold: 'min_horizon_years' } },
    on_fail: 'BLOCK', reason_code: 'HORIZON', severity: 3,
  },
  {
    rule_id: 'ON-VULN-01', title: 'No sign of vulnerability', stage: 'onboarding',
    predicate: { op: 'eq', left: { field: 'client.vulnerability_flag' }, right: { const: false } },
    on_fail: 'REFER', reason_code: 'VULNERABLE', severity: 2,
  },
  {
    rule_id: 'ON-XB-01', title: 'One country’s rules apply', stage: 'onboarding',
    predicate: { op: 'eq', left: { field: 'client.tax_residence' }, right: { field: 'client.residence' } },
    on_fail: 'REFER', reason_code: 'CROSS_BORDER', severity: 3,
  },

  // ── Asset: one line of a basket, for this person, in this country ─────────────
  {
    rule_id: 'AS-APPROVED-01', title: 'On this country’s Approved List', stage: 'asset',
    predicate: { op: 'eq', left: { field: 'asset.approval' }, right: { const: 'approved' } },
    on_fail: 'BLOCK', reason_code: 'NOT_APPROVED_HERE', severity: 1,
  },
  {
    rule_id: 'AS-LEV-01', title: 'No leverage', stage: 'asset',
    predicate: { op: 'eq', left: { field: 'asset.leverage' }, right: { const: false } },
    on_fail: 'BLOCK', reason_code: 'LEVERAGE', severity: 1,
  },
  {
    rule_id: 'AS-LEVEL-01', title: 'Knowledge level unlocked', stage: 'asset',
    predicate: { op: 'gte', left: { field: 'client.knowledge_level' }, right: { field: 'asset.required_level' } },
    on_fail: 'BLOCK', reason_code: 'LEVEL_LOCKED', severity: 2,
  },
  {
    rule_id: 'AS-LOSS-01', title: 'Loss capacity fits this asset’s swings', stage: 'asset',
    predicate: {
      op: 'gte', left: { field: 'client.loss_capacity_band' },
      right: { lookup: 'min_loss_band_by_volatility', key: { field: 'asset.volatility_band' } },
    },
    on_fail: 'BLOCK', reason_code: 'LOSS_FLOOR', severity: 2,
  },
  {
    rule_id: 'AS-WEIGHT-01', title: 'Non-core asset within its cap', stage: 'asset',
    applies_to: { asset_class: ['large'] },
    predicate: { op: 'lte', left: { field: 'line.weight_bps' }, right: { threshold: 'max_noncore_weight_bps' } },
    on_fail: 'BLOCK', reason_code: 'WEIGHT_CAP', severity: 3,
  },

  // ── Purchase: one buy against the personal limit ──────────────────────────────
  {
    rule_id: 'PU-LIMIT-01', title: 'Within your personal limit', stage: 'purchase',
    predicate: { op: 'lte', left: { calc: 'post_trade_crypto_cents' }, right: { calc: 'personal_limit_cents' } },
    on_fail: 'BLOCK', reason_code: 'OVER_LIMIT', severity: 1,
  },
];

/** A cooling-off period before a first purchase. Modelled on the UK's 24-hour rule for
 *  first-time crypto investors; only packs that carry it get it. */
const COOLING_OFF: Rule = {
  rule_id: 'PU-COOL-01', title: '24-hour cooling-off before a first purchase', stage: 'purchase',
  applies_to: { when: { op: 'eq', left: { field: 'client.prior_crypto_purchases' }, right: { const: 0 } } },
  predicate: { op: 'eq', left: { field: 'client.cooling_off_complete' }, right: { const: true } },
  on_fail: 'BLOCK', reason_code: 'COOLING_OFF', severity: 2,
};

const REASONS: Record<string, ReasonCode> = {
  AGE: { title: 'Under 18', plain_english: 'Crypto investing is only for adults.', consumer: 'not_for_you' },
  NO_LOSS_CAPACITY: {
    title: 'You can’t afford a loss right now',
    plain_english: 'You told us you’d need this money if it fell. Crypto can fall by half, so it isn’t right for money you need.',
    consumer: 'not_for_you',
  },
  KNOWLEDGE: {
    title: 'The course isn’t passed yet',
    plain_english: 'A few answers missed the key risks. Have another look at the lessons and try again tomorrow.',
    consumer: 'not_yet',
  },
  NO_BUFFER: {
    title: 'Build an emergency fund first',
    plain_english: 'Keep enough cash to cover a few months of spending before you invest in anything that can fall.',
    consumer: 'not_yet',
  },
  DEBT: {
    title: 'Pay off expensive debt first',
    plain_english: 'Paying off a credit card at 20%+ is a guaranteed return no investment can promise. We’ll remind you.',
    consumer: 'not_yet',
  },
  HORIZON: {
    title: 'You need this money too soon',
    plain_english: 'Crypto has taken years to recover from falls. Money you need within a few years is better kept safe.',
    consumer: 'not_yet',
  },
  VULNERABLE: {
    title: 'A person will call you',
    plain_english: 'Something you told us means a person should talk it through with you first. This is normal and there is no cost.',
  },
  CROSS_BORDER: {
    title: 'Two countries’ rules apply',
    plain_english: 'You live in one country and pay tax in another, so a specialist checks which rules apply to you.',
  },
  NOT_APPROVED_HERE: {
    title: 'Not on the Approved List here',
    plain_english: 'This asset isn’t approved for retail investors in your country yet, so we leave it out.',
  },
  LEVERAGE: {
    title: 'Leverage is never offered',
    plain_english: 'Borrowed exposure can lose more than you put in. Quolin never offers it.',
  },
  LEVEL_LOCKED: {
    title: 'Locked: pass Level 2 first',
    plain_english: 'This asset swings more than the core ones. A short Level 2 lesson unlocks it.',
  },
  LOSS_FLOOR: {
    title: 'Too volatile for your profile',
    plain_english: 'This asset can fall further than your loss capacity allows.',
  },
  WEIGHT_CAP: {
    title: 'Capped at 10%',
    plain_english: 'No single non-core asset can be more than 10% of a basket, so one bad bet can’t sink it.',
  },
  OVER_LIMIT: {
    title: 'Above your personal limit',
    plain_english: 'This would take your crypto above the safe amount we worked out together.',
    consumer: 'not_yet',
  },
  COOLING_OFF: {
    title: '24-hour cooling-off',
    plain_english: 'Your first purchase waits 24 hours, so nobody can rush you into it.',
    consumer: 'not_yet',
  },
};

type Approval = AssetClassification['approval'];

const asset = (
  cls: AssetClassification['class'], volatility_band: number, required_level: number,
  approval: Approval, leverage = false,
): AssetClassification => ({ class: cls, volatility_band, leverage, required_level, approval, structural_flags: [] });

/** Approved List, per the two-pager table (Oct 2026): ✓ approved, ? opinion needed, ✕ excluded. */
function assets(gold: Approval, tbill: Approval, sol: Approval): Record<string, AssetClassification> {
  return {
    BTC: asset('core', 3, 1, 'approved'),
    ETH: asset('core', 3, 1, 'approved'),
    GOLD: asset('steady', 2, 1, gold),
    TBILL: asset('steady', 1, 1, tbill),
    SOL: asset('large', 4, 2, sol),
    DOGE: asset('speculative', 5, 3, 'excluded'),
    BTC3L: asset('speculative', 5, 3, 'excluded', true),
  };
}

const COMMON: Record<string, ThresholdValue> = {
  adult_age_years: 18,
  min_loss_band: 2,
  knowledge_pass_mark: 4,
  min_emergency_fund_months: 3,
  min_horizon_years: 3,
  max_noncore_weight_bps: 1000,
  // A basket that loses more than half its weight to the Approved List is not offered.
  min_basket_coverage_bps: 5000,
  limit_bps_by_loss_band: { '1': 0, '2': 200, '3': 500, '4': 1000, '5': 1000 },
  min_loss_band_by_volatility: { '1': 2, '2': 2, '3': 2, '4': 3, '5': 5 },
};

interface Spec {
  id: Jurisdiction; name: string; regulator: string; effective_from: string; notes: string;
  overrides: Record<string, ThresholdValue>;
  assets: Record<string, AssetClassification>;
  extraRules?: Rule[];
}

const SPECS: Spec[] = [
  {
    id: 'UK', name: 'United Kingdom', regulator: 'Financial Conduct Authority', effective_from: '2027-10-25',
    notes: 'Modelled on the FCA cryptoasset regime (go-live 25 Oct 2027): appropriateness test, 24-hour cooling-off for first-time investors, and a 10% restricted-investor cap.',
    overrides: { max_crypto_concentration_bps: 1000 },
    assets: assets('opinion_needed', 'opinion_needed', 'approved'),
    extraRules: [COOLING_OFF],
  },
  {
    id: 'SG', name: 'Singapore', regulator: 'Monetary Authority of Singapore', effective_from: '2025-06-01',
    notes: 'Modelled on the MAS digital payment token regime: Risk Awareness Assessment required before any purchase. A tokenised money-market fund is approved for retail.',
    overrides: { max_crypto_concentration_bps: 500 },
    assets: assets('opinion_needed', 'approved', 'approved'),
  },
  {
    id: 'EU', name: 'European Union', regulator: 'National competent authority (MiCA)', effective_from: '2024-12-30',
    notes: 'Modelled on MiCA (Art. 60: banks may offer crypto services by notification). No gold-backed asset-referenced token is authorised yet, so gold is excluded.',
    overrides: { max_crypto_concentration_bps: 1000 },
    assets: assets('excluded', 'opinion_needed', 'approved'),
  },
  {
    id: 'HK', name: 'Hong Kong', regulator: 'Securities and Futures Commission', effective_from: '2023-06-01',
    notes: 'Modelled on the SFC VATP regime: knowledge assessment and a personal exposure limit set for every client.',
    overrides: { max_crypto_concentration_bps: 1000 },
    assets: assets('opinion_needed', 'opinion_needed', 'opinion_needed'),
  },
];

function build(spec: Spec, version: number, extra: Record<string, ThresholdValue> = {}): Pack {
  return {
    pack_id: spec.id,
    version,
    dsl_version: 2,
    jurisdiction_name: spec.name,
    regulator: spec.regulator,
    effective_from: spec.effective_from,
    content_status: 'ILLUSTRATIVE',
    signed_by: 'ILLUSTRATIVE – NOT PROFESSIONALLY REVIEWED',
    notes: spec.notes,
    thresholds: { ...COMMON, ...spec.overrides, ...extra },
    assets: spec.assets,
    rules: [...RULES, ...(spec.extraRules ?? [])],
    reason_codes: REASONS,
  };
}

export const PACKS: Record<Jurisdiction, Pack> = Object.fromEntries(
  SPECS.map((s) => [s.id, build(s, 1)]),
) as Record<Jurisdiction, Pack>;

/** The "rules change and the book reacts" moment: an illustrative regulator update that
 *  doubles the emergency-fund requirement and tightens the concentration cap. */
export const PACK_UPDATES: Record<Jurisdiction, { pack: Pack; summary: string[] }> = Object.fromEntries(
  SPECS.map((s) => {
    const cap = s.overrides.max_crypto_concentration_bps as number;
    const tighter = Math.floor(cap * 0.6);
    return [s.id, {
      pack: build(s, 2, { min_emergency_fund_months: 6, max_crypto_concentration_bps: tighter }),
      summary: [
        'Emergency fund required: 3 → 6 months',
        `Crypto cap: ${cap / 100}% → ${tighter / 100}% of savings`,
      ],
    }];
  }),
) as Record<Jurisdiction, { pack: Pack; summary: string[] }>;

export const JURISDICTIONS: { id: Jurisdiction; name: string }[] = SPECS.map((s) => ({ id: s.id, name: s.name }));

/** Countries the fact-find offers. Where no pack is signed, the engine refers rather than guesses. */
export const COUNTRIES: { code: string; name: string; pack: Jurisdiction | null }[] = [
  { code: 'GB', name: 'United Kingdom', pack: 'UK' },
  { code: 'SG', name: 'Singapore', pack: 'SG' },
  { code: 'DE', name: 'Germany', pack: 'EU' },
  { code: 'FR', name: 'France', pack: 'EU' },
  { code: 'IE', name: 'Ireland', pack: 'EU' },
  { code: 'HK', name: 'Hong Kong', pack: 'HK' },
  { code: 'MY', name: 'Malaysia', pack: null },
  { code: 'AU', name: 'Australia', pack: null },
  { code: 'US', name: 'United States', pack: null },
];
