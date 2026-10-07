'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { ASSETS, ASSET_IDS, BASKETS, CATEGORY_LABEL, pricePence, worstCase, worstFallBps, worstFallWhen, historySince, type AssetId } from '@/lib/catalog';
import { checkLine, resolveBasket, type Funding } from '@/lib/decide';
import type { Determination, Pack } from '@/lib/engine/types';
import { COIN_DATA, fmtDate, fmtWeek, LAST_WEEK, marketSource, priceAt, yearChangePct } from '@/lib/market';
import { getLivePrices, subscribeLivePrices } from '@/lib/live-prices';
import { BacktestButton } from './Backtest';
import { useDemo, type Line } from '../demo-state';
import { Back, Coin, MoneyInput, Search, Spark, WeightBar, depositScheme, matches, useMoney } from '../ui';

const pct = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;

/** Where this asset stands for this person, in this country, in one line. */
function status(pack: Pack, p: ReturnType<typeof useDemo>['s']['profile'], id: AssetId): { ok: boolean; label: string; detail: string } {
  const d = checkLine(pack, p, id, 0).determination;
  if (d.outcome === 'ALLOW') return { ok: true, label: 'Available', detail: 'On the Approved List here, and unlocked for you.' };
  const f = d.findings[0];
  return { ok: false, label: f.reason.title, detail: f.reason.plain_english };
}

function WorstCard({ lines }: { lines: Line[] }) {
  const { fmt } = useMoney();
  const worst = worstCase(lines);
  return (
    <div className="card dark">
      <div className="eyebrow" style={{ color: '#e5cf9e' }}>Worst fall on record</div>
      <p style={{ margin: '6px 0 4px', fontSize: 16 }}>
        {fmt(100_000)} would have fallen to <b>{fmt(worst * 100)}</b> at the bottom.
      </p>
      <div className="tiny" style={{ color: '#b9c2c9' }}>
        {lines.map((l) => `${ASSETS[l.asset].name} −${Math.round(worstFallBps(l.asset) / 100)}% (${worstFallWhen(l.asset)})`).join(' · ')}. Each asset’s worst fall in its real price history, in pounds.
      </div>
    </div>
  );
}

export function Baskets() {
  const { s, set, go, pack } = useDemo();
  const { fmt } = useMoney();
  const [q, setQ] = useState('');
  const resolved = useMemo(
    () => (pack ? BASKETS.map((b) => ({ b, r: resolveBasket(pack, s.profile, b.lines, b.level) })) : []),
    [pack, s.profile],
  );
  if (!pack) return <div className="phone-scroll"><p className="muted" style={{ marginTop: 24 }}>No rules are signed for your country yet, so nothing can be offered. A person will be in touch.</p></div>;

  const shownBaskets = resolved.filter(({ b, r }) => matches(q, b.name, b.tagline, ...b.lines.map((l) => ASSETS[l.asset].name), ...r.lines.map((l) => l.asset)));
  const shownAssets = q.trim() ? ASSET_IDS.filter((id) => matches(q, ASSETS[id].name, ASSETS[id].ticker, CATEGORY_LABEL[ASSETS[id].category])) : [];

  return (
    <div className="phone-scroll">
      <div className="eyebrow" style={{ marginTop: 8 }}>Approved baskets · {pack.jurisdiction_name}</div>
      <h2 className="h2">Pick a basket</h2>
      <p className="small muted">A few assets, explained plainly, like an index fund. Only what’s approved where you live.</p>
      <Search value={q} onChange={setQ} placeholder="Search baskets and assets: bitcoin, gold, XRP…" />

      {shownAssets.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Assets</div>
          {shownAssets.map((id) => <AssetRow key={id} id={id} />)}
        </div>
      )}

      {shownBaskets.map(({ b, r }) => {
        const locked = s.profile.knowledgeLevel < b.level;
        return r.available ? (
          <button key={b.id} className="card" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 12 }}
            onClick={() => { if (locked) { go('course2'); return; } set({ selectedBasket: b.id }); go('basket'); }}>
            <div className="between"><span className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{b.name}</span>
              <span className={`pill ${locked ? '' : 'allow'}`}>{locked ? `Locked · Level ${b.level}` : `Level ${b.level}`}</span></div>
            <div className="small muted">{b.tagline}</div>
            <WeightBar lines={r.lines} />
            <div className="small" style={{ marginTop: 10 }}>Worst fall on record: {fmt(100_000)} → <b>{fmt(worstCase(r.lines) * 100)}</b></div>
            {r.removed.length > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>Rebalanced: {r.removed.map((x) => ASSETS[x.asset].name).join(', ')} left out here.</div>}
          </button>
        ) : (
          <div key={b.id} className="card quiet" style={{ marginTop: 12 }}>
            <div className="between"><span className="h3 muted" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{b.name}</span><span className="pill">Not here yet</span></div>
            <div className="small muted">
              Not available in {pack.jurisdiction_name}: {r.removed.map((x) => `${ASSETS[x.asset].name} (${x.reason.toLowerCase()})`).join(', ')}.
            </div>
          </div>
        );
      })}

      {matches(q, 'build your own', 'custom') && (
        <button className="card" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 12 }} onClick={() => go(s.profile.knowledgeLevel >= 2 ? 'build' : 'course2')}>
          <div className="between"><span className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>Build your own</span>
            <span className={`pill ${s.profile.knowledgeLevel >= 2 ? 'allow' : ''}`}>{s.profile.knowledgeLevel >= 2 ? 'Unlocked' : 'Locked · Level 2'}</span></div>
          <div className="small muted">From the Approved List. The engine checks every weight.</div>
        </button>
      )}
      <button className="link small" style={{ marginTop: 14 }} onClick={() => go('explore')}>Browse all {ASSET_IDS.length} assets: the top 15 coins, gold and T-bills →</button>
      {q && shownBaskets.length === 0 && shownAssets.length === 0 && <p className="small muted" style={{ marginTop: 12 }}>Nothing matches “{q}”.</p>}
    </div>
  );
}

