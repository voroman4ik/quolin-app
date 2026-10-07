'use client';

import { useMemo, useState } from 'react';
import { ASSET_IDS, ASSETS, CATEGORY_LABEL } from '@/lib/catalog';
import { PERIODS, periodAvailable, runBacktest, type Metrics, type Period } from '@/lib/backtest';
import { fmtDate, getHistory } from '@/lib/market';
import { useDemo, type Line } from '../demo-state';
import { Back, Coin, MoneyInput, Search, matches, useMoney } from '../ui';

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

/** Growth chart: every line starts at 0% and the axis is growth since the start date. */
function Chart({ series, colours, labels, dates }: { series: number[][]; colours: string[]; labels: string[]; dates: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300, H = 180, L = 40, R = 6, T = 8, B = 8;
  const growth = series.map((s) => s.map((v) => (v / s[0] - 1) * 100));
  const all = growth.flat();
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  // Round steps that give about five gridlines.
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((x) => (hi - lo) / x <= 5) ?? 10000;
  // The scale fits the data (with a little room); gridlines sit on round steps inside it.
  const pad = (hi - lo) * 0.06 || 1;
  const min = lo - pad, max = hi + pad;
  const ticks: number[] = [];
  for (let p = Math.ceil(min / step) * step; p <= max; p += step) ticks.push(p);
  // With a big step a small range below 0 gets no gridline: add a finer one so falls are readable.
  if (lo < 0 && !ticks.some((t) => t < 0)) {
    const fine = [5, 10, 20, 25, 50].reverse().find((f) => -f >= min) ;
    if (fine) ticks.unshift(-fine);
  }
  const n = growth[0].length;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (g: number) => T + (1 - (g - min) / (max - min || 1)) * (H - T - B);
  // Never two labels on top of each other: 0% always stays, others need room.
  const shown = ticks.filter((t) => t === 0 || ticks.every((u) => u === t || Math.abs(y(u) - y(t)) >= 12 || (u !== 0 && Math.abs(u) > Math.abs(t))));
  const fmt = (g: number) => `${g > 0 ? '+' : g < 0 ? '−' : ''}${Math.abs(g) >= 100 ? Math.round(Math.abs(g)) : Math.abs(g).toFixed(1)}%`;
  const at = hover ?? n - 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };

  return (
    <div className="bt-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={`Growth since ${fmtDate(dates[0])}: ${labels.map((l, k) => `${l} ${fmt(growth[k][n - 1])}`).join(', ')}`}>
        {shown.map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke={p === 0 ? 'var(--muted)' : 'var(--line)'} strokeWidth={p === 0 ? 1 : 0.6} strokeDasharray={p === 0 ? '3 3' : undefined} />
            <text x={L - 5} y={y(p)} textAnchor="end" dominantBaseline="middle" className="bt-tick">{p > 0 ? '+' : p < 0 ? '−' : ''}{Math.abs(p)}%</text>
          </g>
        ))}
        {growth.map((g, k) => (
          <polyline key={k} fill="none" stroke={colours[k]} strokeWidth={k === 0 ? 2 : 1.3} strokeLinejoin="round"
            points={g.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} opacity={k === 0 ? 1 : 0.9} />
        )).reverse()}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth={0.6} />}
        {growth.map((g, k) => <circle key={k} cx={x(at)} cy={y(g[at])} r={k === 0 ? 2.6 : 2} fill={colours[k]} />)}
      </svg>
      <div className="bt-readout">
        <span className="tiny muted">{hover === null ? 'Today' : fmtDate(dates[hover])} · growth since {fmtDate(dates[0])}</span>
        <div className="legend" style={{ marginTop: 4 }}>
          {labels.map((l, k) => (
            <span key={l}><i style={{ background: colours[k] }} />{l} <b className="num" style={{ color: growth[k][at] >= 0 ? 'var(--allow)' : 'var(--block)' }}>{fmt(growth[k][at])}</b></span>
          ))}
        </div>
      </div>
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
  const chartDates = result ? h.dates.slice(h.dates.length - result.basket.index.length) : [];
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
          <Chart series={rows.map((_, i) => (i === 0 ? result.basket : result.comparisons[i - 1]).index)} colours={rows.map((r) => r.colour)} labels={rows.map((r) => r.label)} dates={chartDates} />
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 12 }}>
            <table className="t compact bt">
              <thead><tr><th /><th>Growth</th><th>Per yr</th><th>Worst</th><th>Swings</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} style={{ cursor: 'default' }}>
                    <td className="small name" title={r.label}><i className="dot" style={{ background: r.colour }} />{r.label}</td>
                    <td className="num small" style={{ fontWeight: 600, color: r.m.totalReturnPct >= 0 ? 'var(--allow)' : 'var(--block)' }}>{pct(r.m.totalReturnPct, 0)}</td>
                    <td className="num small" style={{ color: r.m.annualReturnPct >= 0 ? 'var(--allow)' : 'var(--block)' }}>{longEnough ? pct(r.m.annualReturnPct) : '—'}</td>
                    <td className="num small" style={{ color: 'var(--block)' }}>{pct(r.m.maxDrawdownPct, 0)}</td>
                    <td className="num small">{r.m.volatilityPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            Growth: total change over the period. Per yr: average yearly growth{longEnough ? '' : ' (shown for a year or more)'}. Worst: biggest peak-to-trough fall. Swings: annualised volatility.
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
