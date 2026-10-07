import { describe, expect, it } from 'vitest';
import { evaluate, validatePack } from './engine/evaluate';
import { append, verify, type ChainEntry } from './engine/chain';
import { PACKS, PACK_UPDATES } from './packs';
import { checkPurchase, decideEverywhere, decideOnboarding, resolveBasket, checkLine, type Profile } from './decide';
import { ASSET_IDS, BASKETS, money, toBasePence, worstCase } from './catalog';
import { SARAH } from './personas';
import { buyLines, sellPro, summarise, valueAt } from './portfolio';
import { backtest } from './backtest';
import { priceAt } from './market';
import { setRatesForTest } from './fx';

const sarah: Profile = SARAH;
const inCountry = (country: string, extra: Partial<Profile> = {}): Profile => ({ ...sarah, country, taxCountry: country, ...extra });
const firstBuy = { amountPence: 2500, heldPence: 0, priorPurchases: 0, coolingOffComplete: true };

describe('packs', () => {
  it('every pack and every update validates', () => {
    for (const p of [...Object.values(PACKS), ...Object.values(PACK_UPDATES).map((u) => u.pack)]) {
      expect(validatePack(p)).toEqual([]);
    }
  });

  it('there are seven, each with its own local rules', () => {
    expect(Object.keys(PACKS)).toEqual(['UK', 'SG', 'EU', 'HK', 'AU', 'MY', 'US']);
    for (const p of Object.values(PACKS)) expect(p.rules.some((r) => r.rule_id.startsWith(`${p.pack_id}-`))).toBe(true);
  });

  it('every pack classifies all 17 assets', () => {
    for (const p of Object.values(PACKS)) expect(Object.keys(p.assets).sort()).toEqual([...ASSET_IDS].sort());
  });
});

describe('onboarding', () => {
  it('allows the two-pager persona with a £1,200 limit (5% of £24,000)', () => {
    const r = decideOnboarding(sarah);
    expect(r.outcome).toBe('ALLOW');
    expect(r.limitPence).toBe(120_000);
    expect(r.limitBps).toBe(500);
  });

  it('expensive debt is "not yet", not a refusal', () => {
    const r = decideOnboarding({ ...sarah, highInterestDebt: true });
    expect(r.outcome).toBe('NOT_YET');
    expect(r.reasons[0].title).toMatch(/debt/i);
  });

  it('needing the money is "not for you", and wins over "not yet"', () => {
    expect(decideOnboarding({ ...sarah, fallReaction: 'need', highInterestDebt: true }).outcome).toBe('NOT_FOR_YOU');
  });

  it('under 18 is not for you', () => {
    expect(decideOnboarding({ ...sarah, age: 17 }).outcome).toBe('NOT_FOR_YOU');
  });

  it('an unanswered question refers by name rather than guessing', () => {
    const r = decideOnboarding({ ...sarah, emergencyMonths: null });
    expect(r.outcome).toBe('REFER');
    expect(r.determination!.findings[0].missing_field).toBe('client.emergency_fund_months');
  });

  it('two tax countries refer to a person', () => {
    expect(decideOnboarding({ ...sarah, taxCountry: 'SG' }).outcome).toBe('REFER');
  });

  it('a country with no signed pack refers', () => {
    expect(decideOnboarding(inCountry('JP')).outcome).toBe('REFER');
  });

  it('a course not taken blocks as "not yet"', () => {
    expect(decideOnboarding({ ...sarah, knowledgeScore: null }).outcome).toBe('NOT_YET');
  });

  it('the regulator update flips a 4-month buffer to "not yet"', () => {
    expect(decideOnboarding(sarah, PACK_UPDATES.UK.pack).outcome).toBe('NOT_YET');
  });
});