function AssetRow({ id }: { id: AssetId }) {
  const { s, set, go, pack } = useDemo();
  const { price } = useMoney();
  const a = ASSETS[id];
  const st = pack ? status(pack, s.profile, id) : { ok: false, label: 'No rules here', detail: '' };
  const live = useSyncExternalStore(subscribeLivePrices, getLivePrices, getLivePrices).prices[id];
  const ch = live?.change24h ?? yearChangePct(id);
  return (
    <button className="asset-row" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left' }}
      onClick={() => { set({ selectedAsset: id }); go('asset'); }}>
      <Coin asset={id} />
      <span>
        <b>{a.name}</b> <span className="tiny muted">{a.ticker}{a.rank ? ` · #${a.rank}` : ''}</span><br />
        <span className={`pill ${st.ok ? 'allow' : ''}`} style={{ marginTop: 4 }}>{st.ok ? '✓ Available' : st.label}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span className="num small" style={{ fontWeight: 600 }}>{price(live ? live.gbp * 100 : pricePence(id, LAST_WEEK))}</span><br />
        <span className="num tiny" style={{ color: ch >= 0 ? 'var(--allow)' : 'var(--block)' }}>{pct(ch, live ? 1 : 0)} {live ? '24h' : '1y'}</span>
      </span>
    </button>
  );
}

