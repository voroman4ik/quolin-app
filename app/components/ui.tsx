'use client';

import { ASSETS, CURRENCIES, friendly, money, price, toBasePence, type AssetId } from '@/lib/catalog';
import type { ConsumerOutcome } from '@/lib/decide';
import { useDemo } from './demo-state';

export function Wordmark({ brand }: { brand?: 'quolin' | 'northbank' }) {
  if (brand === 'northbank') {
    return <span className="wordmark">Northbank<small>Crypto by Quolin</small></span>;
  }
  return <span className="wordmark">Quolin<i>.</i></span>;
}

export function useMoney() {
  const { s, rates } = useDemo();
  return {
    fmt: (pence: number, exact = false) => money(pence, s.currency, { exact }),
    friendly: (pence: number) => friendly(pence, s.currency),
    price: (pence: number) => price(pence, s.currency),
    /** Typed in the display currency → GBP pence for the engine. */
    toBase: (amount: number) => toBasePence(amount, s.currency),
    /** GBP pence → a whole number in the display currency, for input fields. */
    toLocal: (pence: number) => Math.round((pence / 100) * rates.rates[s.currency]),
    symbol: CURRENCIES[s.currency].symbol,
    currency: s.currency,
  };
}

/** An amount field in the person's own currency; the engine always gets GBP pence. */
export function MoneyInput({ pence, onChange, label, step }: { pence: number; onChange: (p: number) => void; label?: string; step?: number }) {
  const { symbol, toBase, toLocal } = useMoney();
  const local = toLocal(pence);
  return (
    <div className="money-input" aria-label={label}>
      <b>{symbol}</b>
      <input className="input num" inputMode="numeric" value={local ? String(local) : ''} aria-label={label}
        onChange={(e) => onChange(toBase(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0))} />
      {step && (
        <span className="row" style={{ gap: 6 }}>
          <button type="button" className="mini" aria-label="Less" onClick={() => onChange(Math.max(0, toBase(local - step)))}>−</button>
          <button type="button" className="mini" aria-label="More" onClick={() => onChange(toBase(local + step))}>+</button>
        </span>
      )}
    </div>
  );
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')}>×</button>}
    </label>
  );
}

export const matches = (q: string, ...fields: string[]) => {
  const t = q.trim().toLowerCase();
  return !t || fields.some((f) => f.toLowerCase().includes(t));
};

export function Choice<T extends string | number | boolean>({
  value, current, onPick, label, sub, compact,
}: { value: T; current: T | null | undefined; onPick: (v: T) => void; label: string; sub?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      className={`choice${compact ? ' compact' : ''}`}
      aria-pressed={current === value}
      onClick={() => onPick(value)}
    >
      <span>
        {label}
        {sub && <span className="sub">{sub}</span>}
      </span>
    </button>
  );
}

export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div className="progress" aria-label={`Step ${step} of ${of}`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={i < step ? 'on' : ''} />)}
    </div>
  );
}

export function WeightBar({ lines }: { lines: { asset: AssetId; weight_bps: number }[] }) {
  return (
    <>
      <div className="wbar">
        {lines.map((l) => (
          <span key={l.asset} style={{ width: `${l.weight_bps / 100}%`, background: ASSETS[l.asset].colour }} />
        ))}
      </div>
      <div className="legend">
        {lines.map((l) => (
          <span key={l.asset}>
            <i style={{ background: ASSETS[l.asset].colour }} />
            {ASSETS[l.asset].name} {Math.round(l.weight_bps / 100)}%
          </span>
        ))}
      </div>
    </>
  );
}

export function Coin({ asset, size = 34 }: { asset: AssetId; size?: number }) {
  const a = ASSETS[asset];
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="coin" src={a.logo} alt={`${a.name} logo`} width={size} height={size} style={{ width: size, height: size }} />;
}

export const OUTCOME_META: Record<ConsumerOutcome, { cls: string; icon: string; label: string }> = {
  ALLOW: { cls: 'allow', icon: '✓', label: 'Allow' },
  NOT_YET: { cls: 'notyet', icon: '◷', label: 'Not yet' },
  REFER: { cls: 'refer', icon: '⟳', label: 'Refer to a person' },
  NOT_FOR_YOU: { cls: 'block', icon: '✕', label: 'Not for you' },
};

export function OutcomePill({ outcome }: { outcome: ConsumerOutcome | string }) {
  const engine: Record<string, { cls: string; icon: string; label: string }> = {
    BLOCK: { cls: 'block', icon: '✕', label: 'Blocked' }, NOTED: { cls: '', icon: '•', label: 'Recorded' },
  };
  const meta = OUTCOME_META[outcome as ConsumerOutcome] ?? engine[outcome];
  if (!meta) return <span className="pill">{outcome}</span>;
  return <span className={`pill ${meta.cls}`}>{meta.icon} {meta.label}</span>;
}

export function Back({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="back" onClick={onClick}>‹ {label}</button>;
}

/** The deposit scheme people will assume covers them, named so we can say it doesn't. */
export function depositScheme(pack: { local: { deposit_scheme: string } } | null): string {
  return pack?.local.deposit_scheme ?? 'deposit protection';
}

export function Spark({ values, stroke = 'var(--bronze)', height = 70, marks, range }: { values: number[]; stroke?: string; height?: number; marks?: number[]; range?: [number, number] }) {
  if (values.length < 2) return null;
  const [min, max] = range ?? [Math.min(...values), Math.max(...values)];
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * 300;
  const y = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden>
      {marks?.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={height} stroke="var(--line)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
