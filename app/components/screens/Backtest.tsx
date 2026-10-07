'use client';

import { useMemo, useState } from 'react';
import { ASSET_IDS, ASSETS, CATEGORY_LABEL } from '@/lib/catalog';
import { PERIODS, periodAvailable, runBacktest, type Metrics, type Period } from '@/lib/backtest';
import { fmtDate, getHistory } from '@/lib/market';
import { useDemo, type Line } from '../demo-state';
import { Back, Coin, MoneyInput, Search, Spark, matches, useMoney } from '../ui';

const COLOURS = ['var(--bronze)', '#2C5F8A', '#2F6B54', '#7A5AF8', '#C23631', '#0E7490', '#6B7280'];
const MAX_COMPARE = 6;
const pct = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

/** Opens the backtest for a basket or an asset. */
export function BacktestButton({ name, lines }: { name: string; lines: Line[] }) {
  const { set, s } = useDemo();
  return (
    <div className="card">
      <div className="eyebrow">Backtest</div>
      <p className="small" style={{ margin: '4px 0 10px' }}>
        How {name} would have done over 3 months to 10 years of real prices, against index funds, shares, gold and cash.
      </p>
      <button className="btn secondary" style={{ margin: 0 }} onClick={() => set({ backtest: { name, lines, from: s.screen }, screen: 'backtest' })}>
        Backtest {name}
      </button>
    </div>
  );
}

function Chart({ series, colours }: { series: number[][]; colours: string[] }) {
  const all = series.flat();
  const range: [number, number] = [Math.min(...all), Math.max(...all)];
  // Reference line at the starting value.
  const base = 1;
  const y = (v: number) => 120 - 6 - ((v - range[0]) / (range[1] - range[0] || 1)) * (120 - 12);
  return (
    <div className="multi-spark" style={{ height: 120 }}>
      <svg className="spark" viewBox="0 0 300 120" preserveAspectRatio="none" style={{ height: 120 }} aria-hidden>
        <line x1="0" x2="300" y1={y(base)} y2={y(base)} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      </svg>
      {series.map((s, i) => <Spark key={i} values={s} stroke={colours[i]} height={120} range={range} />).reverse()}
    </div>
  );
}

