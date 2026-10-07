import { describe, expect, it } from 'vitest';
import { evaluate, validatePack } from './engine/evaluate';
import { append, verify, type ChainEntry } from './engine/chain';
import { PACKS, PACK_UPDATES } from './packs';
import { checkPurchase, decideOnboarding, EMPTY_PROFILE, resolveBasket, checkLine, type Profile } from './decide';
import { BASKETS, worstCase } from './catalog';

const sarah: Profile = {
  ...EMPTY_PROFILE, name: 'Sarah', age: 34, country: 'GB', taxCountry: 'GB',
  incomeMonthly: 3200, spendMonthly: 2100, emergencyMonths: 4, highInterestDebt: false, savings: 24_000,
  goal: 'long_term', horizonYears: 10, attitude: 'balanced', fallReaction: 'hurt', vulnerability: false,
  knowledgeScore: 5, knowledgeLevel: 1,
};

describe('packs', () => {
  it('every pack and every update validates', () => {
    for (const p of [...Object.values(PACKS), ...Object.values(PACK_UPDATES).map((u) => u.pack)]) {
      expect(validatePack(p)).toEqual([]);
    }
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
    const r = decideOnboarding({ ...sarah, fallReaction: 'need', highInterestDebt: true });
    expect(r.outcome).toBe('NOT_FOR_YOU');
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
    expect(decideOnboarding({ ...sarah, country: 'US', taxCountry: 'US' }).outcome).toBe('REFER');
  });

  it('a course not taken blocks as "not yet"', () => {
    expect(decideOnboarding({ ...sarah, knowledgeScore: null }).outcome).toBe('NOT_YET');
  });

  it('Singapore caps the same person lower than the UK', () => {
    const sg = decideOnboarding({ ...sarah, country: 'SG', taxCountry: 'SG', fallReaction: 'fine' });
    const uk = decideOnboarding({ ...sarah, fallReaction: 'fine' });
    expect(sg.limitBps).toBe(500);
    expect(uk.limitBps).toBe(1000);
  });

  it('the regulator update flips a 4-month buffer to "not yet"', () => {
    const r = decideOnboarding(sarah, PACK_UPDATES.UK.pack);
    expect(r.outcome).toBe('NOT_YET');
  });
});

describe('baskets', () => {
  const steady = BASKETS.find((b) => b.id === 'steady')!;
  const gold = BASKETS.find((b) => b.id === 'digital_gold')!;

  it('UK: Steady is not offered (gold and T-bills await a legal opinion)', () => {
    expect(resolveBasket(PACKS.UK, sarah, steady.lines).available).toBe(false);
  });

  it('SG: Digital Gold drops gold and rebalances to 100%', () => {
    const r = resolveBasket(PACKS.SG, sarah, gold.lines);
    expect(r.available).toBe(true);
    expect(r.lines.map((l) => l.asset).sort()).toEqual(['BTC', 'TBILL']);
    expect(r.lines.reduce((s, l) => s + l.weight_bps, 0)).toBe(10_000);
    expect(r.removed[0].asset).toBe('GOLD');
  });

  it('Solana is locked below Level 2 and capped at 10% above it', () => {
    expect(checkLine(PACKS.UK, sarah, 'SOL', 500).determination.findings[0].reason_code).toBe('LEVEL_LOCKED');
    const l2 = { ...sarah, knowledgeLevel: 2 };
    expect(checkLine(PACKS.UK, l2, 'SOL', 1000).determination.outcome).toBe('ALLOW');
    expect(checkLine(PACKS.UK, l2, 'SOL', 1001).determination.findings[0].reason_code).toBe('WEIGHT_CAP');
  });

  it('leverage is never offered', () => {
    const codes = checkLine(PACKS.UK, { ...sarah, knowledgeLevel: 3 }, 'BTC3L', 100).determination.findings.map((f) => f.reason_code);
    expect(codes).toContain('LEVERAGE');
  });

  it('worst case matches the two-pager (Digital Gold: £1,000 → about £480)', () => {
    expect(worstCase(gold.lines)).toBeGreaterThan(470);
    expect(worstCase(gold.lines)).toBeLessThan(500);
  });
});

describe('purchase', () => {
  it('UK first purchase waits for the 24h cooling-off', () => {
    const d = checkPurchase(PACKS.UK, sarah, { amountPence: 2500, heldPence: 0, priorPurchases: 0, coolingOffComplete: false });
    expect(d.findings.map((f) => f.reason_code)).toEqual(['COOLING_OFF']);
  });

  it('SG has no cooling-off rule', () => {
    const p = { ...sarah, country: 'SG', taxCountry: 'SG' };
    expect(checkPurchase(PACKS.SG, p, { amountPence: 2500, heldPence: 0, priorPurchases: 0, coolingOffComplete: false }).outcome).toBe('ALLOW');
  });

  it('a buy that crosses the personal limit is blocked; exactly at it passes', () => {
    const at = checkPurchase(PACKS.UK, sarah, { amountPence: 2500, heldPence: 117_500, priorPurchases: 3, coolingOffComplete: true });
    const over = checkPurchase(PACKS.UK, sarah, { amountPence: 2501, heldPence: 117_500, priorPurchases: 3, coolingOffComplete: true });
    expect(at.outcome).toBe('ALLOW');
    expect(over.findings[0].reason_code).toBe('OVER_LIMIT');
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
