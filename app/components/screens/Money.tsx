'use client';

import { useMemo, useState } from 'react';
import { ASSETS, COURSE_L1, COURSE_L2, CURRENCIES, type Currency } from '@/lib/catalog';
import { basketIndex } from '@/lib/backtest';
import { homeCurrency } from '@/lib/decide';
import { fmtWeek, LAST_WEEK, MARKET_SOURCE, weekDate } from '@/lib/market';
import { COUNTRIES } from '@/lib/packs';
import { valueSeries, type Txn } from '@/lib/portfolio';
import { getRates } from '@/lib/fx';
import { useDemo } from '../demo-state';
import { Back, Coin, MoneyInput, Spark, depositScheme, useMoney } from '../ui';

/** The demo clock. In the app it reads as time passing; the prices are the real ones. */
export function TimeBar() {
  const { s, advance, passADay, shock, clearShocks, dateLabel } = useDemo();
  const atEnd = s.week >= LAST_WEEK;
  return (
    <div className="timebar">
      <div className="between tiny"><span><b>Demo date</b> · {dateLabel}</span><span className="muted">real prices</span></div>
      <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <button className="chip" onClick={passADay}>+1 day</button>
        <button className="chip" disabled={atEnd} onClick={() => advance(1)}>+1 week</button>
        <button className="chip" disabled={atEnd} onClick={() => advance(4)}>+1 month</button>
        <button className="chip" disabled={atEnd} onClick={() => advance(13)}>+3 months</button>
        <button className="chip" disabled={atEnd} onClick={() => advance(LAST_WEEK - s.week)}>To today</button>
        {s.shocks.length === 0
          ? <button className="chip warn" onClick={() => shock(-30)}>What if it fell 30%?</button>
          : <button className="chip" onClick={clearShocks}>Undo the “what if”</button>}
      </div>
    </div>
  );
}

const pct = (bps: number) => `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${Math.abs(bps / 100).toFixed(1)}%`;

function Activity({ txns }: { txns: Txn[] }) {
  const { fmt } = useMoney();
  // One row per action: a basket buy is several transactions with the same week and note.
  const rows = useMemo(() => {
    const m = new Map<string, { week: number; note: string; kind: Txn['kind']; pence: number }>();
    for (const t of txns) {
      const k = `${t.week}|${t.note}|${t.kind}`;
      const r = m.get(k) ?? { week: t.week, note: t.note ?? t.kind, kind: t.kind, pence: 0 };
      r.pence += t.pence;
      m.set(k, r);
    }
    return [...m.values()].reverse().slice(0, 8);
  }, [txns]);
  if (!rows.length) return null;
  return (
    <div className="card">
      <div className="eyebrow" style={{ marginBottom: 4 }}>Activity</div>
      {rows.map((r, i) => (
        <div key={i} className="between small" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
          <span>{r.note}<br /><span className="tiny muted">{fmtWeek(r.week)}</span></span>
          <b className="num" style={{ color: r.kind === 'buy' ? 'var(--ink)' : 'var(--allow)' }}>{r.kind === 'buy' ? '' : '+'}{fmt(r.pence)}</b>
        </div>
      ))}
    </div>
  );
}

