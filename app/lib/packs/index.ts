// Rule packs: content, not code. Every pack here is ILLUSTRATIVE: modelled on each regime,
// not reviewed by anyone qualified, not to be relied on. The bank signs off real ones.
//
// All seven share Quolin's base rules (the fact-find, the Approved List policy, the personal
// limit). Each adds its own local rules, questions and disclosures, and sets its own numbers
// and its own Approved List. That is where the real regimes differ.

import type { AssetId } from '../catalog';
import type {
  AssetClassification, LocalQuestion, Pack, PackLocal, ReasonCode, Rule, ThresholdValue,
} from '../engine/types';

export type Jurisdiction = 'UK' | 'SG' | 'EU' | 'HK' | 'AU' | 'MY' | 'US';

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
    on_fail: 'BLOCK', reason_code: 'NOT_APPROVED_HERE', severity: 2,
  },
  {
    rule_id: 'AS-LEV-01', title: 'No leverage', stage: 'asset',
    predicate: { op: 'eq', left: { field: 'asset.leverage' }, right: { const: false } },
    on_fail: 'BLOCK', reason_code: 'LEVERAGE', severity: 1,
  },
  {
    rule_id: 'AS-MEME-01', title: 'Not a meme coin', stage: 'asset',
    predicate: { op: 'not_contains', left: { field: 'asset.structural_flags' }, right: { const: 'meme' } },
    on_fail: 'BLOCK', reason_code: 'MEME', severity: 1,
  },
  {
    rule_id: 'AS-PRIV-01', title: 'Not a privacy coin', stage: 'asset',
    predicate: { op: 'not_contains', left: { field: 'asset.structural_flags' }, right: { const: 'privacy' } },
    on_fail: 'BLOCK', reason_code: 'PRIVACY', severity: 1,
  },
  {
    rule_id: 'AS-EXCH-01', title: 'Not tied to one exchange', stage: 'asset',
    predicate: { op: 'not_contains', left: { field: 'asset.structural_flags' }, right: { const: 'exchange_token' } },
    on_fail: 'BLOCK', reason_code: 'EXCHANGE_TOKEN', severity: 1,
  },
  {
    rule_id: 'AS-HIST-01', title: 'At least three years of history', stage: 'asset',
    predicate: { op: 'gte', left: { field: 'asset.history_years' }, right: { threshold: 'min_asset_history_years' } },
    on_fail: 'BLOCK', reason_code: 'TOO_YOUNG', severity: 1,
  },
  {
    rule_id: 'AS-LEVEL-01', title: 'Knowledge level unlocked', stage: 'asset',
    predicate: { op: 'gte', left: { field: 'client.knowledge_level' }, right: { field: 'asset.required_level' } },
    on_fail: 'BLOCK', reason_code: 'LEVEL_LOCKED', severity: 3,
  },
  {
    rule_id: 'AS-LOSS-01', title: 'Loss capacity fits this asset’s swings', stage: 'asset',
    predicate: {
      op: 'gte', left: { field: 'client.loss_capacity_band' },
      right: { lookup: 'min_loss_band_by_volatility', key: { field: 'asset.volatility_band' } },
    },
    on_fail: 'BLOCK', reason_code: 'LOSS_FLOOR', severity: 3,
  },
  {
    rule_id: 'AS-WEIGHT-01', title: 'Non-core asset within its cap', stage: 'asset',
    applies_to: { asset_class: ['large'] },
    predicate: { op: 'lte', left: { field: 'line.weight_bps' }, right: { threshold: 'max_noncore_weight_bps' } },
    on_fail: 'BLOCK', reason_code: 'WEIGHT_CAP', severity: 4,
  },

  // ── Purchase: one buy against the personal limit ──────────────────────────────
  {
    rule_id: 'PU-LIMIT-01', title: 'Within your personal limit', stage: 'purchase',
    predicate: { op: 'lte', left: { calc: 'post_trade_crypto_cents' }, right: { calc: 'personal_limit_cents' } },
    on_fail: 'BLOCK', reason_code: 'OVER_LIMIT', severity: 1,
  },
];

const FIRST_PURCHASE = { op: 'eq', left: { field: 'client.prior_crypto_purchases' }, right: { const: 0 } } as const;

