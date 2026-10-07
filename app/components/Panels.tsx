'use client';

import { useSyncExternalStore } from 'react';
import { CURRENCIES, type Currency } from '@/lib/catalog';
import type { Profile } from '@/lib/decide';
import { loadChain, subscribe, type LedgerBody } from '@/lib/ledger';
import { COUNTRIES, PACKS, type Jurisdiction } from '@/lib/packs';
import { SARAH } from '@/lib/personas';
import type { ChainEntry } from '@/lib/engine/chain';
import { INITIAL, resetDemoState, useDemo, type DemoState, type Screen } from './demo-state';
import { OutcomePill } from './ui';

const STEPS: { title: string; note: string; screens: Screen[] }[] = [
  { title: 'Open', note: 'Crypto, the careful way', screens: ['welcome'] },
  { title: 'Fact-find', note: 'Like an adviser: you, money, goals, risk', screens: ['factfind'] },
  { title: 'Learn to unlock', note: 'The regulator’s test, as a course', screens: ['course'] },
  { title: 'Your limit', note: 'The app that tells you to invest less', screens: ['result'] },
  { title: 'Baskets', note: 'What-it’s-for and worst-year cards', screens: ['baskets', 'basket', 'plan'] },
  { title: 'Build your own', note: 'Locked, capped, explained', screens: ['build', 'course2'] },
  { title: 'Calm', note: 'A 30% fall, met with context', screens: ['home', 'withdraw'] },
];

const OUTCOME_PERSONAS: { label: string; profile: Partial<Profile> }[] = [
  { label: '✓ Allow', profile: {} },
  { label: '◷ Not yet · card debt', profile: { name: 'James', highInterestDebt: true } },
  { label: '⟳ Refer · bereaved', profile: { name: 'Margaret', age: 71, vulnerability: true } },
  { label: '✕ Not for you · needs it', profile: { name: 'Tom', age: 19, fallReaction: 'need' } },
];