export function Explore() {
  const { go, pack } = useDemo();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const { s } = useDemo();
  const list = ASSET_IDS.filter((id) => matches(q, ASSETS[id].name, ASSETS[id].ticker, CATEGORY_LABEL[ASSETS[id].category]))
    .filter((id) => filter === 'all' || (pack && status(pack, s.profile, id).ok));
  return (
    <div className="phone-scroll">
      <Back onClick={() => go('baskets')} label="Baskets" />
      <h2 className="h2">All assets</h2>
      <p className="small muted">The 15 largest coins by market value, plus tokenised gold and T-bills. Each shows whether it’s available to you{pack ? ` in ${pack.jurisdiction_name}` : ''}, and why not if it isn’t.</p>
      <Search value={q} onChange={setQ} placeholder="Search by name or ticker" />
      <div className="seg" style={{ marginTop: 10 }}>
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All {ASSET_IDS.length}</button>
        <button aria-pressed={filter === 'available'} onClick={() => setFilter('available')}>Available to me</button>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        {list.map((id) => <AssetRow key={id} id={id} />)}
        {list.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing matches.</p>}
      </div>
      <p className="tiny muted">{getLivePrices().at ? `Live prices: CoinGecko, ${new Date(getLivePrices().at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : `Prices: ${marketSource()}`}. Tap an asset for its history and a backtest.</p>
    </div>
  );
}

export function AssetDetail() {
  const { s, set, go, pack } = useDemo();
  const { price, fmt } = useMoney();
  const id = s.selectedAsset ?? 'BTC';
  const a = ASSETS[id];
  const st = pack ? status(pack, s.profile, id) : null;
  const series = Array.from({ length: LAST_WEEK + 1 }, (_, w) => priceAt(id, w));
  const live = useSyncExternalStore(subscribeLivePrices, getLivePrices, getLivePrices).prices[id];
  const d = COIN_DATA[id];
  const canAdd = st?.ok && s.profile.knowledgeLevel >= 2 && pack?.assets[id].class !== 'stable';

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('explore')} label="All assets" />
        <div className="row" style={{ gap: 12, marginTop: 6 }}>
          <Coin asset={id} size={44} />
          <div><h2 className="h2" style={{ margin: 0 }}>{a.name}</h2><div className="small muted">{a.ticker}{a.rank ? ` · #${a.rank} by market value` : ` · ${CATEGORY_LABEL[a.category]}`}</div></div>
        </div>
        <div className="big-num num" style={{ marginTop: 12 }}>{price(live ? live.gbp * 100 : pricePence(id, LAST_WEEK))}</div>
        <div className="small muted">
          {live ? <>Live · {pct(live.change24h ?? 0)} today · </> : null}{pct(yearChangePct(id), 0)} over the last year
        </div>
        <Spark values={series} stroke={a.colour} marks={[s.week]} />

        {st && (
          <div className={`verdict ${st.ok ? 'allow' : 'notyet'} small`} style={{ padding: 12, marginTop: 8 }}>
            <b>{st.ok ? `✓ Available to you in ${pack!.jurisdiction_name}` : st.label}</b><div>{st.detail}</div>
          </div>
        )}

        <div className="card tint" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ color: 'var(--bronze)' }}>What it’s for</div>
          <p style={{ margin: '4px 0 0' }}>{a.one_liner}</p>
        </div>
        <div className="card">
          <dl className="kv">
            <dt>Does</dt><dd>{a.what_it_does}</dd>
            <dt>Used by</dt><dd>{a.who_uses_it}</dd>
            <dt>Value</dt><dd>{a.value_from}</dd>
            <dt>Risks</dt><dd>{a.what_can_kill_it}</dd>
            <dt>Worst</dt><dd>−{(worstFallBps(a.id) / 100).toFixed(0)}% ({worstFallWhen(a.id)}){historySince(a.id) ? `, in data since ${fmtDate(historySince(a.id)!)}` : ''}</dd>
            {d?.below_peak_pct != null && <><dt>Now</dt><dd>{Math.abs(d.below_peak_pct)}% below its all-time high</dd></>}
          </dl>
        </div>
        <BacktestButton name={a.name} lines={[{ asset: id, weight_bps: 10_000 }]} />
      </div>
      {canAdd && (
        <div className="phone-foot">
          <button className="btn" onClick={() => { set((x) => ({ custom: { ...x.custom, [id]: x.custom[id] || 500 } })); go('build'); }}>Add to my own basket</button>
        </div>
      )}
    </>
  );
}