/** Local rules: each belongs to one pack and is why that country's journey differs. */
const LOCAL: Record<Jurisdiction, Rule[]> = {
  UK: [
    {
      rule_id: 'UK-CAT-01', title: 'FCA investor category declared', stage: 'onboarding',
      predicate: { op: 'in', left: { field: 'client.investor_category' }, right: { const: ['restricted', 'hnw', 'sophisticated'] } },
      on_fail: 'REFER', reason_code: 'UK_CATEGORY', severity: 2,
    },
    {
      rule_id: 'UK-COOL-01', title: '24-hour cooling-off before a first purchase', stage: 'purchase',
      applies_to: { when: FIRST_PURCHASE },
      predicate: { op: 'eq', left: { field: 'client.cooling_off_complete' }, right: { const: true } },
      on_fail: 'BLOCK', reason_code: 'COOLING_OFF', severity: 2,
    },
  ],
  SG: [
    {
      rule_id: 'SG-CREDIT-01', title: 'Not paid with credit', stage: 'purchase',
      predicate: { op: 'neq', left: { field: 'trade.funding' }, right: { const: 'credit_card' } },
      on_fail: 'BLOCK', reason_code: 'CREDIT', severity: 1,
    },
  ],
  EU: [
    {
      rule_id: 'EU-WP-01', title: 'White paper read before a first purchase', stage: 'purchase',
      applies_to: { when: FIRST_PURCHASE },
      predicate: { op: 'eq', left: { field: 'client.white_paper_ack' }, right: { const: true } },
      on_fail: 'BLOCK', reason_code: 'WHITE_PAPER', severity: 2,
    },
  ],
  HK: [
    {
      rule_id: 'HK-INDEX-01', title: 'Eligible large-cap (in two recognised indices)', stage: 'asset',
      applies_to: { asset_class: ['core', 'large'] },
      predicate: { op: 'gte', left: { field: 'asset.index_count' }, right: { threshold: 'min_index_count' } },
      on_fail: 'BLOCK', reason_code: 'HK_INDEX', severity: 2,
    },
  ],
  AU: [
    {
      rule_id: 'AU-TMD-01', title: 'Inside the target market (5+ year horizon)', stage: 'onboarding',
      predicate: { op: 'gte', left: { field: 'client.horizon_years' }, right: { threshold: 'tmd_min_horizon_years' } },
      on_fail: 'BLOCK', reason_code: 'AU_TMD', severity: 3,
    },
  ],
  MY: [
    {
      rule_id: 'MY-SHARIAH-01', title: 'Shariah screen, if chosen', stage: 'asset',
      applies_to: { when: { op: 'eq', left: { field: 'client.shariah_preference' }, right: { const: true } } },
      predicate: { op: 'not_contains', left: { field: 'asset.structural_flags' }, right: { const: 'interest_bearing' } },
      on_fail: 'BLOCK', reason_code: 'SHARIAH', severity: 1,
    },
  ],
  US: [
    {
      rule_id: 'US-STATE-01', title: 'State covered by the partner’s licences', stage: 'onboarding',
      predicate: { op: 'not_in', left: { field: 'client.us_state' }, right: { threshold: 'unlicensed_states' } },
      on_fail: 'REFER', reason_code: 'US_STATE', severity: 2,
    },
  ],
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
  LEVERAGE: { title: 'Leverage is never offered', plain_english: 'Borrowed exposure can lose more than you put in. Quolin never offers it.' },
  MEME: { title: 'Meme coins are never listed', plain_english: 'Its price moves on social media, not on any use. Quolin never lists meme coins.' },
  PRIVACY: { title: 'Privacy coins are never listed', plain_english: 'They hide who paid whom, which banks can’t square with anti-money-laundering rules.' },
  EXCHANGE_TOKEN: { title: 'Exchange tokens aren’t listed', plain_english: 'Its value depends on one company’s business. We don’t list tokens tied to a single exchange.' },
  TOO_YOUNG: { title: 'Less than three years old', plain_english: 'We want a full market cycle of history before listing anything.' },
  LEVEL_LOCKED: { title: 'Locked: pass Level 2 first', plain_english: 'This asset swings more than the core ones. A short Level 2 lesson unlocks it.' },
  LOSS_FLOOR: { title: 'Too volatile for your profile', plain_english: 'This asset can fall further than your loss capacity allows.' },
  WEIGHT_CAP: { title: 'Capped at 10%', plain_english: 'No single non-core asset can be more than 10% of a basket, so one bad bet can’t sink it.' },
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
  UK_CATEGORY: {
    title: 'Tell us your investor category',
    plain_english: 'UK rules ask every new investor to confirm a category (restricted, high-net-worth or sophisticated) before buying.',
  },
  CREDIT: {
    title: 'Not with a credit card',
    plain_english: 'Singapore doesn’t allow buying crypto on credit. Pay from your bank account instead.',
    consumer: 'not_yet',
  },
  WHITE_PAPER: {
    title: 'Read the white papers first',
    plain_english: 'MiCA gives you a white paper for every crypto-asset. Confirm you’ve read them before your first buy.',
    consumer: 'not_yet',
  },
  HK_INDEX: {
    title: 'Not an eligible large-cap in Hong Kong',
    plain_english: 'Hong Kong only lets retail investors buy assets included in at least two recognised crypto indices.',
  },
  AU_TMD: {
    title: 'Outside the target market',
    plain_english: 'In Australia, this product’s target market is money you won’t need for 5 years or more. Ours isn’t designed for shorter plans.',
    consumer: 'not_yet',
  },
  SHARIAH: {
    title: 'Not Shariah-compliant',
    plain_english: 'You asked for Shariah-compliant investments only. This one earns interest, so we leave it out.',
  },
  US_STATE: {
    title: 'Your state needs a separate licence',
    plain_english: 'New York requires a BitLicense our partner doesn’t hold yet, so a person will look at your options.',
  },
};