export function Guide() {
  const { s, set } = useDemo();
  const current = STEPS.findIndex((st) => st.screens.includes(s.screen));
  const keepPlace = { country: s.profile.country, taxCountry: s.profile.country };
  const sarah = { ...SARAH, ...keepPlace };

  const jump = (i: number) => {
    const patches: Partial<DemoState>[] = [
      { screen: 'welcome' },
      { screen: 'factfind', factStep: 0, profile: { ...sarah, knowledgeScore: null, knowledgeLevel: 0 } },
      { screen: 'course', profile: { ...sarah, knowledgeScore: null, knowledgeLevel: 0 } },
      { screen: 'result', profile: { ...sarah, knowledgeLevel: Math.max(1, s.profile.knowledgeLevel) } },
      { screen: 'baskets', profile: { ...sarah, knowledgeLevel: Math.max(1, s.profile.knowledgeLevel) } },
      { screen: 'build', profile: { ...sarah, knowledgeLevel: 2 } },
      {
        screen: 'home', profile: { ...sarah, knowledgeLevel: Math.max(1, s.profile.knowledgeLevel) }, weeks: 26, market: 'crash',
        coolingOffDone: true, sellPendingUntil: null,
        plan: s.plan ?? { name: 'Core', lines: [{ asset: 'BTC', weight_bps: 7000 }, { asset: 'ETH', weight_bps: 3000 }], weeklyPence: 2500, startedAt: new Date(Date.now() - 182 * 86400_000).toISOString(), firstBuyAt: null },
      },
    ];
    set(patches[i]);
  };

  return (
    <aside className="side guide">
      <div className="panel">
        <h2>Demo guide</h2>
        <p className="small muted" style={{ margin: 0 }}>One person’s journey, about 4 minutes. Jump to any step; the app fills in Sarah’s answers.</p>
        <ol className="steps">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <button aria-current={i === current ? 'step' : undefined} onClick={() => jump(i)}>
                <b>{st.title}</b><small>{st.note}</small>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => window.open('/bank', 'quolin-bank')}>
              <b>Bank view ↗</b><small>Every decision, its reasons and the evidence chain</small>
            </button>
          </li>
        </ol>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 16 }}>Show each outcome</h2>
        <div className="ctl" style={{ gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {OUTCOME_PERSONAS.map((p) => (
            <button key={p.label} className="btn secondary small" style={{ width: '100%', margin: 0 }}
              onClick={() => set({ screen: 'result', profile: { ...sarah, ...p.profile } })}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 style={{ fontSize: 16 }}>Settings</h2>
        <div className="ctl">
          <label>Lives in (picks the rule pack)
            <select className="select" value={s.profile.country}
              onChange={(e) => set((prev) => ({ profile: { ...prev.profile, country: e.target.value, taxCountry: e.target.value } }))}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}{c.pack ? ` · ${c.pack} pack` : ' · no pack'}</option>)}
            </select>
          </label>
          <label>Display currency
            <select className="select" value={s.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
              {Object.keys(CURRENCIES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Brand
            <select className="select" value={s.brand} onChange={(e) => set({ brand: e.target.value as DemoState['brand'] })}>
              <option value="quolin">Quolin (own brand)</option>
              <option value="northbank">Northbank (white-label)</option>
            </select>
          </label>
          <button className="btn ghost small" onClick={() => { resetDemoState(); set({ ...INITIAL, currency: s.currency, brand: s.brand }); }}>Reset the app</button>
        </div>
      </div>
    </aside>
  );
}

const EMPTY = '[]';
const getChain = () => JSON.stringify(loadChain());

function ruleTitle(packId: string | null, id: string) {
  const pack = packId ? PACKS[packId as Jurisdiction] : null;
  return pack?.rules.find((r) => r.rule_id === id)?.title ?? id;
}

export function UnderTheHood() {
  const raw = useSyncExternalStore(subscribe, getChain, () => EMPTY);
  const chain = JSON.parse(raw) as ChainEntry<LedgerBody>[];
  const last = [...chain].reverse().find((e) => e.body.source === 'app');
  const b = last?.body;
  const d = b?.determination;

  return (
    <aside className="side hood">
      <div className="panel trace">
        <div className="between"><h2>Under the hood</h2><span className="pill dark">engine</span></div>
        {!b ? (
          <p className="small muted" style={{ marginTop: 8 }}>Each decision the app makes appears here: the rules it ran, what it read, and its place in the evidence chain.</p>
        ) : (
          <>
            <div className="between" style={{ marginTop: 10 }}>
              <span className="small"><b>{b.kind.replace('_', ' ')}</b> · {b.client_name}</span>
              <OutcomePill outcome={b.outcome} />
            </div>
            <div className="tiny muted" style={{ margin: '4px 0 8px' }}>
              {b.pack_id ? `${b.pack_id} pack v${b.pack_version} · illustrative` : 'No pack'} · #{last!.seq} · {new Date(last!.at).toLocaleTimeString('en-GB')}
            </div>
            {d && (
              <>
                {d.findings.map((f) => (
                  <div className="rule" key={f.rule_id}>
                    <span className={`mark ${f.outcome === 'BLOCK' ? 'no' : 'wait'}`}>{f.outcome === 'BLOCK' ? '✕' : '?'}</span>
                    <span><code>{f.rule_id}</code> {f.title}<br /><span className="muted">{f.outcome} · {f.reason_code}{f.missing_field ? ` · missing ${f.missing_field}` : ''}</span></span>
                  </div>
                ))}
                {d.rules_passed.map((id) => (
                  <div className="rule" key={id}><span className="mark ok">✓</span><span><code>{id}</code> {ruleTitle(b.pack_id, id)}</span></div>
                ))}
                {d.rules_not_applicable.map((id) => (
                  <div className="rule" key={id}><span className="mark na">–</span><span className="muted"><code>{id}</code> not applicable</span></div>
                ))}
                <details style={{ marginTop: 10 }}>
                  <summary className="small" style={{ cursor: 'pointer' }}>Inputs read</summary>
                  <pre className="json" style={{ marginTop: 6 }}>{JSON.stringify(d.inputs_read, null, 1)}</pre>
                </details>
              </>
            )}
            {!d && b.summary && <p className="small" style={{ marginTop: 6 }}>{b.summary}</p>}
            <div style={{ marginTop: 12 }}>
              <div className="tiny muted">hash</div><div className="hash">{last!.hash}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>previous</div><div className="hash">{last!.prev_hash}</div>
            </div>
          </>
        )}
      </div>
      <div className="panel small">
        <b>{chain.length}</b> decisions on the chain.{' '}
        <a href="/bank" target="quolin-bank">Open the bank console ↗</a>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>All rule packs are illustrative and not reviewed. Prices and returns are illustrative.</p>
      </div>
    </aside>
  );
}