export function BacktestScreen() {
  const { s, set, go } = useDemo();
  const { fmt } = useMoney();
  const [q, setQ] = useState('');
  const bt = s.backtest;
  const h = getHistory();
  const ids = bt?.lines.map((l) => l.asset as string) ?? [];
  const period = periodAvailable(ids, s.btPeriod) ? s.btPeriod : ([...PERIODS].reverse().find((p) => periodAvailable(ids, p.id))?.id ?? '3M');
  const result = useMemo(
    () => (bt ? runBacktest(bt.name, bt.lines, period, s.btCompare, s.initialPence, s.weeklyPence) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bt, period, s.btCompare, s.initialPence, s.weeklyPence, h],
  );
  if (!bt) return null;

  // Everything there's real history for: the benchmarks, then every asset Quolin shows,
  // except a basket's only asset (comparing Bitcoin with Bitcoin says nothing).
  const options: { id: string; label: string; group: string; asset?: boolean }[] = [
    ...Object.entries(h.benchmarks).map(([id, b]) => ({ id, label: b.label, group: b.group })),
    ...ASSET_IDS.filter((a) => !(ids.length === 1 && ids[0] === a) && h.series[a])
      .map((a) => ({ id: a, label: ASSETS[a].name, group: `Crypto and tokenised · ${CATEGORY_LABEL[ASSETS[a].category]}`, asset: true })),
  ];
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  const shown = options.filter((o) => matches(q, o.label, o.id, o.group));
  const groups = new Map<string, typeof options>();
  for (const o of shown) {
    const g = o.asset ? 'Crypto and tokenised' : o.group;
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  // Never stuck: when the list is full, a new pick replaces the oldest one.
  const toggle = (id: string) => set((x) => ({
    btCompare: x.btCompare.includes(id) ? x.btCompare.filter((c) => c !== id)
      : x.btCompare.length >= MAX_COMPARE ? [...x.btCompare.slice(1), id] : [...x.btCompare, id],
  }));
  const rows: { label: string; m: Metrics; colour: string; plan: { paidInPence: number; finalPence: number } }[] = result
    ? [result.basket, ...result.comparisons].map((it, i) => ({ label: it.label, m: it.metrics, colour: i === 0 ? COLOURS[0] : COLOURS[1 + s.btCompare.indexOf(it.id)], plan: it.plan }))
    : [];
  const longEnough = rows[0]?.m.years >= 1;
  const youngest = ids.map((id) => ({ id, since: h.starts[id] })).sort((a, b) => (a.since < b.since ? 1 : -1))[0];

  return (
    <div className="phone-scroll">
      <Back onClick={() => go(bt.from)} label="Back" />
      <div className="eyebrow">Backtest · real prices</div>
      <h2 className="h2" style={{ marginTop: 2 }}>{bt.name}</h2>

      <div className="seg wrap" style={{ marginTop: 6 }}>
        {PERIODS.map((p) => {
          const ok = periodAvailable(ids, p.id);
          return (
            <button key={p.id} aria-pressed={period === p.id} disabled={!ok} title={ok ? p.label : `Not enough history: ${ASSETS[youngest.id as keyof typeof ASSETS]?.name ?? youngest.id} data starts ${fmtDate(youngest.since)}`}
              onClick={() => set({ btPeriod: p.id as Period })}>{p.id}</button>
          );
        })}
      </div>
      {!PERIODS.every((p) => periodAvailable(ids, p.id)) && (
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>Longer periods need history for every asset; {ASSETS[youngest.id as keyof typeof ASSETS]?.name ?? youngest.id} only goes back to {fmtDate(youngest.since)}.</p>
      )}

      <div className="card">
        <div className="between"><div className="eyebrow">Compare with</div><span className="tiny muted">{s.btCompare.length} of {MAX_COMPARE}</span></div>
        <div className="tags" style={{ marginTop: 8 }}>
          {s.btCompare.map((id, k) => (
            <button key={id} className="tag" aria-pressed onClick={() => toggle(id)} aria-label={`Remove ${labelOf(id)}`}>
              <i className="dot" style={{ background: COLOURS[k + 1] }} />{labelOf(id)} ×
            </button>
          ))}
          {s.btCompare.length === 0 && <span className="small muted">Nothing yet. Pick from the list below.</span>}
        </div>
        <Search value={q} onChange={setQ} placeholder="Search shares, funds, gold, coins…" />
        <div className="compare-list">
          {[...groups.entries()].map(([g, items]) => (
            <div key={g} style={{ marginTop: 10 }}>
              <div className="tiny muted" style={{ marginBottom: 4 }}>{g}</div>
              <div className="tags">
                {items.map((it) => {
                  const on = s.btCompare.includes(it.id);
                  return (
                    <button key={it.id} className="tag" aria-pressed={on} onClick={() => toggle(it.id)}>
                      {it.asset && <Coin asset={it.id as (typeof ASSET_IDS)[number]} size={16} />}{on ? '✓ ' : ''}{it.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="small muted" style={{ margin: '8px 0 0' }}>Nothing matches “{q}”.</p>}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>Tap to add or remove. When {MAX_COMPARE} are chosen, a new pick replaces the oldest.</p>
        {result && result.skipped.length > 0 && (
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            Not enough history for this period: {result.skipped.map((x) => `${x.label} (from ${fmtDate(x.since)})`).join(', ')}.
          </p>
        )}
      </div>

      {result && (
        <>
          <Chart series={rows.map((_, i) => (i === 0 ? result.basket : result.comparisons[i - 1]).index)} colours={rows.map((r) => r.colour)} />
          <div className="between tiny muted"><span>{fmtDate(result.from)}</span><span>{fmtDate(result.to)}</span></div>
          <div className="legend" style={{ marginTop: 6 }}>
            {rows.map((r) => <span key={r.label}><i style={{ background: r.colour }} />{r.label}</span>)}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
            <table className="t compact bt">
              <thead><tr><th /><th>Biggest fall</th><th>{longEnough ? 'A year' : 'Total'}</th><th>Swings</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} style={{ cursor: 'default' }}>
                    <td className="small"><i className="dot" style={{ background: r.colour }} />{r.label}</td>
                    <td className="num small" style={{ color: 'var(--block)' }}>{pct(r.m.maxDrawdownPct, 0)}</td>
                    <td className="num small" style={{ color: (longEnough ? r.m.annualReturnPct : r.m.totalReturnPct) >= 0 ? 'var(--allow)' : 'var(--block)' }}>
                      {pct(longEnough ? r.m.annualReturnPct : r.m.totalReturnPct)}
                    </td>
                    <td className="num small">{r.m.volatilityPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            Biggest fall: peak to trough in the period. {longEnough ? 'A year: average annual return.' : 'Total: return over the period.'} Swings: annualised volatility of weekly returns.
          </p>

          <div className="card">
            <div className="eyebrow">Your plan, over these {PERIODS.find((p) => p.id === period)!.label}</div>
            <label className="field" style={{ marginTop: 6 }}><span>To start with</span>
              <MoneyInput pence={s.initialPence} onChange={(p) => set({ initialPence: p })} label="One-off amount" step={50} /></label>
            <label className="field"><span>Then every week</span>
              <MoneyInput pence={s.weeklyPence} onChange={(p) => set({ weeklyPence: p })} label="Weekly amount" step={5} /></label>
            <table className="t compact" style={{ marginTop: 10 }}>
              <tbody>
                {rows.map((r) => {
                  const g = r.plan.finalPence - r.plan.paidInPence;
                  return (
                    <tr key={r.label} style={{ cursor: 'default' }}>
                      <td className="small"><i className="dot" style={{ background: r.colour }} />{r.label}</td>
                      <td className="num small">{fmt(r.plan.finalPence)}</td>
                      <td className="num small" style={{ color: g >= 0 ? 'var(--allow)' : 'var(--block)' }}>{g >= 0 ? '+' : '−'}{fmt(Math.abs(g))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>Paid in: {fmt(rows[0]?.plan.paidInPence ?? 0)}. No fees, no limit applied: this is history, not advice.</p>
          </div>
        </>
      )}

      <p className="tiny muted" style={{ marginTop: 10 }}>
        {h.source}. {h.live ? `Live, fetched ${new Date(h.fetched_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : `Offline snapshot from ${fmtDate(h.fetched_at)}.`}{' '}
        Everything in pounds, so dollar assets include the pound/dollar move. The FTSE 100 excludes dividends. Rebalanced every 4 weeks.
        Past performance is not a guide to the future.
      </p>
    </div>
  );
}