export function Home() {
  const { s, go, result, portfolio, pack, requestSellAll, cancelSell, sellNow, buyNow, setPlan, toastClear } = useHomeActions();
  const { fmt, friendly } = useMoney();
  const [sheet, setSheet] = useState<null | 'sell' | 'buy' | 'pause'>(null);
  const [pressured, setPressured] = useState<boolean | null>(null);
  const [amount, setAmount] = useState(5_000);
  const plan = s.plan;

  const series = useMemo(() => (plan ? valueSeries(s.txns, plan.startWeek, s.week, s.shocks) : []), [plan, s.txns, s.week, s.shocks]);
  // How far the basket itself is below its high since the plan started: the fall, separate from new money going in.
  const fall = useMemo(() => {
    if (!plan || s.week <= plan.startWeek) return null;
    const idx = basketIndex(plan.lines, plan.startWeek, s.week).map((v, i) => {
      const w = plan.startWeek + i;
      const shockF = s.shocks.filter((x) => w >= x.week).reduce((f, x) => f * (1 + x.pct / 100), 1);
      return v * shockF;
    });
    const peak = Math.max(...idx);
    const peakAt = idx.indexOf(peak) + plan.startWeek;
    return { pct: (idx[idx.length - 1] / peak - 1) * 100, peakAt };
  }, [plan, s.week, s.shocks]);

  if (!plan) {
    return (
      <div className="phone-scroll">
        <div className="eyebrow" style={{ marginTop: 8 }}>Portfolio</div>
        <h2 className="h2">Nothing invested yet</h2>
        <p className="muted">{result.outcome === 'ALLOW' ? 'Pick a basket and an amount when you’re ready. No rush.' : 'Finish your profile first.'}</p>
        <button className="btn" onClick={() => go(result.outcome === 'ALLOW' ? 'baskets' : 'factfind')}>
          {result.outcome === 'ALLOW' ? 'See baskets' : 'Continue my profile'}
        </button>
      </div>
    );
  }

  const inFall = fall !== null && fall.pct <= -20;
  const savingsShare = s.profile.savings ? ((portfolio.valuePence / (s.profile.savings * 100)) * 100).toFixed(1) : '0';
  const held = s.heldBuyPence > 0;
  const gain = portfolio.valuePence - portfolio.costPence;

  return (
    <>
      <div className="phone-scroll">
        <TimeBar />
        <div className="eyebrow" style={{ marginTop: 12 }}>Portfolio · {plan.name}</div>
        <div className="big-num num">{fmt(portfolio.valuePence)}</div>
        <div className="small num" style={{ marginTop: 4, color: gain >= 0 ? 'var(--allow)' : 'var(--block)' }}>
          {gain >= 0 ? '+' : '−'}{fmt(Math.abs(gain))} ({pct(portfolio.changeBps)}) on {fmt(portfolio.costPence)} invested
        </div>
        {portfolio.takenOutPence > 0 && <div className="tiny muted">{fmt(portfolio.takenOutPence)} taken out so far{portfolio.realisedPence ? ` (${portfolio.realisedPence >= 0 ? 'gain' : 'loss'} of ${fmt(Math.abs(portfolio.realisedPence))} realised)` : ''}</div>}
        <Spark values={series.length > 1 ? series : [0, portfolio.valuePence]} stroke={inFall ? 'var(--steel)' : 'var(--bronze)'} />
        <div className="between tiny muted"><span>{fmtWeek(plan.startWeek)}</span><span>{fmtWeek(s.week)}</span></div>

        {s.toast && <div className="verdict allow small" style={{ padding: 10, marginTop: 8 }} onClick={toastClear}>{s.toast}</div>}

        {held && (
          <div className="card tint small" style={{ marginTop: 10 }}>
            <b>First buy of {fmt(s.heldBuyPence)} waits 24 hours.</b> {pack?.jurisdiction_name} cooling-off for first-time investors. Tap “+1 day” to let it go through, or cancel the plan.
          </div>
        )}

        {inFall && !s.pendingSell && portfolio.valuePence > 0 && (
          <div className="card dark" style={{ marginTop: 10 }}>
            <div className="h3" style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>This has happened before</div>
            <p className="small" style={{ margin: '6px 0 10px' }}>
              Your basket is {Math.abs(fall!.pct).toFixed(0)}% below its high of {fmtWeek(fall!.peakAt)}. Crypto has had bigger falls and recovered,
              though nobody can promise it will. You planned for this: it’s {savingsShare}% of your savings.
              {plan.paused || s.limitReached ? <> You’re at your limit, so there’s nothing to buy. <b>Nothing to do.</b></> : <> Your {friendly(plan.weeklyPence)} a week now buys more. <b>Nothing to do.</b></>}
            </p>
            <div className="row">
              <button className="btn small" style={{ background: '#fff', color: 'var(--ink)', flex: 1 }} onClick={() => setSheet(null)}>Keep my plan</button>
              <button className="btn small ghost" style={{ color: '#cfd6dc', flex: 1 }} onClick={() => { setPressured(null); setSheet('pause'); }}>Sell everything</button>
            </div>
          </div>
        )}

        {s.pendingSell && (
          <div className="card tint">
            <div className="h3">“Sell everything” is on hold until tomorrow</div>
            <p className="small" style={{ margin: '4px 0 10px' }}>We hold every sell-everything in a fall for 24 hours. It goes through at tomorrow’s price, to your own bank account only.</p>
            <button className="btn small secondary" onClick={cancelSell}>Cancel the sale</button>
          </div>
        )}

        <div className="card">
          <div className="between small"><span className="muted">Towards your limit</span>
            <span className="num">{fmt(portfolio.valuePence)} of {fmt(result.limitPence)}</span></div>
          <div className="meter" style={{ marginTop: 8 }}><span style={{ width: `${Math.min(100, (portfolio.valuePence / Math.max(1, result.limitPence)) * 100)}%` }} /></div>
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            {s.limitReached ? 'Limit reached: weekly buying has paused. It restarts by itself if prices fall below your limit.'
              : plan.paused ? 'Your plan is paused.' : `${friendly(plan.weeklyPence)} every Monday. Buying stops automatically at your limit.`}
          </p>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn small secondary" style={{ flex: 1, margin: 0 }} onClick={() => setSheet('buy')}>Buy more</button>
            <button className="btn small secondary" style={{ flex: 1, margin: 0 }} disabled={portfolio.valuePence === 0} onClick={() => { setAmount(Math.min(5_000, portfolio.valuePence)); setSheet('sell'); }}>Sell</button>
            <button className="btn small secondary" style={{ flex: 1, margin: 0 }} onClick={() => setPlan({ paused: !plan.paused })}>{plan.paused ? 'Resume' : 'Pause'}</button>
          </div>
        </div>

        {portfolio.byAsset.length > 0 && (
          <div className="card">
            {portfolio.byAsset.map((h) => {
              const g = h.valuePence - h.costPence;
              return (
                <div className="asset-row" key={h.asset}>
                  <Coin asset={h.asset} />
                  <span><b>{ASSETS[h.asset].name}</b><br /><span className="tiny muted num">{h.units < 1 ? h.units.toFixed(6) : h.units.toFixed(2)} {ASSETS[h.asset].ticker}</span></span>
                  <span style={{ textAlign: 'right' }}><span className="num">{fmt(h.valuePence)}</span><br />
                    <span className="tiny num" style={{ color: g >= 0 ? 'var(--allow)' : 'var(--block)' }}>{g >= 0 ? '+' : '−'}{fmt(Math.abs(g))}</span></span>
                </div>
              );
            })}
          </div>
        )}

        <div className="card">
          <label className="field" style={{ marginTop: 0 }}><span>Weekly amount</span>
            <MoneyInput pence={plan.weeklyPence} onChange={(p) => setPlan({ weeklyPence: p })} label="Weekly amount" step={5} />
          </label>
        </div>

        <Activity txns={s.txns} />
        <button className="btn secondary" style={{ marginTop: 6 }} onClick={() => go('withdraw')}>Move money out</button>
        <p className="tiny muted" style={{ marginTop: 10 }}>Real prices ({MARKET_SOURCE}) replayed from a year ago. Not covered by {depositScheme(pack)}.</p>
      </div>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-label={sheet === 'buy' ? 'Buy more' : sheet === 'sell' ? 'Sell' : 'Before you sell'} onClick={(e) => e.stopPropagation()}>
            {sheet === 'buy' && (
              <>
                <h2 className="h2">Buy more {plan.name}</h2>
                <p className="small muted">At {fmtWeek(s.week)} prices. You have {fmt(Math.max(0, result.limitPence - portfolio.valuePence))} left under your limit.</p>
                <MoneyInput pence={amount} onChange={setAmount} label="Amount" step={10} />
                <button className="btn" style={{ marginTop: 14 }} disabled={amount < 100} onClick={() => { buyNow(amount); setSheet(null); }}>Buy {fmt(amount)}</button>
              </>
            )}
            {sheet === 'sell' && (
              <>
                <h2 className="h2">Sell</h2>
                <p className="small muted">Worth {fmt(portfolio.valuePence)} at {fmtWeek(s.week)} prices. Proceeds go to your own bank account.</p>
                <MoneyInput pence={amount} onChange={(p) => setAmount(Math.min(p, portfolio.valuePence))} label="Amount" step={10} />
                <button className="btn" style={{ marginTop: 14 }} disabled={amount < 100} onClick={() => { sellNow(amount); setSheet(null); }}>Sell {fmt(amount)}</button>
                <button className="btn secondary" onClick={() => { if (inFall) { setPressured(null); setSheet('pause'); } else { sellNow(portfolio.valuePence); setSheet(null); } }}>Sell everything</button>
              </>
            )}
            {sheet === 'pause' && (
              <>
                <h2 className="h2">Pause, don’t panic</h2>
                <p className="small">
                  Selling now turns a fall on paper into a real loss of {fmt(Math.max(0, portfolio.costPence - portfolio.valuePence))}.
                  It’s your money and your call. We hold the order for 24 hours so the decision is yours, not the market’s.
                </p>
                <div className="h3" style={{ marginTop: 14 }}>Has anyone told you to sell or move your money?</div>
                <div className="choices two" style={{ marginTop: 8 }}>
                  <button className="choice compact" aria-pressed={pressured === false} onClick={() => setPressured(false)}>No</button>
                  <button className="choice compact" aria-pressed={pressured === true} onClick={() => setPressured(true)}>Yes</button>
                </div>
                {pressured === true && (
                  <div className="verdict refer small" style={{ marginTop: 12, padding: 12 }}>
                    <b>Please stop and call us first.</b> Being told to move money quickly is how most scams start. {s.brand === 'northbank' ? 'Northbank' : 'Helpline'}: 0800 000 0000, any time.
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <button className="btn" onClick={() => setSheet(null)}>Keep my plan</button>
                  <button className="btn secondary" disabled={pressured !== false} onClick={() => { requestSellAll(); setSheet(null); }}>Sell in 24 hours</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function useHomeActions() {
  const d = useDemo();
  return { ...d, toastClear: () => d.set({ toast: null }) };
}

export function Withdraw() {
  const { s, go, portfolio, sellNow, sendToWallet, cancelTransfer, passADay } = useDemo();
  const { fmt } = useMoney();
  const [dest, setDest] = useState<'bank' | 'wallet'>('bank');
  const [amount, setAmount] = useState(Math.min(10_000, portfolio.valuePence));
  const [address, setAddress] = useState('');
  const [asked, setAsked] = useState<boolean | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const known = s.knownAddresses.includes(address.trim());
  const validAddr = /^(bc1|0x|[13])[a-zA-Z0-9]{20,}$/.test(address.trim());
  const held = s.transfers.filter((t) => t.status === 'held');
  const amt = Math.min(amount, portfolio.valuePence);

  return (
    <>
      <div className="phone-scroll">
        <Back onClick={() => go('home')} />
        <div className="eyebrow">Scam Shield</div>
        <h2 className="h2">Move money out</h2>
        <p className="small muted">Worth {fmt(portfolio.valuePence)} now. Money goes back to your own bank account by default. New wallet addresses wait 24 hours, which stops most crypto scams.</p>
        <div className="choices" style={{ marginTop: 12 }}>
          <button className="choice" aria-pressed={dest === 'bank'} onClick={() => setDest('bank')}>
            <span>{s.brand === 'northbank' ? 'Northbank' : 'Your'} current account ••42<span className="sub">Yours · sold and paid in minutes</span></span>
          </button>
          <button className="choice" aria-pressed={dest === 'wallet'} onClick={() => setDest('wallet')}>
            <span>An external crypto wallet<span className="sub">New addresses: 24-hour hold, once</span></span>
          </button>
        </div>

        <label className="field"><span>Amount</span>
          <MoneyInput pence={amt} onChange={setAmount} label="Amount" step={10} />
        </label>

        {dest === 'wallet' && (
          <>
            <label className="field"><span>Wallet address</span>
              <input className="input mono" placeholder="bc1q… or 0x…" value={address} onChange={(e) => { setAddress(e.target.value); setDone(null); }} />
            </label>
            {address && !validAddr && <p className="tiny" style={{ color: 'var(--block)' }}>That doesn’t look like a Bitcoin or Ethereum address.</p>}
            {validAddr && !known && (
              <div className="card tint small" style={{ marginTop: 10 }}>
                <b>New address: it waits 24 hours, just this once.</b> After that, sends to it go straight through.
                <div className="h3" style={{ marginTop: 10, fontSize: 14 }}>Has anyone asked you to send crypto to this address?</div>
                <div className="choices two" style={{ marginTop: 6 }}>
                  <button className="choice compact" aria-pressed={asked === false} onClick={() => setAsked(false)}>No, it’s my wallet</button>
                  <button className="choice compact" aria-pressed={asked === true} onClick={() => setAsked(true)}>Yes</button>
                </div>
                {asked === true && <div className="verdict refer small" style={{ marginTop: 10, padding: 10 }}><b>Please call us before sending.</b> Nobody genuine ever needs you to send crypto to them.</div>}
              </div>
            )}
            {validAddr && known && <p className="small" style={{ color: 'var(--allow)' }}>✓ Address you’ve used before: no hold.</p>}
          </>
        )}

        {held.map((t) => (
          <div key={t.id} className="card small">
            <div className="between"><b>{fmt(t.pence)} to {t.address.slice(0, 8)}…</b><span className="pill">held until tomorrow</span></div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn small secondary" style={{ margin: 0 }} onClick={() => cancelTransfer(t.id)}>Cancel</button>
              <button className="btn small ghost" style={{ margin: 0 }} onClick={passADay}>Demo: a day passes</button>
            </div>
          </div>
        ))}
        {done && <div className="verdict allow small" style={{ marginTop: 12, padding: 12 }}>{done}</div>}
      </div>
      <div className="phone-foot">
        {dest === 'bank' ? (
          <button className="btn" disabled={amt < 100} onClick={() => { sellNow(amt); setDone(`✓ ${fmt(amt)} sold and on its way to ••42.`); }}>
            {portfolio.valuePence === 0 ? 'Nothing to move yet' : `Sell ${fmt(amt)} to ••42`}
          </button>
        ) : (
          <button className="btn" disabled={amt < 100 || !validAddr || (!known && asked !== false)} onClick={() => {
            const r = sendToWallet(address.trim(), amt);
            setDone(r === 'sent' ? `✓ ${fmt(amt)} sent.` : `Held for 24 hours. We’ll send ${fmt(amt)} tomorrow unless you cancel.`);
            setAsked(null);
          }}>
            {known ? `Send ${fmt(amt)}` : `Send ${fmt(amt)} (after 24h)`}
          </button>
        )}
      </div>
    </>
  );
}

export function Learn() {
  const { s, go, pack } = useDemo();
  const { symbol } = useMoney();
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
            {open === l.title && <p className="small muted">{l.body.replaceAll('{c}', symbol).replaceAll('{deposit}', depositScheme(pack))}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadTaxReport(s: ReturnType<typeof useDemo>['s'], taxLabel: string, cur: Currency) {
  const rate = getRates().rates[cur];
  const rows = [['Date', 'Asset', 'Type', `Amount (${cur})`, 'Units', 'Note']];
  for (const t of s.txns) {
    rows.push([weekDate(t.week).toISOString().slice(0, 10), ASSETS[t.asset].name, t.kind, ((t.pence / 100) * rate).toFixed(2), t.units.toFixed(8), t.note ?? '']);
  }
  rows.push([], [`${taxLabel}. Amounts converted at ${rate} ${cur} per GBP.`]);
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `quolin-${taxLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Country and currency, switchable from inside the app. */
export function PlaceAndCurrency({ compact }: { compact?: boolean }) {
  const { s, moveTo, setCurrency, set, pack, rates } = useDemo();
  const home = homeCurrency(s.profile.country);
  return (
    <div>
      <label className="field" style={{ marginTop: compact ? 0 : undefined }}><span>I live in <span className="hint">· picks the rules</span></span>
        <select className="select" value={s.profile.country} onChange={(e) => moveTo(e.target.value)}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}{c.pack ? '' : ' (no rules signed yet)'}</option>)}
        </select>
      </label>
      {pack && <p className="tiny muted" style={{ margin: '6px 0 0' }}>{pack.regulator} · {pack.local.highlights.join(' · ')}</p>}
      <div className="field"><span>Show amounts in</span>
        <div className="seg wrap">
          {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
            <button key={c} aria-pressed={s.currency === c} onClick={() => setCurrency(c)}>{CURRENCIES[c].symbol} {c}</button>
          ))}
        </div>
      </div>
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
        {s.currency === 'GBP' ? 'Base currency.' : `£1 = ${CURRENCIES[s.currency].symbol}${rates.rates[s.currency].toFixed(4)}`} · {rates.source === 'live' ? `ECB reference rate, ${rates.asOf}` : `rates as of ${rates.asOf}`}
        {s.currencyPinned && home && s.currency !== home && <> · <button className="link tiny" onClick={() => set({ currency: home, currencyPinned: false })}>Use {home}, my country’s currency</button></>}
      </p>
    </div>
  );
}

export function Account() {
  const { s, set, go, result, pack, portfolio } = useDemo();
  const { fmt, currency } = useMoney();
  const [beneficiary, setBeneficiary] = useState(s.beneficiary);

  return (
    <div className="phone-scroll">
      <div className="eyebrow" style={{ marginTop: 8 }}>Account</div>
      <h2 className="h2">{s.profile.name || 'You'}</h2>
      <div className="card">
        <PlaceAndCurrency compact />
      </div>
      <div className="card">
        <dl className="kv">
          <dt>Rules</dt><dd>{pack ? `${pack.jurisdiction_name} v${pack.version} (illustrative)` : 'None signed yet'}</dd>
          <dt>Profile</dt><dd>{result.outcome === 'ALLOW' ? '✓ Ready' : result.reasons[0]?.title ?? '—'}</dd>
          <dt>Limit</dt><dd className="num">{fmt(result.limitPence)}</dd>
          <dt>Invested</dt><dd className="num">{fmt(portfolio.valuePence)}</dd>
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
        <div className="eyebrow" style={{ marginBottom: 6 }}>Done for you · tax</div>
        <p className="small" style={{ margin: '0 0 8px' }}>{pack?.local.tax ?? 'Tax rules depend on where you live.'}</p>
        <button className="btn secondary small" style={{ width: '100%' }} disabled={!s.txns.length} onClick={() => downloadTaxReport(s, pack?.local.tax_report ?? 'Transaction statement', currency)}>
          Download {pack?.local.tax_report ?? 'statement'} ({currency})
        </button>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>Every buy, sale and transfer with its price: a statement your accountant understands. {s.txns.length ? `${s.txns.length} transactions.` : 'Empty until your first buy.'}</p>
      </div>
    </div>
  );
}
