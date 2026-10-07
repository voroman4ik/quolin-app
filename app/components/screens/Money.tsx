'use client';

import { useState } from 'react';
import { ASSETS, COURSE_L1, COURSE_L2, CURRENCIES, type Currency } from '@/lib/catalog';
import { COUNTRIES } from '@/lib/packs';
import { useDemo } from '../demo-state';
import { Back, Coin, DEPOSIT_SCHEME, useMoney } from '../ui';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Spark({ weeks, crash }: { weeks: number; crash: boolean }) {
  const n = 40;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    let v = 1 + 0.12 * t + 0.035 * Math.sin(i * 1.7) + 0.02 * Math.sin(i * 0.6);
    if (crash && t > 0.8) v *= 1 - 0.3 * ((t - 0.8) / 0.2);
    return v;
  });
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1)) * 300},${70 - ((v - min) / (max - min)) * 60}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 300 80" preserveAspectRatio="none" aria-label={`Value over ${weeks} weeks`}>
      <path d={d} fill="none" stroke={crash ? 'var(--steel)' : 'var(--bronze)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Home() {
  const { s, set, go, result, portfolio, log, pack } = useDemo();
  const { fmt, friendly } = useMoney();
  const [sellOpen, setSellOpen] = useState(false);
  const [pressured, setPressured] = useState<boolean | null>(null);
  const plan = s.plan;
  const savingsShare = s.profile.savings ? ((portfolio.valuePence / (s.profile.savings * 100)) * 100).toFixed(1) : '0';

  if (!plan) {
    return (
      <div className="phone-scroll">
        <div className="eyebrow" style={{ marginTop: 8 }}>Portfolio</div>
        <h2 className="h2">Nothing invested yet</h2>
        <p className="muted">{result.outcome === 'ALLOW' ? 'Pick a basket and a weekly amount when you’re ready. No rush.' : 'Finish your profile first.'}</p>
        <button className="btn" onClick={() => go(result.outcome === 'ALLOW' ? 'baskets' : 'factfind')}>
          {result.outcome === 'ALLOW' ? 'See baskets' : 'Continue my profile'}
        </button>
      </div>
    );
  }

  const waiting = s.weeks === 0;
  const firstBuy = plan.firstBuyAt && !s.coolingOffDone ? plan.firstBuyAt : null;

  return (
    <>
      <div className="phone-scroll">
        <div className="eyebrow" style={{ marginTop: 8 }}>Portfolio · {plan.name}</div>
        {waiting ? (
          <>
            <h2 className="h2">Your plan is set</h2>
            <div className="card">
              <div className="between small"><span className="muted">Each Monday</span><b>{friendly(plan.weeklyPence)}</b></div>
              <div className="between small" style={{ marginTop: 6 }}>
                <span className="muted">First buy</span><b>{firstBuy ? fmtDate(firstBuy) : 'Next Monday'}</b>
              </div>
              {firstBuy && <p className="tiny muted" style={{ margin: '10px 0 0' }}>24-hour cooling-off for first-time investors. You can cancel until then.</p>}
            </div>
            {firstBuy && (
              <button className="btn secondary" onClick={() => set({ coolingOffDone: true })}>Skip the 24 hours <span className="tiny muted">(demo)</span></button>
            )}
            <button className="btn ghost small" style={{ margin: '12px auto 0' }} onClick={() => set({ weeks: 26, coolingOffDone: true })}>
              Demo: fast-forward 6 months →
            </button>
          </>
        ) : (
          <>
            <div className="small muted" style={{ marginTop: 6 }}>Your crypto</div>
            <div className="big-num num">{fmt(portfolio.valuePence)}</div>
            <div className="small num" style={{ marginTop: 6, color: 'var(--muted)' }}>
              {s.market === 'crash' ? '−30% this month' : `${portfolio.changeBps >= 0 ? '+' : ''}${(portfolio.changeBps / 100).toFixed(1)}% since you started`}
              {' · '}{fmt(portfolio.investedPence)} paid in
            </div>
            <Spark weeks={s.weeks} crash={s.market === 'crash'} />

            {s.market === 'crash' && !s.sellPendingUntil && (
              <div className="card dark" style={{ marginTop: 6 }}>
                <div className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>This has happened before</div>
                <p className="small" style={{ margin: '6px 0 10px' }}>
                  Crypto has had five falls bigger than this one. You planned for it: this is {savingsShare}% of your savings.
                  Your weekly {friendly(plan.weeklyPence)} now buys more. <b>Nothing to do.</b>
                </p>
                <div className="row">
                  <button className="btn small" style={{ background: '#fff', color: 'var(--ink)', flex: 1 }} onClick={() => set({ market: 'normal' })}>Keep my plan</button>
                  <button className="btn small ghost" style={{ color: '#cfd6dc', flex: 1 }} onClick={() => { setPressured(null); setSellOpen(true); }}>Sell everything</button>
                </div>
              </div>
            )}

            {s.sellPendingUntil && (
              <div className="card tint">
                <div className="h3">Sale scheduled for {fmtDate(s.sellPendingUntil)}</div>
                <p className="small" style={{ margin: '4px 0 10px' }}>We hold every “sell everything” for 24 hours. Proceeds go to your own bank account only.</p>
                <button className="btn small secondary" onClick={() => set({ sellPendingUntil: null })}>Cancel the sale</button>
              </div>
            )}

            <div className="card">
              <div className="between small"><span className="muted">Towards your limit</span>
                <span className="num">{fmt(portfolio.investedPence)} of {fmt(result.limitPence)}</span></div>
              <div className="meter" style={{ marginTop: 8 }}><span style={{ width: `${Math.min(100, (portfolio.investedPence / Math.max(1, result.limitPence)) * 100)}%` }} /></div>
              {portfolio.capped && <p className="tiny muted" style={{ margin: '8px 0 0' }}>Limit reached: buying has paused.</p>}
            </div>

            <div className="card">
              {plan.lines.map((l) => (
                <div className="asset-row" key={l.asset}>
                  <Coin asset={l.asset} />
                  <span><b>{ASSETS[l.asset].name}</b><br /><span className="tiny muted">{Math.round(l.weight_bps / 100)}% of basket</span></span>
                  <span className="num">{fmt(Math.round((portfolio.valuePence * l.weight_bps) / 10_000))}</span>
                </div>
              ))}
            </div>

            {s.market === 'normal' && !s.sellPendingUntil && (
              <button className="btn ghost small" style={{ margin: '12px auto 0' }} onClick={() => set({ market: 'crash' })}>Demo: the market falls 30% →</button>
            )}
          </>
        )}
        <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => go('withdraw')}>Move money out</button>
        <p className="tiny muted" style={{ marginTop: 10 }}>Indicative values. Not covered by {DEPOSIT_SCHEME[pack?.pack_id ?? 'UK']}.</p>
      </div>

      {sellOpen && (
        <div className="sheet-backdrop" onClick={() => setSellOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Before you sell" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">Pause, don’t panic</h2>
            <p className="small">
              Selling now turns a fall on paper into a real loss of {fmt(Math.max(0, portfolio.investedPence - portfolio.valuePence))}.
              It’s your money and your call. We hold the order for 24 hours so the decision is yours, not the market’s.
            </p>
            <div className="h3" style={{ marginTop: 14 }}>Has anyone told you to sell or move your money?</div>
            <div className="choices two" style={{ marginTop: 8 }}>
              <button className="choice compact" aria-pressed={pressured === false} onClick={() => setPressured(false)}>No</button>
              <button className="choice compact" aria-pressed={pressured === true} onClick={() => setPressured(true)}>Yes</button>
            </div>
            {pressured === true && (
              <div className="verdict refer small" style={{ marginTop: 12, padding: 12 }}>
                <b>Please stop and call us first.</b> Being told to move money quickly is how most scams start. Northbank: 0800 000 0000, any time.
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setSellOpen(false)}>Keep my plan</button>
              <button className="btn secondary" disabled={pressured !== false} onClick={() => {
                const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
                set({ sellPendingUntil: until });
                log({ kind: 'sell_request', jurisdiction: pack?.jurisdiction_name ?? null, pack_id: pack?.pack_id ?? null, pack_version: pack?.version ?? null,
                  outcome: 'NOTED', summary: `Sell everything requested during a 30% fall · held 24h · pressure check: no`, reasons: [] });
                setSellOpen(false);
              }}>Sell in 24 hours</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Withdraw() {
  const { s, go, portfolio, log, pack } = useDemo();
  const { fmt } = useMoney();
  const [dest, setDest] = useState<'bank' | 'wallet'>('bank');
  const [done, setDone] = useState(false);
  const amount = portfolio.valuePence;

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('home')} />
        <div className="eyebrow">Scam Shield</div>
        <h2 className="h2">Move money out</h2>
        <p className="small muted">Money only goes back to your own bank account. That one rule stops most crypto scams.</p>
        <div className="choices" style={{ marginTop: 12 }}>
          <button className="choice" aria-pressed={dest === 'bank'} onClick={() => setDest('bank')}>
            <span>Northbank current account ••42<span className="sub">Yours · arrives in minutes</span></span>
          </button>
          <button className="choice" aria-pressed={dest === 'wallet'} onClick={() => setDest('wallet')}>
            <span>An external crypto wallet<span className="sub">Locked for new customers</span></span>
          </button>
        </div>
        {dest === 'wallet' && (
          <div className="card tint small" style={{ marginTop: 12 }}>
            <b>External wallets unlock after 90 days.</b> Then each new wallet waits 24 hours before its first transfer, and we’ll ask:
            <i> has anyone asked you to do this?</i> Nobody genuine ever needs you to send crypto to them.
          </div>
        )}
        {done && <div className="verdict allow small" style={{ marginTop: 12, padding: 12 }}>✓ {fmt(amount)} is on its way to your account ••42.</div>}
      </div>
      <div className="phone-foot">
        <button className="btn" disabled={dest !== 'bank' || amount === 0 || done} onClick={() => {
          setDone(true);
          log({ kind: 'withdrawal', jurisdiction: pack?.jurisdiction_name ?? null, pack_id: pack?.pack_id ?? null, pack_version: pack?.version ?? null,
            outcome: 'NOTED', summary: `${fmt(amount)} to own bank account ••42 (closed loop)`, reasons: [] });
        }}>
          {amount === 0 ? 'Nothing to move yet' : `Send ${fmt(amount)} to ••42`}
        </button>
        {s.plan === null && <p className="tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>Start a plan first.</p>}
      </div>
    </>
  );
}

export function Learn() {
  const { s, go } = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const lvl = s.profile.knowledgeLevel;
  return (
    <div className="phone-scroll">
      <div className="eyebrow" style={{ marginTop: 8 }}>Learn</div>
      <h2 className="h2">What you’ve unlocked</h2>
      <div className="card">
        <div className="between"><b>Level 1 · The basics</b><span className={`pill ${lvl >= 1 ? 'allow' : ''}`}>{lvl >= 1 ? `✓ Passed ${s.profile.knowledgeScore ?? ''}/5` : 'Not yet'}</span></div>
        <div className="small muted">Unlocks Core, Digital Gold and Steady.</div>
        <hr className="divider" />
        <div className="between"><b>Level 2 · Beyond Bitcoin</b><span className={`pill ${lvl >= 2 ? 'allow' : ''}`}>{lvl >= 2 ? '✓ Passed' : 'Locked'}</span></div>
        <div className="small muted">Unlocks Build your own, with Solana capped at 10%.</div>
        {lvl === 1 && <button className="btn small" style={{ marginTop: 10 }} onClick={() => go('course2')}>Take Level 2 · 3 lessons</button>}
      </div>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>The Approved List</div>
        <p className="small">An asset is only offered if it passes every one of these, and your bank signs it off:</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Years of history and deep, liquid markets</li>
          <li>Held by a regulated custodian</li>
          <li>No anonymous issuer</li>
          <li>No leverage, no meme coins</li>
          <li>Approved for retail investors where you live</li>
        </ul>
      </div>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Lessons</div>
        {[...COURSE_L1, ...COURSE_L2].map((l) => (
          <div key={l.title} style={{ borderTop: '1px solid var(--line)' }}>
            <button className="between" style={{ width: '100%', background: 'none', border: 0, padding: '10px 0', textAlign: 'left' }}
              onClick={() => setOpen(open === l.title ? null : l.title)} aria-expanded={open === l.title}>
              <span className="small">{l.title}</span><span className="muted">{open === l.title ? '−' : '+'}</span>
            </button>
            {open === l.title && <p className="small muted">{l.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadTaxReport(s: ReturnType<typeof useDemo>['s']) {
  const plan = s.plan;
  const rows = [['Date', 'Asset', 'Type', 'Amount (GBP)', 'Units', 'Cost basis (GBP)']];
  if (plan) {
    const start = new Date(plan.startedAt);
    for (let w = 0; w < s.weeks; w++) {
      const date = new Date(start.getTime() + w * 7 * 86400_000).toISOString().slice(0, 10);
      const drift = 1 + (0.12 * w) / Math.max(1, s.weeks);
      for (const l of plan.lines) {
        const pence = Math.round((plan.weeklyPence * l.weight_bps) / 10_000);
        const units = pence / (ASSETS[l.asset].price_pence * drift);
        rows.push([date, ASSETS[l.asset].name, 'Buy', (pence / 100).toFixed(2), units.toFixed(8), (pence / 100).toFixed(2)]);
      }
    }
  }
  rows.push([], ['Disposals this tax year: none']);
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'quolin-cgt-report-2026-27.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export function Account() {
  const { s, set, go, result, pack, portfolio } = useDemo();
  const { fmt } = useMoney();
  const [beneficiary, setBeneficiary] = useState(s.beneficiary);
  const country = COUNTRIES.find((c) => c.code === s.profile.country)?.name;

  return (
    <div className="phone-scroll">
      <div className="eyebrow" style={{ marginTop: 8 }}>Account</div>
      <h2 className="h2">{s.profile.name || 'You'}</h2>
      <div className="card">
        <dl className="kv">
          <dt>Lives in</dt><dd>{country}</dd>
          <dt>Rules</dt><dd>{pack ? `${pack.jurisdiction_name} v${pack.version} (illustrative)` : 'None signed yet'}</dd>
          <dt>Limit</dt><dd className="num">{fmt(result.limitPence)}</dd>
          <dt>Show in</dt>
          <dd>
            <div className="seg">
              {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                <button key={c} aria-pressed={s.currency === c} onClick={() => set({ currency: c })}>{c}</button>
              ))}
            </div>
          </dd>
        </dl>
        <button className="link small" style={{ marginTop: 10 }} onClick={() => { set({ factStep: 0 }); go('factfind'); }}>Update my fact-find</button>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Recovery, like your bank</div>
        <p className="small" style={{ margin: 0 }}>No seed phrase to lose. Forgot your password? Reset it the way you would at your bank. Lost your phone? Call us and we lock it.</p>
        <p className="small" style={{ margin: '8px 0 0' }}><b>Helpline:</b> 0800 000 0000 · a person answers, any time.</p>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>If something happens to you</div>
        <label className="field" style={{ marginTop: 0 }}><span>Named beneficiary</span>
          <input className="input" placeholder="Full name" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
        </label>
        <button className="btn small" style={{ marginTop: 10 }} disabled={!beneficiary.trim() || beneficiary === s.beneficiary}
          onClick={() => set({ beneficiary: beneficiary.trim() })}>
          {s.beneficiary && beneficiary === s.beneficiary ? '✓ Saved' : 'Save'}
        </button>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>Passed on through the bank’s normal process. No keys to find.</p>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Done for you</div>
        <button className="btn secondary small" style={{ width: '100%' }} onClick={() => downloadTaxReport(s)}>
          Download tax report (CGT, 2026/27)
        </button>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>Every buy and sale with its cost basis: a statement your accountant understands. {portfolio.investedPence ? '' : 'Empty until your first buy.'}</p>
      </div>
    </div>
  );
}