type Approval = AssetClassification['approval'];

const a = (
  cls: AssetClassification['class'], volatility_band: number, required_level: number,
  history_years: number, index_count: number, structural_flags: string[] = [],
): Omit<AssetClassification, 'approval'> => ({
  class: cls, volatility_band, leverage: false, required_level, structural_flags, history_years, index_count,
});

/** How each asset behaves, the same everywhere. Where it's approved is per country. */
const PROFILE: Record<AssetId, Omit<AssetClassification, 'approval'>> = {
  BTC: a('core', 3, 1, 17, 3),
  ETH: a('core', 3, 1, 11, 3),
  USDT: a('stable', 1, 1, 12, 0),
  BNB: a('large', 4, 2, 9, 2, ['exchange_token']),
  XRP: a('large', 4, 2, 13, 2),
  USDC: a('stable', 1, 1, 8, 0),
  SOL: a('large', 4, 2, 6, 2),
  TRX: a('large', 4, 2, 9, 1),
  ZEC: a('speculative', 5, 3, 10, 0, ['privacy']),
  HYPE: a('speculative', 5, 3, 2, 0),
  DOGE: a('speculative', 5, 3, 12, 1, ['meme']),
  XMR: a('speculative', 5, 3, 12, 0, ['privacy']),
  LINK: a('large', 4, 2, 9, 2),
  ADA: a('large', 4, 2, 9, 2),
  XLM: a('large', 4, 2, 12, 1),
  PAXG: a('steady', 2, 1, 7, 0),
  TBILL: a('steady', 1, 1, 3, 0, ['interest_bearing']),
};

const Y: Approval = 'approved', Q: Approval = 'opinion_needed', X: Approval = 'excluded';

/** The Approved List by country (illustrative, Oct 2026). Columns: UK SG EU HK AU MY US.
 *  ✓ approved for retail · ? legal opinion needed · ✕ not allowed there. */
const APPROVALS: Record<AssetId, [Approval, Approval, Approval, Approval, Approval, Approval, Approval]> = {
  BTC: [Y, Y, Y, Y, Y, Y, Y],
  ETH: [Y, Y, Y, Y, Y, Y, Y],
  USDT: [Q, Q, X, Q, Q, Q, Q],
  USDC: [Q, Q, Y, Q, Q, Q, Y],
  BNB: [Q, Q, Q, Q, Q, Q, Q],
  XRP: [Y, Y, Y, Q, Y, Q, Y],
  SOL: [Y, Y, Y, Q, Y, Q, Y],
  TRX: [Q, Q, Q, Q, Q, Q, Q],
  LINK: [Y, Q, Y, Q, Y, Q, Y],
  ADA: [Y, Q, Y, Q, Y, Q, Y],
  XLM: [Y, Q, Y, Q, Y, Q, Y],
  ZEC: [Q, Q, X, Q, Q, Q, Q],
  XMR: [Q, Q, X, Q, Q, Q, Q],
  DOGE: [Q, Q, Q, Q, Q, Q, Q],
  HYPE: [Q, Q, Q, Q, Q, Q, Q],
  PAXG: [Q, Q, X, Q, Q, Q, Q],
  TBILL: [Q, Y, Q, Q, Q, Q, Y],
};
const ORDER: Jurisdiction[] = ['UK', 'SG', 'EU', 'HK', 'AU', 'MY', 'US'];

