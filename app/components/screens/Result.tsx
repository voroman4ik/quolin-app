'use client';

import { useEffect, useMemo, useState } from 'react';
import { BASKETS } from '@/lib/catalog';
import { resolveBasket } from '@/lib/decide';
import { canonical } from '@/lib/engine/chain';
import { useDemo } from '../demo-state';
import { Back, OUTCOME_META, Progress, useMoney } from '../ui';

// Effects run twice in development; one decision is one record.
const recorded = new Set<string>();

export function suggestedWeekly(limitPence: number): number {
  const raw = Math.round(limitPence / 48 / 500) * 500;
  return Math.min(10_000, Math.max(1000, raw));
}

export function Result() {
  const { s, set, go, setProfile, result, pack, log } = useDemo();
  const { fmt, friendly } = useMoney();
  const [showRules, setShowRules] = useState(false);
  const [reminded, setReminded] = useState(false);
  const meta = OUTCOME_META[result.outcome];
  const d = result.determination;

  useEffect(() => {
    const key = canonical({ c: s.clientId, snap: result.snapshot, p: d?.pack_id, v: d?.pack_version });
    if (recorded.has(key)) return;
    recorded.add(key);
    log({
      kind: 'onboarding', jurisdiction: pack?.jurisdiction_name ?? null,
      pack_id: d?.pack_id ?? null, pack_version: d?.pack_version ?? null,
      outcome: result.outcome, summary: meta.label, reasons: result.reasons,
      limit_pence: result.limitPence, snapshot: result.snapshot, determination: d,
    });
  }, [result, d, pack, log, meta.label, s.clientId]);

  const baskets = useMemo(
    () => (pack ? BASKETS.map((b) => ({ b, r: resolveBasket(pack, s.profile, b.lines, b.level) })) : []),
    [pack, s.profile],
  );

  const weekly = suggestedWeekly(result.limitPence);
  // A question only this country asks, not yet answered (e.g. after moving country).
  const localGap = d?.findings.some((f) => f.missing_field && pack?.local.questions.some((q) => `client.${q.field}` === f.missing_field));
  const cap = (pack?.thresholds.max_crypto_concentration_bps as number) ?? 1000;
  const marker = Math.min(95, (result.limitBps / cap) * 62);
  const headline = {
    ALLOW: 'Profile ready',
    NOT_YET: 'Not yet, and here’s why',
    REFER: 'Let’s talk it through',
    NOT_FOR_YOU: 'Not right for you',
  }[result.outcome];

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => { set({ factStep: 3 }); go('factfind'); }} label="Change an answer" />
        <Progress step={6} of={6} />
        <div className="eyebrow">Step 6 of 6 · Your profile</div>
        <h2 className="h2">{headline}</h2>
        {pack && <p className="tiny muted" style={{ margin: '-4px 0 0' }}>Decided under {pack.jurisdiction_name} rules · {pack.regulator}</p>}

        {result.outcome === 'ALLOW' ? (
          <>
            <div className="card" style={{ marginTop: 12 }}>
              <div className="eyebrow">Your safe amount</div>
              <p className="small muted" style={{ marginTop: 4 }}>Based on your savings, goals and how much loss you can absorb.</p>
              <div className="small">You can invest up to</div>
              <div className="big-num num">{fmt(result.limitPence)}</div>
              <div className="small muted num" style={{ marginTop: 6 }}>
                {result.limitBps / 100}% of your {fmt(s.profile.savings * 100)} savings
              </div>
              <div className="gauge" aria-hidden><i style={{ left: `${marker}%` }} /></div>
              <div className="between tiny muted"><span>Comfortable</span><span>Too much</span></div>
            </div>
            <div className="card tint" style={{ marginTop: 12 }}>
              We suggest <b>{friendly(weekly)} a week</b>, so you buy at many prices, not one. Buying stops
              automatically at your limit.
            </div>
            <div className="card">
              <div className="between"><span className="pill allow">Unlocked</span>
                <span className="small">{baskets.filter((x) => x.r.available && x.b.level <= Math.max(1, s.profile.knowledgeLevel)).map((x) => x.b.name).join(' · ') || 'None here yet'}</span>
              </div>
              {baskets.filter((x) => !x.r.available).map(({ b }) => (
                <div className="between" key={b.id} style={{ marginTop: 8 }}>
                  <span className="pill">Not here yet</span>
                  <span className="small muted">{b.name} (awaiting approval in {pack?.jurisdiction_name})</span>
                </div>
              ))}
              <div className="between" style={{ marginTop: 8 }}>
                <span className={`pill ${s.profile.knowledgeLevel >= 2 ? 'allow' : ''}`}>{s.profile.knowledgeLevel >= 2 ? 'Unlocked' : 'Locked'}</span>
                <span className="small muted">{[...baskets.filter((x) => x.r.available && x.b.level === 2).map((x) => x.b.name), 'Build your own'].join(' · ')} (Level 2)</span>
              </div>
            </div>
          </>
        ) : (
          <div className={`verdict ${meta.cls}`} style={{ marginTop: 12 }}>
            <div className="icon">{meta.icon}</div>
            <div className="h3">{meta.label}</div>
            {result.reasons.map((r) => (
              <div key={r.rule_id + r.title} style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="small">{r.plain_english}</div>
              </div>
            ))}
            {result.outcome === 'REFER' && (
              <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
                Someone from {s.brand === 'northbank' ? 'Northbank' : 'your bank'} will call within 2 working days. Nothing has been bought.
              </p>
            )}
          </div>
        )}

        <button className="link small" style={{ marginTop: 16 }} onClick={() => setShowRules((x) => !x)}>
          {showRules ? 'Hide' : 'How we decided'}
        </button>
        {showRules && d && (
          <div className="card trace" style={{ marginTop: 8 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              {pack?.jurisdiction_name} rules, version {d.pack_version} · {pack?.content_status.toLowerCase()} · recorded
            </div>
            {pack?.rules.filter((r) => r.stage === 'onboarding').map((r) => {
              const f = d.findings.find((x) => x.rule_id === r.rule_id);
              return (
                <div className="rule" key={r.rule_id}>
                  <span className={`mark ${f ? (f.outcome === 'BLOCK' ? 'no' : 'wait') : 'ok'}`}>{f ? (f.outcome === 'BLOCK' ? '✕' : '?') : '✓'}</span>
                  <span>{r.title}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="phone-foot">
        {result.outcome === 'ALLOW' && (
          <button className="btn" onClick={() => { set({ weeklyPence: weekly, initialPence: Math.min(s.initialPence, result.limitPence) }); go('baskets'); }}>See my baskets</button>
        )}
        {result.reasons.some((r) => r.rule_id === 'ON-KNOW-01') && (
          <button className="btn" onClick={() => { setProfile({ knowledgeScore: null }); go('course'); }}>
            Retake the course <span className="tiny" style={{ opacity: 0.7 }}>(demo skips the 24h wait)</span>
          </button>
        )}
        {result.outcome === 'NOT_YET' && !result.reasons.some((r) => r.rule_id === 'ON-KNOW-01') && (
          <button className="btn" disabled={reminded} onClick={() => setReminded(true)}>
            {reminded ? '✓ We’ll check in with you in 3 months' : 'Remind me in 3 months'}
          </button>
        )}
        {localGap && (
          <button className="btn" onClick={() => { set({ factStep: 0 }); go('factfind'); }}>Answer {pack?.jurisdiction_name}’s question</button>
        )}
        {result.outcome !== 'ALLOW' && (
          <button className="btn secondary" onClick={() => { set({ factStep: 1 }); go('factfind'); }}>Change an answer</button>
        )}
      </div>
    </>
  );
}
