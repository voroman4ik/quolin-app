'use client';

import { useMemo, useState } from 'react';
import { ASSETS, BASKETS, worstCase, type AssetId } from '@/lib/catalog';
import { checkLine, checkPurchase, resolveBasket } from '@/lib/decide';
import { useDemo, type Line } from '../demo-state';
import { Back, Coin, DEPOSIT_SCHEME, WeightBar, useMoney } from '../ui';

function WorstCard({ lines }: { lines: Line[] }) {
  const { fmt } = useMoney();
  const worst = worstCase(lines);
  return (
    <div className="card dark">
      <div className="eyebrow" style={{ color: '#e5cf9e' }}>Worst year so far</div>
      <p style={{ margin: '6px 0 4px', fontSize: 16 }}>
        {fmt(100_000)} would have fallen to <b>{fmt(worst * 100)}</b> before recovering.
      </p>
      <div className="tiny muted">Illustrative: each asset’s worst peak-to-trough fall, applied to these weights.</div>
    </div>
  );
}

export function Baskets() {
  const { s, set, go, pack } = useDemo();
  const { fmt } = useMoney();
  const resolved = useMemo(
    () => (pack ? BASKETS.map((b) => ({ b, r: resolveBasket(pack, s.profile, b.lines) })) : []),
    [pack, s.profile],
  );
  if (!pack) return <div className="phone-scroll"><p className="muted">No rules are signed for your country yet.</p></div>;

  return (
    <div className="phone-scroll">
      <div className="eyebrow" style={{ marginTop: 8 }}>Approved baskets · {pack.jurisdiction_name}</div>
      <h2 className="h2">Pick a basket</h2>
      <p className="small muted">A few assets, explained plainly, rebalanced monthly like an index fund. Only what’s approved where you live.</p>

      {resolved.map(({ b, r }) => r.available ? (
        <button key={b.id} className="card" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 12 }}
          onClick={() => { set({ selectedBasket: b.id }); go('basket'); }}>
          <div className="between"><span className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{b.name}</span><span className="pill">Level 1</span></div>
          <div className="small muted">{b.tagline}</div>
          <WeightBar lines={r.lines} />
          <div className="small" style={{ marginTop: 10 }}>Worst year: {fmt(100_000)} → <b>{fmt(worstCase(r.lines) * 100)}</b></div>
          {r.removed.length > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>Rebalanced: {r.removed.map((x) => ASSETS[x.asset].name).join(', ')} not approved here.</div>}
        </button>
      ) : (
        <div key={b.id} className="card quiet" style={{ marginTop: 12 }}>
          <div className="between"><span className="h3 muted" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{b.name}</span><span className="pill">Not here yet</span></div>
          <div className="small muted">
            Not available in {pack.jurisdiction_name} yet: {r.removed.map((x) => ASSETS[x.asset].name.toLowerCase()).join(' and ')} {r.removed.length > 1 ? 'are' : 'is'} waiting on approval.
          </div>
        </div>
      ))}

      <button className="card" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 12 }} onClick={() => go(s.profile.knowledgeLevel >= 2 ? 'build' : 'course2')}>
        <div className="between"><span className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Build your own</span>
          <span className={`pill ${s.profile.knowledgeLevel >= 2 ? 'allow' : ''}`}>{s.profile.knowledgeLevel >= 2 ? 'Unlocked' : 'Locked · Level 2'}</span></div>
        <div className="small muted">From the Approved List. The engine checks every weight.</div>
      </button>
    </div>
  );
}