describe('local rules: each country asks and decides differently', () => {
  it('UK: no investor category means a person checks', () => {
    const r = decideOnboarding({ ...sarah, local: {} });
    expect(r.outcome).toBe('REFER');
    expect(r.determination!.findings[0].missing_field).toBe('client.investor_category');
  });

  it('SG caps the same person lower than the UK', () => {
    expect(decideOnboarding(inCountry('SG', { fallReaction: 'fine' })).limitBps).toBe(500);
    expect(decideOnboarding({ ...sarah, fallReaction: 'fine' }).limitBps).toBe(1000);
  });

  it('HK limits are lower at every band', () => {
    expect(decideOnboarding(inCountry('HK')).limitBps).toBe(400);
    expect(decideOnboarding(inCountry('HK', { fallReaction: 'fine' })).limitBps).toBe(800);
  });

  it('AU: a 4-year horizon is outside the target market', () => {
    const r = decideOnboarding(inCountry('AU', { horizonYears: 4 }));
    expect(r.outcome).toBe('NOT_YET');
    expect(r.reasons.map((x) => x.rule_id)).toContain('AU-TMD-01');
    expect(decideOnboarding(inCountry('GB', { horizonYears: 4 })).outcome).toBe('ALLOW');
  });

  it('US: New York is referred, California is not', () => {
    expect(decideOnboarding(inCountry('US', { local: { us_state: 'NY' } })).outcome).toBe('REFER');
    expect(decideOnboarding(inCountry('US')).outcome).toBe('ALLOW');
  });

  it('MY: the Shariah screen removes interest-bearing T-bills', () => {
    const pack = { ...PACKS.MY, assets: { ...PACKS.MY.assets, TBILL: { ...PACKS.MY.assets.TBILL, approval: 'approved' as const } } };
    const shariah = inCountry('MY', { local: { shariah_preference: true } });
    expect(checkLine(pack, shariah, 'TBILL', 0).determination.findings[0].reason_code).toBe('SHARIAH');
    expect(checkLine(pack, inCountry('MY'), 'TBILL', 0).determination.outcome).toBe('ALLOW');
  });

  it('SG: no buying with a credit card', () => {
    const d = checkPurchase(PACKS.SG, inCountry('SG'), { ...firstBuy, funding: 'credit_card' });
    expect(d.findings[0].reason_code).toBe('CREDIT');
    expect(checkPurchase(PACKS.UK, sarah, { ...firstBuy, funding: 'credit_card' }).outcome).toBe('ALLOW');
  });

  it('EU: the first buy needs the white papers confirmed', () => {
    const p = inCountry('DE');
    expect(checkPurchase(PACKS.EU, p, firstBuy).findings[0].reason_code).toBe('WHITE_PAPER');
    expect(checkPurchase(PACKS.EU, p, { ...firstBuy, acknowledgements: { white_paper_ack: true } }).outcome).toBe('ALLOW');
  });

  it('UK first purchase waits for the 24h cooling-off; Singapore has none', () => {
    expect(checkPurchase(PACKS.UK, sarah, { ...firstBuy, coolingOffComplete: false }).findings.map((f) => f.reason_code)).toEqual(['COOLING_OFF']);
    expect(checkPurchase(PACKS.SG, inCountry('SG'), { ...firstBuy, coolingOffComplete: false }).outcome).toBe('ALLOW');
  });

  it('HK: an approved asset outside two indices is still not offered', () => {
    const pack = { ...PACKS.HK, assets: { ...PACKS.HK.assets, TRX: { ...PACKS.HK.assets.TRX, approval: 'approved' as const } } };
    const codes = checkLine(pack, { ...inCountry('HK'), knowledgeLevel: 2, fallReaction: 'fine' }, 'TRX', 500).determination.findings.map((f) => f.reason_code);
    expect(codes).toEqual(['HK_INDEX']);
  });

  it('one person, seven countries: seven different answers', () => {
    const rows = decideEverywhere(sarah);
    expect(rows).toHaveLength(7);
    const by = Object.fromEntries(rows.map((r) => [r.j, r.result]));
    expect(by.UK.limitBps).toBe(500);
    expect(by.HK.limitBps).toBe(400);
    expect(by.US.outcome).toBe('ALLOW');
  });
});

describe('Approved List policy', () => {
  const l3 = { ...sarah, knowledgeLevel: 3, fallReaction: 'fine' as const, attitude: 'adventurous' as const };
  const code = (id: Parameters<typeof checkLine>[2]) => checkLine(PACKS.UK, l3, id, 100).determination.findings[0]?.reason_code;
  it('privacy, meme, exchange and too-young coins are never listed', () => {
    expect(code('ZEC')).toBe('PRIVACY');
    expect(code('XMR')).toBe('PRIVACY');
    expect(code('DOGE')).toBe('MEME');
    expect(code('BNB')).toBe('EXCHANGE_TOKEN');
    expect(code('HYPE')).toBe('TOO_YOUNG');
  });

  it('EU: USDT and tokenised gold are not allowed; USDC is', () => {
    expect(PACKS.EU.assets.USDT.approval).toBe('excluded');
    expect(PACKS.EU.assets.PAXG.approval).toBe('excluded');
    expect(PACKS.EU.assets.USDC.approval).toBe('approved');
  });

  it('leverage is never offered', () => {
    const pack = { ...PACKS.UK, assets: { ...PACKS.UK.assets, BTC: { ...PACKS.UK.assets.BTC, leverage: true } } };
    expect(checkLine(pack, sarah, 'BTC', 100).determination.findings.map((f) => f.reason_code)).toContain('LEVERAGE');
  });
});

