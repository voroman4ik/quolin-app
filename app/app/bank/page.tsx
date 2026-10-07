'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ASSETS, ASSET_IDS, money, type Currency } from '@/lib/catalog';
import { consumerOutcome, decideOnboarding, jurisdictionOf, personalLimit, type ConsumerOutcome } from '@/lib/decide';
import { getRates, subscribeFx } from '@/lib/fx';
import { canonical, verify, type ChainEntry } from '@/lib/engine/chain';
import { evaluate } from '@/lib/engine/evaluate';
import type { Pack } from '@/lib/engine/types';
import {
  activePack, clearChain, loadChain, packVersions, record, saveChain, setPackVersion, subscribe, type LedgerBody,
} from '@/lib/ledger';
import { JURISDICTIONS, PACKS, PACK_UPDATES, type Jurisdiction } from '@/lib/packs';
import { SEED_CLIENTS } from '@/lib/personas';
import { Coin, OutcomePill } from '@/components/ui';

type Entry = ChainEntry<LedgerBody>;

const packAt = (j: Jurisdiction, v: number): Pack => (v === 2 ? PACK_UPDATES[j].pack : PACKS[j]);
/** Limits are shown in the client's home currency, converted from the GBP base at today's rate. */
const local = (p: number, packId: string | null) =>
  money(p, ((packId && PACKS[packId as Jurisdiction]?.local.home_currency) || 'GBP') as Currency);

// Effects run twice in development; seeding must happen once per empty chain.
let seeding: Promise<void> | null = null;

function seed(): Promise<void> {
  seeding ??= seedOnce().finally(() => { seeding = null; });
  return seeding;
}

async function seedOnce() {
  if (loadChain().some((e) => e.body.source === 'seed')) return;
  for (const c of SEED_CLIENTS) {
    const j = jurisdictionOf(c.profile.country);
    const pack = j ? activePack(j) : null;
    const r = decideOnboarding(c.profile, pack);
    await record({
      kind: 'onboarding', client_id: c.id, client_name: c.profile.name, jurisdiction: pack?.jurisdiction_name ?? c.profile.country,
      pack_id: pack?.pack_id ?? null, pack_version: pack?.version ?? null, outcome: r.outcome, summary: pack ? '' : r.reasons[0].title,
      reasons: r.reasons, limit_pence: r.limitPence, snapshot: r.snapshot, determination: r.determination, source: 'seed',
    });
  }
}

const getChain = () => JSON.stringify(loadChain());
const getVersions = () => JSON.stringify(packVersions());
const VERSIONS_SSR = JSON.stringify({ UK: 1, SG: 1, EU: 1, HK: 1, AU: 1, MY: 1, US: 1 });

interface Flip { client: string; id: string; before: string; after: string; limitBefore: number; limitAfter: number }