function AmountPicker() {
  const { s, set, result, preCheck } = useDemo();
  const { fmt } = useMoney();
  const firstYear = s.initialPence + s.weeklyPence * 52;
  const d = preCheck(s.initialPence);
  const over = d?.findings.find((f) => f.reason_code === 'OVER_LIMIT');
  return (
    <div className="card">
      <div className="eyebrow">How much?</div>
      <label className="field" style={{ marginTop: 6 }}><span>To start with <span className="hint">· one-off, can be 0</span></span>
        <MoneyInput pence={s.initialPence} onChange={(p) => set({ initialPence: p })} label="One-off amount" step={50} />
      </label>
      <label className="field"><span>Then every week</span>
        <MoneyInput pence={s.weeklyPence} onChange={(p) => set({ weeklyPence: p })} label="Weekly amount" step={5} />
      </label>
      <div className="between small" style={{ marginTop: 10 }}><span className="muted">Your limit</span><b className="num">{fmt(result.limitPence)}</b></div>
      <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (firstYear / Math.max(1, result.limitPence)) * 100)}%`, background: firstYear > result.limitPence ? 'var(--notyet)' : undefined }} /></div>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        {over ? <span style={{ color: 'var(--block)' }}>{fmt(s.initialPence)} is more than your limit allows: we’d buy up to {fmt(result.limitPence)}.</span>
          : firstYear > result.limitPence
            ? `A year of this is ${fmt(firstYear)}. Buying pauses automatically when you reach your limit, around week ${Math.max(1, Math.ceil((result.limitPence - s.initialPence) / Math.max(1, s.weeklyPence)))}.`
            : `A year of this is ${fmt(firstYear)}, inside your limit.`}
      </div>
    </div>
  );
}

export function BasketDetail() {
  const { s, set, go, pack } = useDemo();
  const { fmt } = useMoney();
  const [open, setOpen] = useState<AssetId | null>(null);
  const basket = BASKETS.find((b) => b.id === s.selectedBasket) ?? BASKETS[0];
  const r = useMemo(() => (pack ? resolveBasket(pack, s.profile, basket.lines, basket.level) : null), [pack, s.profile, basket]);
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
        <AmountPicker />
        <BacktestButton name={basket.name} lines={r.lines} />

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
                    <dt>Worst</dt><dd>−{(worstFallBps(a.id) / 100).toFixed(0)}% ({worstFallWhen(a.id)}){historySince(a.id) ? `, in data since ${fmtDate(historySince(a.id)!)}` : ''}</dd>
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
          Held at a regulated custodian, separate from Quolin’s money · not covered by {depositScheme(pack)} · each buy goes in at these weights
        </p>
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={s.initialPence + s.weeklyPence === 0} onClick={() => { set({ draft: { name: basket.name, lines: r.lines } }); go('plan'); }}>
          Review: {s.initialPence ? `${fmt(s.initialPence)} now + ` : ''}{fmt(s.weeklyPence)}/week
        </button>
      </div>
    </>
  );
}

const STEP = 500;

export function Build() {
  const { s, set, go, pack } = useDemo();
  const [q, setQ] = useState('');
  if (!pack) return null;
  const ids = ASSET_IDS.filter((id) => pack.assets[id].class !== 'stable');
  const usable = (id: AssetId) => checkLine(pack, s.profile, id, 0).determination.outcome === 'ALLOW';
  const wOf = (id: AssetId) => (usable(id) ? s.custom[id] ?? 0 : 0);
  const total = ids.reduce((t, id) => t + wOf(id), 0);
  const checks: Partial<Record<AssetId, { determination: Determination }>> = Object.fromEntries(ids.map((id) => [id, checkLine(pack, s.profile, id, wOf(id))]));
  const lines: Line[] = ids.filter((id) => wOf(id) > 0).map((id) => ({ asset: id, weight_bps: wOf(id) }));
  const blocked = lines.filter((l) => checks[l.asset]!.determination.outcome !== 'ALLOW');
  const ok = total === 10_000 && blocked.length === 0 && lines.length > 0;
  const bump = (id: AssetId, by: number) => set((x) => ({ custom: { ...x.custom, [id]: Math.max(0, Math.min(10_000, (x.custom[id] ?? 0) + by)) } }));
  // Available first, then the rest with their reasons.
  const shown = ids.filter((id) => matches(q, ASSETS[id].name, ASSETS[id].ticker, CATEGORY_LABEL[ASSETS[id].category]))
    .sort((x, y) => Number(usable(y)) - Number(usable(x)) || wOf(y) - wOf(x));

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('baskets')} label="Baskets" />
        <h2 className="h2">Build your own</h2>
        <p className="small muted">Only from the Approved List in {pack.jurisdiction_name}. Each change is checked by the same rules your bank signs off.</p>
        <Search value={q} onChange={setQ} placeholder="Search assets to add" />
        <div className="card" style={{ marginTop: 10 }}>
          {shown.map((id) => {
            const a = ASSETS[id];
            const d = checks[id]!.determination;
            const f = d.findings[0];
            const excluded = !usable(id);
            const w = wOf(id);
            return (
              <div key={id} className="asset-row" style={{ opacity: excluded ? 0.6 : 1 }}>
                <Coin asset={id} />
                <span>
                  <b>{a.name}</b> <span className="tiny muted">{a.ticker}</span><br />
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
          {shown.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing matches “{q}”.</p>}
        </div>
        <div className="between small" style={{ marginTop: 12 }}>
          <span className="muted">Total</span>
          <b className="num" style={{ color: total === 10_000 ? 'var(--allow)' : 'var(--block)' }}>{total / 100}% {total !== 10_000 && '(must be 100%)'}</b>
        </div>
        {blocked.map((l) => (
          <div key={l.asset} className="verdict block small" style={{ padding: 12, marginTop: 10 }}>
            <b>{ASSETS[l.asset].name}: {checks[l.asset]!.determination.findings[0].reason.title}.</b> {checks[l.asset]!.determination.findings[0].reason.plain_english}
          </div>
        ))}
        {lines.length > 0 && <WeightBar lines={lines} />}
        {ok && <><div style={{ marginTop: 12 }}><WorstCard lines={lines} /></div><AmountPicker /><BacktestButton name="my basket" lines={lines} /></>}
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={!ok || s.initialPence + s.weeklyPence === 0} onClick={() => { set({ draft: { name: 'My basket', lines } }); go('plan'); }}>
          Review my basket
        </button>
      </div>
    </>
  );
}

const FUNDING: { id: Funding; label: string }[] = [
  { id: 'bank_transfer', label: 'Bank account' },
  { id: 'debit_card', label: 'Debit card' },
  { id: 'credit_card', label: 'Credit card' },
];

export function PlanSetup() {
  const { s, set, go, pack, result, preCheck, startPlan } = useDemo();
  const { fmt } = useMoney();
  const draft = s.draft;
  if (!pack || !draft) return null;

  const firstAmount = s.initialPence || s.weeklyPence;
  const check = preCheck(firstAmount, { funding: s.funding, acks: s.acks });
  const cooling = check?.findings.find((f) => f.reason_code === 'COOLING_OFF');
  const over = check?.findings.find((f) => f.reason_code === 'OVER_LIMIT');
  const blocking = check?.findings.filter((f) => !['COOLING_OFF', 'OVER_LIMIT'].includes(f.reason_code)) ?? [];
  const weeksToLimit = s.weeklyPence ? Math.max(0, Math.ceil((result.limitPence - Math.min(s.initialPence, result.limitPence)) / s.weeklyPence)) : 0;

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go(draft.name === 'My basket' ? 'build' : 'basket')} />
        <div className="eyebrow">{draft.name} · {pack.jurisdiction_name} rules</div>
        <h2 className="h2">Check and start</h2>
        <WeightBar lines={draft.lines} />
        <div className="card" style={{ marginTop: 12 }}>
          <label className="field" style={{ marginTop: 0 }}><span>Now</span>
            <MoneyInput pence={s.initialPence} onChange={(p) => set({ initialPence: p })} label="One-off amount" step={50} /></label>
          <label className="field"><span>Every Monday</span>
            <MoneyInput pence={s.weeklyPence} onChange={(p) => set({ weeklyPence: p })} label="Weekly amount" step={5} /></label>
          <div className="between small" style={{ marginTop: 10 }}><span className="muted">Your limit</span><b className="num">{fmt(result.limitPence)}</b></div>
          {s.weeklyPence > 0 && <div className="between small" style={{ marginTop: 4 }}><span className="muted">Reached in about</span><b>{weeksToLimit} weeks</b></div>}
          {over && <div className="small" style={{ marginTop: 8, color: 'var(--block)' }}>That’s above your limit. We’ll buy {fmt(result.limitPence)} and stop there.</div>}
        </div>

        <div className="field"><span>Pay from</span>
          <div className="choices four" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {FUNDING.map((f) => (
              <button key={f.id} type="button" className="choice compact" aria-pressed={s.funding === f.id} onClick={() => set({ funding: f.id })}>{f.label}</button>
            ))}
          </div>
        </div>

        {pack.local.disclosures.map((dsc) => (
          <label key={dsc.field} className="check card">
            <input type="checkbox" checked={!!s.acks[dsc.field]} onChange={(e) => set((x) => ({ acks: { ...x.acks, [dsc.field]: e.target.checked } }))} />
            <span className="small">{dsc.label} <span className="muted">({pack.jurisdiction_name} rule)</span></span>
          </label>
        ))}

        {cooling && (
          <div className="card tint small">
            <b>Your first buy waits 24 hours.</b> It’s the {pack.jurisdiction_name} cooling-off rule for first-time investors, and it’s a good one: nobody can rush you.
          </div>
        )}
        {blocking.map((f) => (
          <div key={f.rule_id} className="verdict block small" style={{ padding: 12, marginTop: 12 }}><b>{f.reason.title}.</b> {f.reason.plain_english} <code className="mono muted">{f.rule_id}</code></div>
        ))}
        <p className="tiny muted" style={{ marginTop: 12 }}>Sales only ever go back to the account you pay from. Prices: {marketSource()}, at {fmtWeek(s.week)}.</p>
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={blocking.length > 0 || firstAmount === 0} onClick={startPlan}>Start my plan</button>
      </div>
    </>
  );
}