export function BasketDetail() {
  const { s, set, go, pack, jurisdiction } = useDemo();
  const { friendly } = useMoney();
  const [open, setOpen] = useState<AssetId | null>(null);
  const basket = BASKETS.find((b) => b.id === s.selectedBasket) ?? BASKETS[0];
  const r = useMemo(() => (pack ? resolveBasket(pack, s.profile, basket.lines) : null), [pack, s.profile, basket]);
  if (!r || !r.available) return null;

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('baskets')} label="Baskets" />
        <h2 className="h1" style={{ fontSize: 30 }}>{basket.name}</h2>
        <p className="muted">{basket.tagline}</p>
        <WeightBar lines={r.lines} />

        <div className="card tint" style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ color: 'var(--bronze)' }}>What it’s for</div>
          <p style={{ margin: '4px 0 0' }}>{basket.what_for}</p>
        </div>
        <WorstCard lines={r.lines} />

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 4 }}>What’s inside</div>
          {r.lines.map((l) => {
            const a = ASSETS[l.asset];
            return (
              <div key={l.asset}>
                <button className="asset-row" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', padding: '10px 0' }}
                  onClick={() => setOpen(open === l.asset ? null : l.asset)} aria-expanded={open === l.asset}>
                  <Coin asset={l.asset} />
                  <span><b>{a.name}</b><br /><span className="small muted">{a.one_liner}</span></span>
                  <span className="num" style={{ fontWeight: 600 }}>{Math.round(l.weight_bps / 100)}%</span>
                </button>
                {open === l.asset && (
                  <dl className="kv" style={{ padding: '4px 0 12px 44px' }}>
                    <dt>Does</dt><dd>{a.what_it_does}</dd>
                    <dt>Used by</dt><dd>{a.who_uses_it}</dd>
                    <dt>Value</dt><dd>{a.value_from}</dd>
                    <dt>Risks</dt><dd>{a.what_can_kill_it}</dd>
                    <dt>Worst</dt><dd>−{a.worst_fall_bps / 100}% ({a.worst_when})</dd>
                  </dl>
                )}
              </div>
            );
          })}
          {r.removed.map((x) => (
            <div key={x.asset} className="small muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
              Left out: {ASSETS[x.asset].name}. {x.detail}
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          Held at a regulated custodian, separate from Quolin’s money · not covered by {DEPOSIT_SCHEME[jurisdiction ?? 'UK']} · rebalanced monthly
        </p>
      </div>
      <div className="phone-foot">
        <button className="btn" onClick={() => { set({ draft: { name: basket.name, lines: r.lines } }); go('plan'); }}>
          Start with {friendly(s.weeklyPence)}/week
        </button>
      </div>
    </>
  );
}

const STEP = 500;

export function Build() {
  const { s, set, go, pack } = useDemo();
  const { friendly } = useMoney();
  if (!pack) return null;
  const ids = Object.keys(pack.assets) as AssetId[];
  // Assets this country doesn't offer carry no weight, whatever was set elsewhere.
  const usable = (id: AssetId) => pack.assets[id].approval === 'approved' && !pack.assets[id].leverage;
  const wOf = (id: AssetId) => (usable(id) ? s.custom[id] ?? 0 : 0);
  const total = ids.reduce((t, id) => t + wOf(id), 0);
  const checks = Object.fromEntries(ids.map((id) => [id, checkLine(pack, s.profile, id, wOf(id))]));
  const lines: Line[] = ids.filter((id) => wOf(id) > 0).map((id) => ({ asset: id, weight_bps: wOf(id) }));
  const bad = lines.filter((l) => checks[l.asset].determination.outcome !== 'ALLOW');
  const ok = total === 10_000 && bad.length === 0 && lines.length > 0;

  const bump = (id: AssetId, d: number) =>
    set((prev) => ({ custom: { ...prev.custom, [id]: Math.max(0, Math.min(10_000, (prev.custom[id] ?? 0) + d)) } }));

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('baskets')} label="Baskets" />
        <h2 className="h2">Build your own</h2>
        <p className="small muted">Only from the Approved List in {pack.jurisdiction_name}. Each change is checked by the same rules your bank signs off.</p>
        <div className="card">
          {ids.map((id) => {
            const a = ASSETS[id];
            const d = checks[id].determination;
            const f = d.findings[0];
            const excluded = !usable(id);
            const w = wOf(id);
            return (
              <div key={id} className="asset-row" style={{ opacity: excluded ? 0.55 : 1 }}>
                <Coin asset={id} />
                <span>
                  <b>{a.name}</b><br />
                  {f ? <span className={`pill ${f.reason_code === 'WEIGHT_CAP' && w > 0 ? 'block' : ''}`} style={{ marginTop: 4 }}>{f.reason.title}</span>
                     : w > 0 ? <span className="pill allow" style={{ marginTop: 4 }}>✓ Approved</span>
                     : <span className="tiny muted">{a.one_liner}</span>}
                </span>
                {excluded ? <span className="tiny muted">—</span> : (
                  <span className="stepper">
                    <button aria-label={`Less ${a.name}`} disabled={w === 0} onClick={() => bump(id, -STEP)}>−</button>
                    <span className="num" style={{ width: 38, textAlign: 'center', fontWeight: 600 }}>{w / 100}%</span>
                    <button aria-label={`More ${a.name}`} onClick={() => bump(id, STEP)}>+</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="between small" style={{ marginTop: 12 }}>
          <span className="muted">Total</span>
          <b className="num" style={{ color: total === 10_000 ? 'var(--allow)' : 'var(--block)' }}>{total / 100}% {total !== 10_000 && '(must be 100%)'}</b>
        </div>
        {bad.map((l) => (
          <div key={l.asset} className="verdict block small" style={{ marginTop: 10, padding: 12 }}>
            <b>{ASSETS[l.asset].name}: {checks[l.asset].determination.findings[0].reason.title}.</b>{' '}
            {checks[l.asset].determination.findings[0].reason.plain_english}
          </div>
        ))}
        {lines.length > 0 && <WeightBar lines={lines} />}
        {ok && <div style={{ marginTop: 12 }}><WorstCard lines={lines} /></div>}
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={!ok} onClick={() => { set({ draft: { name: 'My basket', lines } }); go('plan'); }}>
          Start with {friendly(s.weeklyPence)}/week
        </button>
      </div>
    </>
  );
}

export function PlanSetup() {
  const { s, set, go, pack, result, log } = useDemo();
  const { fmt, friendly } = useMoney();
  const draft = s.draft;
  if (!pack || !draft) return null;

  const check = checkPurchase(pack, s.profile, {
    amountPence: s.weeklyPence, heldPence: 0, priorPurchases: 0, coolingOffComplete: s.coolingOffDone,
  });
  const cooling = check.findings.find((f) => f.reason_code === 'COOLING_OFF');
  const blocking = check.findings.filter((f) => f.reason_code !== 'COOLING_OFF');
  const weeksToLimit = Math.ceil(result.limitPence / s.weeklyPence);

  const start = () => {
    const now = new Date();
    const firstBuyAt = cooling ? new Date(now.getTime() + 24 * 3600 * 1000).toISOString() : null;
    set({ plan: { name: draft.name, lines: draft.lines, weeklyPence: s.weeklyPence, startedAt: now.toISOString(), firstBuyAt }, weeks: 0, market: 'normal', sellPendingUntil: null });
    log({
      kind: 'plan', jurisdiction: pack.jurisdiction_name, pack_id: pack.pack_id, pack_version: pack.version,
      outcome: check.outcome, summary: `${draft.name} · ${fmt(s.weeklyPence)}/week${cooling ? ' · first buy after 24h cooling-off' : ''}`,
      reasons: check.findings.map((f) => ({ rule_id: f.rule_id, title: f.reason.title, plain_english: f.reason.plain_english })),
      determination: check, limit_pence: result.limitPence,
    });
    go('home');
  };

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('baskets')} />
        <div className="eyebrow">{draft.name}</div>
        <h2 className="h2">How much each week?</h2>
        <p className="small muted">Small regular buys mean you buy at many prices, not one. You can pause or stop any time.</p>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="stepper" style={{ justifyContent: 'center' }}>
            <button aria-label="Less" disabled={s.weeklyPence <= 1000} onClick={() => set({ weeklyPence: s.weeklyPence - 500 })}>−</button>
            <span className="big-num num" style={{ minWidth: 150 }}>{friendly(s.weeklyPence)}</span>
            <button aria-label="More" disabled={s.weeklyPence >= 10_000} onClick={() => set({ weeklyPence: s.weeklyPence + 500 })}>+</button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>a week, every Monday</div>
        </div>
        <div className="card">
          <div className="between small"><span className="muted">Your limit</span><b className="num">{fmt(result.limitPence)}</b></div>
          <div className="between small" style={{ marginTop: 6 }}><span className="muted">Reached in</span><b>{weeksToLimit} weeks</b></div>
          <div className="small muted" style={{ marginTop: 8 }}>Then buying pauses automatically. We’ll never nudge you to go over it.</div>
        </div>
        {cooling && (
          <div className="card tint small">
            <b>Your first buy waits 24 hours.</b> It’s the {pack.jurisdiction_name} cooling-off rule for first-time investors, and it’s a good one: nobody can rush you.
          </div>
        )}
        {blocking.map((f) => (
          <div key={f.rule_id} className="verdict block small" style={{ padding: 12, marginTop: 12 }}><b>{f.reason.title}.</b> {f.reason.plain_english}</div>
        ))}
        <p className="tiny muted" style={{ marginTop: 12 }}>Paid from your bank account. Sales only ever go back to the same account.</p>
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={blocking.length > 0} onClick={start}>Start my plan</button>
      </div>
    </>
  );
}