export default function BankConsole() {
  const raw = useSyncExternalStore(subscribe, getChain, () => '[]');
  const versionsRaw = useSyncExternalStore(subscribe, getVersions, () => VERSIONS_SSR);
  const chain = useMemo(() => JSON.parse(raw) as Entry[], [raw]);
  const versions = JSON.parse(versionsRaw) as Record<Jurisdiction, number>;
  useSyncExternalStore(subscribeFx, getRates, getRates);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'refer'>('all');
  const [broken, setBroken] = useState<number | null | 'checking'>('checking');
  const [tamperBackup, setTamperBackup] = useState<Entry[] | null>(null);
  const [impact, setImpact] = useState<{ j: Jurisdiction; flips: Flip[]; checked: number } | null>(null);
  const [replay, setReplay] = useState<string | null>(null);
  const [packView, setPackView] = useState<Jurisdiction>('SG');

  useEffect(() => {
    if (!loadChain().some((e) => e.body.source === 'seed')) void seed();
  }, []);

  useEffect(() => {
    let live = true;
    setBroken('checking');
    void verify(chain).then((r) => live && setBroken(r));
    return () => { live = false; };
  }, [chain]);

  // Latest decision per client: the book as it stands.
  const book = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of chain) if (e.body.kind === 'onboarding' || e.body.kind === 'replay') m.set(e.body.client_id, e);
    return [...m.values()];
  }, [chain]);
  const count = (o: ConsumerOutcome) => book.filter((e) => e.body.outcome === o).length;

  const rows = [...chain].reverse().filter((e) => filter === 'all' || e.body.outcome === 'REFER');
  const sel = chain.find((e) => e.seq === selected) ?? null;

  const publish = async (j: Jurisdiction) => {
    const before = packAt(j, versions[j]);
    const after = PACK_UPDATES[j].pack;
    setPackVersion(j, 2);
    const flips: Flip[] = [];
    const affected = book.filter((e) => e.body.pack_id === j && e.body.snapshot);
    for (const e of affected) {
      const d = evaluate(after, 'onboarding', e.body.snapshot!);
      // Rebuild the consumer view from the stored snapshot, not from anyone's live answers.
      const r = decideOnboardingFromSnapshot(after, e.body.snapshot!, d);
      if (r.outcome !== e.body.outcome || r.limitPence !== (e.body.limit_pence ?? 0)) {
        flips.push({ client: e.body.client_name, id: e.body.client_id, before: e.body.outcome, after: r.outcome,
          limitBefore: e.body.limit_pence ?? 0, limitAfter: r.limitPence });
      }
      await record({
        ...e.body, kind: 'replay', pack_version: after.version, outcome: r.outcome, reasons: r.reasons,
        limit_pence: r.limitPence, determination: d, source: 'console',
        summary: `Re-assessed under ${j} v${after.version} (was v${before.version}: ${e.body.outcome})`,
      });
    }
    setImpact({ j, flips, checked: affected.length });
  };

  const revert = (j: Jurisdiction) => { setPackVersion(j, 1); setImpact(null); };

  const tamper = () => {
    const c = loadChain();
    const target = c.find((e) => e.body.outcome !== 'ALLOW' && e.body.kind === 'onboarding') ?? c[0];
    if (!target) return;
    setTamperBackup(c);
    saveChain(c.map((e) => (e.seq === target.seq ? { ...e, body: { ...e.body, outcome: 'ALLOW', reasons: [] } } : e)));
    setSelected(target.seq);
  };

  const doReplay = (e: Entry) => {
    if (!e.body.snapshot || !e.body.determination || !e.body.pack_id) return;
    const pack = packAt(e.body.pack_id as Jurisdiction, e.body.pack_version ?? 1);
    const again = evaluate(pack, e.body.determination.stage, e.body.snapshot);
    setReplay(canonical(again) === canonical(e.body.determination)
      ? `✓ Reproduced: ${pack.pack_id} v${pack.version} gives the same determination, rule for rule.`
      : '✕ Does not reproduce. Treat as tampering.');
  };

  const reset = async () => {
    clearChain();
    for (const j of JURISDICTIONS) setPackVersion(j.id, 1);
    setImpact(null); setTamperBackup(null); setSelected(null);
    await seed();
  };

  const pv = packAt(packView, versions[packView]);

  return (
    <div className="console">
      <div className="console-top">
        <div className="row" style={{ gap: 14 }}>
          <span className="wordmark" style={{ color: '#fff' }}>Northbank<i>.</i></span>
          <span className="small" style={{ color: '#b9c2c9' }}>Crypto compliance console · powered by Quolin</span>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <a href="/">← Customer app</a>
          <button className="btn small secondary" onClick={reset}>Reset console</button>
        </div>
      </div>
      <div className="banner">Illustrative rule packs, not professionally reviewed. Fictional bank and clients.</div>

      <div className="console-main">
        <h1 className="h1" style={{ fontSize: 28, margin: 0 }}>Every decision, with its reasons</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          The bank owns every rule and every client decision. Quolin records each one so it can be replayed years later.
        </p>

        <div className="kpis">
          <div className="kpi"><b>{book.length}</b><span>Clients assessed</span></div>
          <div className="kpi"><b style={{ color: 'var(--allow)' }}>{count('ALLOW')}</b><span>Allow</span></div>
          <div className="kpi"><b style={{ color: 'var(--notyet)' }}>{count('NOT_YET')}</b><span>Not yet</span></div>
          <div className="kpi"><b style={{ color: 'var(--refer)' }}>{count('REFER')}</b><span>Refer to a person</span></div>
          <div className="kpi"><b style={{ color: 'var(--block)' }}>{count('NOT_FOR_YOU')}</b><span>Not for you</span></div>
          <div className="kpi">
            <b style={{ color: broken === null ? 'var(--allow)' : broken === 'checking' ? 'var(--muted)' : 'var(--block)' }}>
              {broken === null ? '✓' : broken === 'checking' ? '…' : '✕'}
            </b>
            <span>{broken === null ? `Chain intact · ${chain.length} records` : broken === 'checking' ? 'Verifying' : `Chain broken at #${broken}`}</span>
          </div>
        </div>

        <div className="console-grid">
          <section>
            <div className="between" style={{ marginBottom: 10 }}>
              <h2 className="h2" style={{ margin: 0 }}>Decision record</h2>
              <div className="seg">
                <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
                <button aria-pressed={filter === 'refer'} onClick={() => setFilter('refer')}>Refer queue · {chain.filter((e) => e.body.outcome === 'REFER').length}</button>
              </div>
            </div>
            <div className="table-wrap card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="t">
                <thead><tr><th>#</th><th>Client</th><th>What</th><th>Rules</th><th>Outcome</th><th>Limit</th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.seq} className={`${e.seq === selected ? 'sel' : ''} ${e.body.kind === 'replay' ? 'flip' : ''}`}
                      onClick={() => { setSelected(e.seq); setReplay(null); }}>
                      <td className="num muted">{e.seq}</td>
                      <td><b>{e.body.client_name}</b><br /><span className="tiny muted">{e.body.client_id}{e.body.source === 'app' ? ' · live' : ''}</span></td>
                      <td className="small">{e.body.kind.replace('_', ' ')}{e.body.summary && e.body.kind !== 'onboarding' ? <><br /><span className="tiny muted">{e.body.summary}</span></> : null}</td>
                      <td className="small num nowrap">{e.body.pack_id ? `${e.body.pack_id} v${e.body.pack_version}` : '—'}</td>
                      <td><OutcomePill outcome={e.body.outcome} /></td>
                      <td className="small num">{e.body.limit_pence ? local(e.body.limit_pence, e.body.pack_id) : '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="muted small">Nothing here.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            {sel ? (
              <div className="card">
                <div className="between">
                  <div><div className="eyebrow">Record #{sel.seq} · {sel.body.kind.replace('_', ' ')}</div><h2 className="h2" style={{ margin: '2px 0 0' }}>{sel.body.client_name}</h2></div>
                  <OutcomePill outcome={sel.body.outcome} />
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {sel.body.jurisdiction ?? 'No jurisdiction'} · {sel.body.pack_id ? `rule pack ${sel.body.pack_id} v${sel.body.pack_version}` : 'no rule pack'} · {new Date(sel.at).toLocaleString('en-GB')}
                </div>
                {sel.body.summary && <p className="small" style={{ marginTop: 8 }}>{sel.body.summary}</p>}

                <div style={{ marginTop: 12 }}>
                  {sel.body.reasons.length === 0 && sel.body.determination && <p className="small">Every applicable rule passed.</p>}
                  {sel.body.reasons.map((r) => (
                    <div className="reason" key={r.rule_id + r.title}>
                      <span className="mark no">✕</span>
                      <div><b className="small">{r.title}</b> <code className="mono muted">{r.rule_id}</code><div className="small muted">{r.plain_english}</div></div>
                    </div>
                  ))}
                  {sel.body.determination?.rules_passed.map((id) => (
                    <div className="reason" key={id}><span className="mark ok">✓</span><div className="small">{PACKS[sel.body.pack_id as Jurisdiction]?.rules.find((r) => r.rule_id === id)?.title} <code className="mono muted">{id}</code></div></div>
                  ))}
                </div>

                {sel.body.determination && (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn small" onClick={() => doReplay(sel)}>Replay this decision</button>
                    {replay && <p className="small" style={{ marginTop: 8, color: replay.startsWith('✓') ? 'var(--allow)' : 'var(--block)' }}>{replay}</p>}
                  </div>
                )}
                {sel.body.snapshot && (
                  <details style={{ marginTop: 12 }}>
                    <summary className="small" style={{ cursor: 'pointer' }}>Frozen snapshot the rules read</summary>
                    <pre className="json" style={{ marginTop: 6 }}>{JSON.stringify(sel.body.snapshot, null, 1)}</pre>
                  </details>
                )}
                <div style={{ marginTop: 12 }}>
                  <div className="tiny muted">hash</div><div className="hash">{sel.hash}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>previous</div><div className="hash">{sel.prev_hash}</div>
                </div>
              </div>
            ) : (
              <div className="card"><p className="small muted" style={{ margin: 0 }}>Select a decision to see its reasons, the rules it ran and its place in the chain. Decisions made in the customer app appear here live.</p></div>
            )}

            <div className="card">
              <div className="pack-head">
                <h2 className="h2" style={{ margin: 0, fontSize: 19 }}>Rule packs</h2>
                <div className="seg wrap">
                  {JURISDICTIONS.map((j) => <button key={j.id} aria-pressed={packView === j.id} onClick={() => setPackView(j.id)}>{j.id} v{versions[j.id]}</button>)}
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>{pv.regulator}. {pv.notes}</p>
              <table className="t" style={{ marginTop: 8 }}>
                <tbody>
                  {([
                    ['Personal cap', `${(pv.thresholds.max_crypto_concentration_bps as number) / 100}% of savings`],
                    ['Emergency fund', `${pv.thresholds.min_emergency_fund_months} months`],
                    ['Course pass mark', `${pv.thresholds.knowledge_pass_mark} of 5`],
                    ['Non-core asset cap', `${(pv.thresholds.max_noncore_weight_bps as number) / 100}% of a basket`],
                    ['Cooling-off', pv.rules.some((r) => r.reason_code === 'COOLING_OFF') ? '24h before first purchase' : 'None'],
                    ['Home currency', pv.local.home_currency],
                    ['Local rules', pv.rules.filter((r) => r.rule_id.startsWith(pv.pack_id + '-')).map((r) => `${r.rule_id}: ${r.title}`).join(' · ') || 'None'],
                    ['Asks in fact-find', pv.local.questions.map((q) => q.label).join(' · ') || 'Nothing extra'],
                    ['Disclosures', pv.local.disclosures.map((d) => d.label).join(' · ') || 'None'],
                  ] as const).map(([k, v]) => <tr key={k} style={{ cursor: 'default' }}><td className="muted">{k}</td><td className="small">{v}</td></tr>)}
                </tbody>
              </table>
              <div style={{ marginTop: 12 }}>
                {versions[packView] === 1 ? (
                  <>
                    <div className="small"><b>Regulator update available</b> (illustrative):</div>
                    <ul className="small" style={{ margin: '4px 0 10px', paddingLeft: 18 }}>
                      {PACK_UPDATES[packView].summary.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                    <button className="btn small" onClick={() => publish(packView)}>Sign and publish {packView} v2</button>
                  </>
                ) : (
                  <button className="btn small secondary" onClick={() => revert(packView)}>Revert to {packView} v1</button>
                )}
              </div>
              {impact && impact.j === packView && (
                <div className="verdict refer small" style={{ marginTop: 12, padding: 12 }}>
                  <b>Book re-assessed: {impact.checked} clients, {impact.flips.length} changed.</b>
                  {impact.flips.map((f) => (
                    <div key={f.id} className="between" style={{ marginTop: 6 }}>
                      <span>{f.client}</span>
                      <span className="row" style={{ gap: 4 }}><OutcomePill outcome={f.before} /> → <OutcomePill outcome={f.after} />
                        {f.before === f.after && <span className="num">{local(f.limitBefore, impact.j)} → {local(f.limitAfter, impact.j)}</span>}</span>
                    </div>
                  ))}
                  <div className="tiny" style={{ marginTop: 8 }}>The customer app now uses v2 too. Each re-assessment is on the chain.</div>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="h2" style={{ margin: 0, fontSize: 19 }}>Approved List</h2>
              <table className="t matrix" style={{ marginTop: 8 }}>
                <thead><tr><th>Asset</th>{JURISDICTIONS.map((j) => <th key={j.id}>{j.id}</th>)}</tr></thead>
                <tbody>
                  {ASSET_IDS.map((a) => (
                    <tr key={a} style={{ cursor: 'default' }}>
                      <td className="small"><span className="row" style={{ gap: 6 }}><Coin asset={a} size={18} />{ASSETS[a].name}</span></td>
                      {JURISDICTIONS.map((j) => {
                        const ap = PACKS[j.id].assets[a].approval;
                        return <td key={j.id} style={{ color: ap === 'approved' ? 'var(--allow)' : ap === 'excluded' ? 'var(--block)' : 'var(--muted)' }}>
                          {ap === 'approved' ? '✓' : ap === 'excluded' ? '✕' : '?'}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tiny muted" style={{ marginTop: 8 }}>✓ available to retail · ? legal opinion needed · ✕ not allowed or excluded. Where an asset isn’t allowed, the engine leaves it out and the basket rebalances.</p>
            </div>

            <div className="card">
              <h2 className="h2" style={{ margin: 0, fontSize: 19 }}>Tamper test</h2>
              <p className="small muted" style={{ marginTop: 6 }}>Quietly rewrite a past refusal as an approval, the way someone covering a mis-sale might. The chain catches it.</p>
              {tamperBackup ? (
                <button className="btn small secondary" onClick={() => { saveChain(tamperBackup); setTamperBackup(null); }}>Undo the edit</button>
              ) : (
                <button className="btn small" onClick={tamper}>Edit a past record</button>
              )}
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: 18 }}>
          <h2 className="h2" style={{ margin: 0 }}>Seven jurisdictions, one engine</h2>
          <p className="small muted" style={{ marginTop: 4 }}>Shared base rules, then each country’s own. Read straight from the signed packs, nothing typed by hand.</p>
          <div className="table-wrap">
            <table className="t compare">
              <thead><tr><th />{JURISDICTIONS.map((j) => <th key={j.id}>{j.name}<br /><span className="tiny muted">{j.id} v{versions[j.id]}</span></th>)}</tr></thead>
              <tbody>
                {([
                  ['Regulator', (p: Pack) => p.regulator],
                  ['In force from', (p: Pack) => p.effective_from],
                  ['Currency', (p: Pack) => p.local.home_currency],
                  ['Personal cap', (p: Pack) => `${Math.min((p.thresholds.max_crypto_concentration_bps as number), Math.max(...Object.values(p.thresholds.limit_bps_by_loss_band as Record<string, number>))) / 100}% of savings`],
                  ['Emergency fund', (p: Pack) => `${p.thresholds.min_emergency_fund_months} months`],
                  ['Local rules', (p: Pack) => p.rules.filter((r) => r.rule_id.startsWith(p.pack_id + '-')).map((r) => r.title).join('; ') || '—'],
                  ['Extra questions', (p: Pack) => p.local.questions.map((q) => q.label).join('; ') || '—'],
                  ['Approved for retail', (p: Pack) => ASSET_IDS.filter((a) => p.assets[a].approval === 'approved').join(', ')],
                  ['Not allowed', (p: Pack) => ASSET_IDS.filter((a) => p.assets[a].approval === 'excluded').join(', ') || '—'],
                  ['Deposit scheme (doesn’t cover crypto)', (p: Pack) => p.local.deposit_scheme],
                  ['Tax', (p: Pack) => p.local.tax],
                ] as [string, (p: Pack) => string][]).map(([k, f]) => (
                  <tr key={k} style={{ cursor: 'default' }}><td className="muted small"><b>{k}</b></td>{JURISDICTIONS.map((j) => <td key={j.id} className="small">{f(packAt(j.id, versions[j.id]))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/** The consumer outcome and limit for a stored snapshot, under a given pack. */
function decideOnboardingFromSnapshot(pack: Pack, snapshot: Record<string, unknown>, d: ReturnType<typeof evaluate>) {
  const outcome = consumerOutcome(d);
  const limit = outcome === 'ALLOW' ? personalLimit(pack, snapshot) : { pence: 0 };
  return {
    outcome, limitPence: limit.pence,
    reasons: d.findings.map((f) => ({ rule_id: f.rule_id, title: f.reason.title, plain_english: f.reason.plain_english })),
  };
}

