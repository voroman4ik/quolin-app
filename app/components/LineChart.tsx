'use client';

import { useState } from 'react';
import { CURRENCIES, type Currency } from '@/lib/catalog';
import { getRates } from '@/lib/fx';
import { fmtDate } from '@/lib/market';

export type ChartMode = 'money' | 'pct';

export interface ChartSeries {
  label: string;
  colour: string;
  /** Money mode: GBP pence. Percent mode: growth in percent (0 = no change). */
  values: number[];
  dashed?: boolean;
  bold?: boolean;
}

const NICE = [1, 2, 2.5, 5];

/** A round step that gives about `target` gridlines across `span`. */
function niceStep(span: number, target = 5): number {
  if (span <= 0) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return (NICE.find((n) => n * mag >= raw) ?? 10) * mag;
}

const pctLabel = (g: number, exact = false) => {
  const r = exact && Math.abs(g) < 100 ? Math.abs(g).toFixed(1) : String(Math.round(Math.abs(g)));
  return Number(r) === 0 ? '0%' : `${g > 0 ? '+' : '−'}${r}%`;
};

function moneyLabel(v: number, cur: Currency, short: boolean): string {
  const sym = CURRENCIES[cur].symbol;
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a < 1e-9) return `${sym}0`;
  if (short && a >= 1_000_000) return `${sign}${sym}${+(a / 1_000_000).toFixed(1)}m`;
  if (short && a >= 10_000) return `${sign}${sym}${Math.round(a / 1000)}k`;
  if (short && a >= 1000) return `${sign}${sym}${+(a / 1000).toFixed(2)}k`;
  const digits = a >= 100 ? 0 : a >= 1 ? 2 : 4;
  return `${sign}${sym}${a.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** £ / % switch, labelled with the display currency's symbol. */
export function ModeSwitch({ mode, onChange, currency }: { mode: ChartMode; onChange: (m: ChartMode) => void; currency: Currency }) {
  return (
    <div className="seg mode-switch" role="group" aria-label="Show as">
      <button aria-pressed={mode === 'money'} onClick={() => onChange('money')}>{CURRENCIES[currency].symbol}</button>
      <button aria-pressed={mode === 'pct'} onClick={() => onChange('pct')}>%</button>
    </div>
  );
}

/** Line chart with a labelled axis (money or %), gridlines on round steps, and a hover readout. */
export function LineChart({ series, dates, mode, currency, height = 170, readoutTitle, marker }: {
  series: ChartSeries[];
  dates: (string | Date)[];
  mode: ChartMode;
  currency: Currency;
  height?: number;
  /** e.g. "growth since 11 Oct 2023". */
  readoutTitle?: string;
  /** Index to mark with a vertical line (e.g. the demo date). */
  marker?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rate = getRates().rates[currency];
  // Money is drawn in the display currency so gridlines land on round local amounts.
  const vals = series.map((s) => (mode === 'money' ? s.values.map((p) => (p / 100) * rate) : s.values));
  const n = Math.max(...vals.map((v) => v.length));
  if (n < 2) return null;

  const all = vals.flat();
  let lo = Math.min(...all), hi = Math.max(...all);
  if (mode === 'pct') { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1;
  const min = lo - pad, max = hi + pad;
  const step = niceStep(max - min);
  let ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(Number(t.toPrecision(12)));
  const fmtTick = (t: number) => (mode === 'pct' ? pctLabel(t) : moneyLabel(t, currency, true));
  const fmtVal = (v: number) => (mode === 'pct' ? pctLabel(v, true) : moneyLabel(v, currency, false));

  const W = 300, H = height, R = 6, T = 8, B = 8;
  const L = Math.min(52, 10 + Math.max(...ticks.map((t) => fmtTick(t).length)) * 5.2);
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  // Never two labels on top of each other.
  ticks = ticks.filter((t, k) => k === 0 || Math.abs(y(ticks[k - 1]) - y(t)) >= 12);
  const at = hover ?? n - 1;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={series.map((s, k) => `${s.label} ${fmtVal(vals[k][vals[k].length - 1])}`).join(', ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={mode === 'pct' && t === 0 ? 'var(--muted)' : 'var(--line)'}
              strokeWidth={mode === 'pct' && t === 0 ? 1 : 0.6} strokeDasharray={mode === 'pct' && t === 0 ? '3 3' : undefined} />
            <text x={L - 5} y={y(t)} textAnchor="end" dominantBaseline="middle" className="chart-tick">{fmtTick(t)}</text>
          </g>
        ))}
        {marker !== undefined && marker < n - 1 && <line x1={x(marker)} x2={x(marker)} y1={T} y2={H - B} stroke="var(--bronze)" strokeWidth={0.8} strokeDasharray="2 2" />}
        {vals.map((v, k) => (
          <polyline key={k} fill="none" stroke={series[k].colour} strokeWidth={series[k].bold ? 2 : 1.3} strokeLinejoin="round"
            strokeDasharray={series[k].dashed ? '4 3' : undefined}
            points={v.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')} />
        )).reverse()}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth={0.6} />}
        {vals.map((v, k) => v[at] !== undefined && <circle key={k} cx={x(at)} cy={y(v[at])} r={series[k].bold ? 2.6 : 2} fill={series[k].colour} />)}
      </svg>
      <div className="chart-readout">
        <span className="tiny muted">{hover === null ? 'Latest' : fmtDate(dates[hover])}{readoutTitle ? ` · ${readoutTitle}` : ''}</span>
        <div className="legend" style={{ marginTop: 4 }}>
          {series.map((s, k) => {
            const v = vals[k][Math.min(at, vals[k].length - 1)];
            const tone = mode === 'pct' ? (v >= 0 ? 'var(--allow)' : 'var(--block)') : 'var(--ink)';
            return <span key={s.label}><i style={{ background: s.colour }} />{s.label} <b className="num" style={{ color: tone }}>{fmtVal(v)}</b></span>;
          })}
        </div>
      </div>
    </div>
  );
}
