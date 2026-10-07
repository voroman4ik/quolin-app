'use client';

import { useState } from 'react';
import { CURRENCIES } from '@/lib/catalog';
import { COUNTRIES } from '@/lib/packs';
import type { Profile } from '@/lib/decide';
import { useDemo } from '../demo-state';
import { Back, Choice, Progress, Wordmark } from '../ui';

export function Welcome() {
  const { s, go, set } = useDemo();
  return (
    <>
      <div className="phone-scroll">
        <div style={{ marginTop: 28 }}><Wordmark brand={s.brand} /></div>
        <h1 className="h1" style={{ fontSize: 38, marginTop: 40 }}>Crypto, the careful way.</h1>
        <p className="muted" style={{ fontSize: 16 }}>
          {s.brand === 'northbank' ? 'Northbank' : 'Your bank'} now offers crypto, built for people who don’t
          trust it yet. We start the way an adviser would: by getting to know you.
        </p>
        <div className="card" style={{ marginTop: 26 }}>
          {[
            ['Gets to know you first', 'A short fact-find, then a 5-minute course. No jargon.'],
            ['Tells you how much is sensible', 'A personal limit, sized to what you could afford to lose.'],
            ['Money only goes back to your bank', 'No wallets to lose, no seed phrase, a helpline that answers.'],
          ].map(([t, d]) => (
            <div className="reason" key={t}>
              <span className="mark ok">✓</span>
              <div><div className="h3">{t}</div><div className="small muted">{d}</div></div>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 16 }}>
          Crypto can fall a long way and isn’t covered by deposit protection. Your coins are held by a regulated
          custodian, separate from our own money.
        </p>
      </div>
      <div className="phone-foot">
        <button className="btn" onClick={() => { set({ factStep: 0 }); go('factfind'); }}>Let’s get to know you</button>
        <p className="tiny muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>About 6 minutes · nothing is bought</p>
      </div>
    </>
  );
}

const STEPS = ['About you', 'Your money', 'What it’s for', 'Risk and loss'];

export function FactFind() {
  const { s, set, go, setProfile } = useDemo();
  const p = s.profile;
  const step = s.factStep;
  const rate = CURRENCIES[s.currency].rate;
  const sym = CURRENCIES[s.currency].symbol;
  // "Prefer not to say" is an answer, recorded as unknown, so the engine refers rather than assumes.
  const [vulnAnswered, setVulnAnswered] = useState(p.vulnerability !== null);

  const toGBP = (v: string) => Math.max(0, Math.round((Number(v.replace(/[^0-9.]/g, '')) || 0) / rate));
  const show = (gbp: number) => (gbp ? String(Math.round(gbp * rate)) : '');

  const complete: boolean[] = [
    !!p.name.trim() && p.age !== null && p.age > 0,
    p.emergencyMonths !== null && p.highInterestDebt !== null && p.savings > 0,
    !!p.goal && p.horizonYears !== null,
    p.attitude !== null && p.fallReaction !== null && vulnAnswered,
  ];

  const next = () => (step < 3 ? set({ factStep: step + 1 }) : go('course'));
  const prev = () => (step > 0 ? set({ factStep: step - 1 }) : go('welcome'));
  const pick = <K extends keyof Profile>(k: K) => (v: Profile[K]) => setProfile({ [k]: v } as Partial<Profile>);

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={prev} />
        <Progress step={step + 1} of={6} />
        <div className="eyebrow">Step {step + 1} of 6 · {STEPS[step]}</div>

        {step === 0 && (
          <>
            <h2 className="h2">Let’s get to know you</h2>
            <p className="muted small">Like a conversation with an adviser. Your answers decide what we offer you, and we’ll show you why.</p>
            <label className="field"><span>First name</span>
              <input className="input" value={p.name} onChange={(e) => setProfile({ name: e.target.value })} autoComplete="given-name" />
            </label>
            <label className="field"><span>Age</span>
              <input className="input" inputMode="numeric" value={p.age ?? ''}
                onChange={(e) => setProfile({ age: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} />
            </label>
            <label className="field"><span>Where do you live?</span>
              <select className="select" value={p.country}
                onChange={(e) => setProfile({ country: e.target.value, taxCountry: e.target.value })}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Where do you pay tax? <span className="hint">· usually the same</span></span>
              <select className="select" value={p.taxCountry} onChange={(e) => setProfile({ taxCountry: e.target.value })}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <div className="field"><span>Anyone who depends on you financially?</span>
              <div className="choices four">
                {[0, 1, 2, 3].map((n) => (
                  <Choice key={n} compact value={n} current={p.dependants} onPick={pick('dependants')} label={n === 3 ? '3+' : String(n)} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="h2">Your money</h2>
            <p className="muted small">Rough numbers are fine. This is how we work out what you could afford to lose.</p>
            {([['incomeMonthly', 'Take-home pay a month'], ['spendMonthly', 'Spending a month'], ['savings', 'Savings and investments, in total']] as const).map(([k, label]) => (
              <label className="field" key={k}><span>{label}</span>
                <div className="money-input"><b>{sym}</b>
                  <input className="input num" inputMode="numeric" value={show(p[k])} onChange={(e) => setProfile({ [k]: toGBP(e.target.value) })} />
                </div>
              </label>
            ))}
            <div className="field"><span>How many months of spending could your cash savings cover?</span>
              <div className="choices four">
                {([[0, 'None'], [2, '1–2'], [4, '3–5'], [6, '6+']] as const).map(([v, l]) => (
                  <Choice key={v} compact value={v} current={p.emergencyMonths} onPick={pick('emergencyMonths')} label={l} />
                ))}
              </div>
            </div>
            <div className="field"><span>Any credit card or overdraft debt you don’t clear each month?</span>
              <div className="choices two">
                <Choice compact value={false} current={p.highInterestDebt} onPick={pick('highInterestDebt')} label="No" />
                <Choice compact value={true} current={p.highInterestDebt} onPick={pick('highInterestDebt')} label="Yes" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="h2">What’s it for?</h2>
            <p className="muted small">There’s no wrong answer. It helps us pick what fits.</p>
            <div className="field"><span>Why are you interested in crypto?</span>
              <div className="choices">
                <Choice value="long_term" current={p.goal} onPick={pick('goal')} label="A small long-term holding" sub="Alongside my pension and savings" />
                <Choice value="hedge" current={p.goal} onPick={pick('goal')} label="Something outside the banking system" sub="A hedge against inflation or currency" />
                <Choice value="curious" current={p.goal} onPick={pick('goal')} label="I’m curious and want to learn" sub="With a small amount" />
                <Choice value="quick" current={p.goal} onPick={pick('goal')} label="To make money quickly" />
              </div>
            </div>
            {p.goal === 'quick' && (
              <div className="card tint small" style={{ marginTop: 10 }}>
                Honest answer: crypto is a poor way to make money quickly. It can halve in a month. We’ll show you a slower way.
              </div>
            )}
            <div className="field"><span>When might you need this money back?</span>
              <div className="choices four">
                {([[0, '< 1 yr'], [2, '1–3 yrs'], [4, '3–5 yrs'], [7, '5+ yrs']] as const).map(([v, l]) => (
                  <Choice key={v} compact value={v} current={p.horizonYears} onPick={pick('horizonYears')} label={l} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="h2">Risk, honestly</h2>
            <div className="field"><span>If this fell 50% next year, would it change your plans?</span>
              <div className="choices">
                <Choice value="need" current={p.fallReaction} onPick={pick('fallReaction')} label="Yes, I’d need that money" />
                <Choice value="hurt" current={p.fallReaction} onPick={pick('fallReaction')} label="It would hurt, but I’d be fine" />
                <Choice value="fine" current={p.fallReaction} onPick={pick('fallReaction')} label="No, it’s money I can lose" />
              </div>
            </div>
            <div className="field"><span>How would you describe yourself with money?</span>
              <div className="choices four" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <Choice compact value="cautious" current={p.attitude} onPick={pick('attitude')} label="Cautious" />
                <Choice compact value="balanced" current={p.attitude} onPick={pick('attitude')} label="Balanced" />
                <Choice compact value="adventurous" current={p.attitude} onPick={pick('attitude')} label="Adventurous" />
              </div>
            </div>
            <div className="field"><span>Is anything making money decisions harder right now?</span>
              <span className="hint small" style={{ display: 'block', marginBottom: 8 }}>
                For example illness, a bereavement, losing a job, or someone pressuring you.
              </span>
              <div className="choices four" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <button type="button" className="choice compact" aria-pressed={vulnAnswered && p.vulnerability === false}
                  onClick={() => { setVulnAnswered(true); setProfile({ vulnerability: false }); }}>No</button>
                <button type="button" className="choice compact" aria-pressed={vulnAnswered && p.vulnerability === true}
                  onClick={() => { setVulnAnswered(true); setProfile({ vulnerability: true }); }}>Yes</button>
                <button type="button" className="choice compact" aria-pressed={vulnAnswered && p.vulnerability === null}
                  onClick={() => { setVulnAnswered(true); setProfile({ vulnerability: null }); }}>Rather not say</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={!complete[step]} onClick={next}>
          {step < 3 ? 'Continue' : 'Next: learn to unlock'}
        </button>
      </div>
    </>
  );
}