function assetsFor(j: Jurisdiction): Record<string, AssetClassification> {
  const col = ORDER.indexOf(j);
  return Object.fromEntries(
    (Object.keys(PROFILE) as AssetId[]).map((id) => [id, { ...PROFILE[id], approval: APPROVALS[id][col] }]),
  );
}

const COMMON: Record<string, ThresholdValue> = {
  adult_age_years: 18,
  min_loss_band: 2,
  knowledge_pass_mark: 4,
  min_emergency_fund_months: 3,
  min_horizon_years: 3,
  max_noncore_weight_bps: 1000,
  max_crypto_concentration_bps: 1000,
  min_asset_history_years: 3,
  // A basket that loses more than half its weight to the Approved List is not offered.
  min_basket_coverage_bps: 5000,
  limit_bps_by_loss_band: { '1': 0, '2': 200, '3': 500, '4': 1000, '5': 1000 },
  min_loss_band_by_volatility: { '1': 2, '2': 2, '3': 2, '4': 3, '5': 5 },
};

const question = (q: LocalQuestion) => q;

interface Spec {
  id: Jurisdiction; name: string; regulator: string; effective_from: string; notes: string;
  overrides: Record<string, ThresholdValue>;
  local: PackLocal;
}

const SPECS: Spec[] = [
  {
    id: 'UK', name: 'United Kingdom', regulator: 'Financial Conduct Authority', effective_from: '2027-10-25',
    notes: 'Modelled on the FCA cryptoasset regime (go-live 25 Oct 2027) and its promotion rules: investor categorisation, appropriateness, and a 24-hour cooling-off for first-time investors. Restricted investors keep high-risk investments under 10% of net assets.',
    overrides: {},
    local: {
      home_currency: 'GBP', deposit_scheme: 'FSCS', tax: 'Capital Gains Tax on gains above the annual allowance', tax_report: 'CGT report (2026/27)',
      questions: [question({
        field: 'investor_category', label: 'Which describes you?', hint: 'UK rules ask every new investor this.',
        options: [
          { value: 'restricted', label: 'Restricted investor', sub: 'I’ll keep high-risk investments under 10% of my net assets' },
          { value: 'hnw', label: 'High-net-worth', sub: '£100k+ income or £250k+ net assets' },
          { value: 'sophisticated', label: 'Sophisticated investor', sub: 'Professional experience or a certificate' },
        ],
      })],
      disclosures: [],
      highlights: ['Investor category asked in the fact-find', '24-hour cooling-off before the first buy', 'Personal cap 10% of savings'],
    },
  },
  {
    id: 'SG', name: 'Singapore', regulator: 'Monetary Authority of Singapore', effective_from: '2025-06-19',
    notes: 'Modelled on the MAS digital payment token regime: Risk Awareness Assessment before any purchase, no buying on credit, no incentives. A tokenised money-market fund is approved for retail.',
    overrides: { max_crypto_concentration_bps: 500 },
    local: {
      home_currency: 'SGD', deposit_scheme: 'SDIC deposit insurance', tax: 'No capital gains tax for individual investors', tax_report: 'Transaction statement',
      questions: [], disclosures: [],
      highlights: ['No buying with a credit card', 'Personal cap 5% of savings', 'Tokenised T-bills approved for retail'],
    },
  },
  {
    id: 'EU', name: 'European Union', regulator: 'National competent authority (MiCA)', effective_from: '2024-12-30',
    notes: 'Modelled on MiCA (banks may offer crypto services by notification, Art. 60). A white paper for every crypto-asset; USDT is not authorised; no gold-backed token is authorised yet.',
    overrides: {},
    local: {
      home_currency: 'EUR', deposit_scheme: 'deposit guarantee schemes', tax: 'Taxed by your country (rules vary across the EU)', tax_report: 'Annual tax statement',
      questions: [], disclosures: [{ field: 'white_paper_ack', label: 'I’ve read the crypto-asset white papers for this basket' }],
      highlights: ['White paper confirmed before the first buy', 'USDT and tokenised gold not allowed', 'USDC allowed (MiCA e-money token)'],
    },
  },
  {
    id: 'HK', name: 'Hong Kong', regulator: 'Securities and Futures Commission', effective_from: '2023-06-01',
    notes: 'Modelled on the SFC VATP regime: knowledge assessment, a personal exposure limit for every client, and only eligible large-cap assets (in two recognised indices) for retail.',
    overrides: { limit_bps_by_loss_band: { '1': 0, '2': 200, '3': 400, '4': 800, '5': 800 }, min_index_count: 2 },
    local: {
      home_currency: 'HKD', deposit_scheme: 'the Deposit Protection Scheme', tax: 'No capital gains tax for individual investors', tax_report: 'Transaction statement',
      questions: [], disclosures: [],
      highlights: ['Large-caps only: in 2+ recognised indices', 'Lower limits: 8% at most', 'Bitcoin and Ether only, for now'],
    },
  },
  {
    id: 'AU', name: 'Australia', regulator: 'Australian Securities and Investments Commission', effective_from: '2027-04-09',
    notes: 'Modelled on the digital asset platform reforms (financial services licensing from 9 Apr 2027) and design and distribution obligations: only offered inside the target market.',
    overrides: { tmd_min_horizon_years: 5 },
    local: {
      home_currency: 'AUD', deposit_scheme: 'the Financial Claims Scheme', tax: 'Capital Gains Tax, halved on assets held over 12 months', tax_report: 'CGT schedule',
      questions: [], disclosures: [],
      highlights: ['Target market: 5+ year horizon', 'Regime starts 9 Apr 2027', 'Large networks approved'],
    },
  },
  {
    id: 'MY', name: 'Malaysia', regulator: 'Securities Commission Malaysia', effective_from: '2019-01-15',
    notes: 'Modelled on the SC’s digital asset framework: only assets the regulator recognises for trading. Offers a Shariah screen for clients who want one.',
    overrides: {},
    local: {
      home_currency: 'MYR', deposit_scheme: 'PIDM deposit insurance', tax: 'No capital gains tax for individual investors', tax_report: 'Transaction statement',
      questions: [question({
        field: 'shariah_preference', label: 'Do you want Shariah-compliant investments only?',
        options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }],
      })],
      disclosures: [],
      highlights: ['Optional Shariah screen', 'Bitcoin and Ether approved', 'Others await the regulator’s list'],
    },
  },
  {
    id: 'US', name: 'United States', regulator: 'OCC and state regulators (bank-distributed)', effective_from: '2025-03-07',
    notes: 'Modelled on bank-distributed crypto after OCC Interpretive Letter 1183, with a licensed partner. New York needs a BitLicense. A tokenised government money fund (a 1940 Act fund) is open to retail.',
    overrides: { unlicensed_states: ['NY'] },
    local: {
      home_currency: 'USD', deposit_scheme: 'FDIC insurance', tax: 'Capital gains tax (short- or long-term)', tax_report: 'Form 8949 export',
      questions: [question({
        field: 'us_state', label: 'Which state do you live in?',
        options: ['CA', 'TX', 'FL', 'NY', 'IL', 'Other'].map((s) => ({ value: s, label: s })),
      })],
      disclosures: [],
      highlights: ['State asked in the fact-find', 'New York referred (BitLicense)', 'USDC and tokenised T-bills approved'],
    },
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
    assets: assetsFor(spec.id),
    rules: [...RULES, ...LOCAL[spec.id]],
    reason_codes: REASONS,
    local: spec.local,
  };
}

export const PACKS: Record<Jurisdiction, Pack> = Object.fromEntries(
  SPECS.map((s) => [s.id, build(s, 1)]),
) as Record<Jurisdiction, Pack>;

/** The "rules change and the book reacts" moment: an illustrative regulator update that
 *  doubles the emergency-fund requirement and tightens the concentration cap. */
export const PACK_UPDATES: Record<Jurisdiction, { pack: Pack; summary: string[] }> = Object.fromEntries(
  SPECS.map((s) => {
    const cap = (s.overrides.max_crypto_concentration_bps ?? COMMON.max_crypto_concentration_bps) as number;
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
  { code: 'AU', name: 'Australia', pack: 'AU' },
  { code: 'MY', name: 'Malaysia', pack: 'MY' },
  { code: 'US', name: 'United States', pack: 'US' },
  { code: 'JP', name: 'Japan', pack: null },
];
