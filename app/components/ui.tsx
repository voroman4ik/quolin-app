'use client';

import { ASSETS, friendly, money, type AssetId } from '@/lib/catalog';
import type { ConsumerOutcome } from '@/lib/decide';
import { useDemo } from './demo-state';

export function Wordmark({ brand }: { brand?: 'quolin' | 'northbank' }) {
  if (brand === 'northbank') {
    return <span className="wordmark">Northbank<small>Crypto by Quolin</small></span>;
  }
  return <span className="wordmark">Quolin<i>.</i></span>;
}

export function useMoney() {
  const { s } = useDemo();
  return {
    fmt: (pence: number, exact = false) => money(pence, s.currency, { exact }),
    friendly: (pence: number) => friendly(pence, s.currency),
    currency: s.currency,
  };
}

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

export function Coin({ asset }: { asset: AssetId }) {
  return <span className="coin" style={{ background: ASSETS[asset].colour }}>{ASSETS[asset].ticker.slice(0, 3)}</span>;
}

export const OUTCOME_META: Record<ConsumerOutcome, { cls: string; icon: string; label: string }> = {
  ALLOW: { cls: 'allow', icon: '✓', label: 'Allow' },
  NOT_YET: { cls: 'notyet', icon: '◷', label: 'Not yet' },
  REFER: { cls: 'refer', icon: '⟳', label: 'Refer to a person' },
  NOT_FOR_YOU: { cls: 'block', icon: '✕', label: 'Not for you' },
};

export function OutcomePill({ outcome }: { outcome: ConsumerOutcome | string }) {
  const meta = OUTCOME_META[outcome as ConsumerOutcome];
  if (!meta) return <span className="pill">{outcome}</span>;
  return <span className={`pill ${meta.cls}`}>{meta.icon} {meta.label}</span>;
}

export function Back({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="back" onClick={onClick}>‹ {label}</button>;
}

/** The deposit scheme people will assume covers them, named so we can say it doesn't. */
export const DEPOSIT_SCHEME: Record<string, string> = {
  UK: 'FSCS', SG: 'SDIC deposit insurance', EU: 'deposit guarantee schemes', HK: 'the Deposit Protection Scheme',
};