describe('baskets', () => {
  const steady = BASKETS.find((b) => b.id === 'steady')!;
  const gold = BASKETS.find((b) => b.id === 'digital_gold')!;

  it('UK: Steady is not offered (gold and T-bills await a legal opinion)', () => {
    expect(resolveBasket(PACKS.UK, sarah, steady.lines).available).toBe(false);
  });

  it('SG: Digital Gold drops gold and rebalances to 100%', () => {
    const r = resolveBasket(PACKS.SG, inCountry('SG'), gold.lines);
    expect(r.available).toBe(true);
    expect(r.lines.map((l) => l.asset).sort()).toEqual(['BTC', 'TBILL']);
    expect(r.lines.reduce((s, l) => s + l.weight_bps, 0)).toBe(10_000);
    expect(r.removed[0].asset).toBe('PAXG');
  });

  it('Solana is locked below Level 2 and capped at 10% above it', () => {
    expect(checkLine(PACKS.UK, sarah, 'SOL', 500).determination.findings[0].reason_code).toBe('LEVEL_LOCKED');
    const l2 = { ...sarah, knowledgeLevel: 2, fallReaction: 'fine' as const };
    expect(checkLine(PACKS.UK, l2, 'SOL', 1000).determination.outcome).toBe('ALLOW');
    expect(checkLine(PACKS.UK, l2, 'SOL', 1001).determination.findings[0].reason_code).toBe('WEIGHT_CAP');
  });

  it('worst case for Digital Gold: £1,000 → about £450', () => {
    expect(worstCase(gold.lines)).toBeGreaterThan(430);
    expect(worstCase(gold.lines)).toBeLessThan(470);
  });
});

describe('purchase', () => {
  it('a buy that crosses the personal limit is blocked; exactly at it passes', () => {
    const at = checkPurchase(PACKS.UK, sarah, { amountPence: 2500, heldPence: 117_500, priorPurchases: 3, coolingOffComplete: true });
    const over = checkPurchase(PACKS.UK, sarah, { amountPence: 2501, heldPence: 117_500, priorPurchases: 3, coolingOffComplete: true });
    expect(at.outcome).toBe('ALLOW');
    expect(over.findings[0].reason_code).toBe('OVER_LIMIT');
  });
});

describe('portfolio follows real prices and actions', () => {
  const core = BASKETS[0].lines;
  it('a buy is worth what it cost, then moves with the market', () => {
    const t = buyLines(core, 100_000, 0, [], 1);
    expect(valueAt(t, 0)).toBeCloseTo(100_000, -1);
    const later = valueAt(t, 38);
    const expected = 100_000 * (0.7 * priceAt('BTC', 38) / priceAt('BTC', 0) + 0.3 * priceAt('ETH', 38) / priceAt('ETH', 0));
    expect(later).toBeCloseTo(expected, -1);
    expect(later).toBeLessThan(70_000);
  });

  it('a "what if" fall moves crypto, not T-bills', () => {
    const t = buyLines([{ asset: 'BTC', weight_bps: 5000 }, { asset: 'TBILL', weight_bps: 5000 }], 100_000, 10, [], 1);
    const v = valueAt(t, 10, [{ week: 10, pct: -30 }]);
    expect(v).toBeCloseTo(85_000, -2);
  });

  it('selling half halves the holding and books the gain or loss', () => {
    const t = buyLines(core, 100_000, 0, [], 1);
    const sold = sellPro(t, valueAt(t, 20) / 2, 20, [], 100);
    const s = summarise([...t, ...sold], 20);
    expect(s.valuePence).toBeCloseTo(valueAt(t, 20) / 2, -1);
    expect(s.costPence).toBeCloseTo(50_000, -1);
    expect(Math.sign(s.realisedPence)).toBe(Math.sign(valueAt(t, 20) - 100_000));
  });
});

describe('backtest', () => {
  it('reports the real year: Bitcoin swung far more than cash', () => {
    const bt = backtest(BASKETS[0].lines, 20_000, 2500);
    expect(bt.bitcoin.metrics.volatilityPct).toBeGreaterThan(bt.cash.metrics.volatilityPct * 5);
    expect(bt.bitcoin.metrics.maxDrawdownPct).toBeLessThan(-40);
    expect(bt.plan.paidInPence).toBe(20_000 + 52 * 2500);
  });
});

describe('currency', () => {
  it('formats the GBP base in any currency, and typed amounts convert back', () => {
    setRatesForTest({ SGD: 1.7, EUR: 1.2 });
    expect(money(120_000, 'SGD')).toBe('S$2,040');
    expect(money(120_000, 'EUR')).toBe('€1,440');
    expect(toBasePence(2040, 'SGD')).toBe(120_000);
  });
});

describe('engine semantics', () => {
  it('rule order does not change the determination', () => {
    const snap = decideOnboarding({ ...sarah, age: 17, highInterestDebt: true }).snapshot;
    const a = evaluate(PACKS.UK, 'onboarding', snap);
    const b = evaluate({ ...PACKS.UK, rules: [...PACKS.UK.rules].reverse() }, 'onboarding', snap);
    expect(b.outcome).toBe(a.outcome);
    expect(b.findings.map((f) => f.rule_id).sort()).toEqual(a.findings.map((f) => f.rule_id).sort());
  });
});

describe('evidence chain', () => {
  it('detects an edited record', async () => {
    const chain: ChainEntry[] = [];
    for (const n of [1, 2, 3]) chain.push(await append(chain, { n }, `2026-10-07T10:0${n}:00Z`));
    expect(await verify(chain)).toBeNull();
    chain[1] = { ...chain[1], body: { n: 99 } };
    expect(await verify(chain)).toBe(2);
  });
});
