'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AssetId, BasketId, Currency } from '@/lib/catalog';
import {
  checkPurchase, decideOnboarding, EMPTY_PROFILE, headroomPence, homeCurrency, jurisdictionOf,
  type Funding, type OnboardingResult, type Profile,
} from '@/lib/decide';
import type { Determination, Pack } from '@/lib/engine/types';
import { getRates, subscribeFx, type Rates } from '@/lib/fx';
import { activePack, packVersions, record, subscribe, type LedgerBody } from '@/lib/ledger';
import { fmtWeek, getHistory, subscribeHistory, type Shock } from '@/lib/market';
import type { Period } from '@/lib/backtest';
import type { Jurisdiction } from '@/lib/packs';
import { buyLines, sellPro, summarise, valueAt, type Line, type Summary, type Txn } from '@/lib/portfolio';

export type { Line } from '@/lib/portfolio';

export type Screen =
  | 'welcome' | 'factfind' | 'course' | 'result'
  | 'home' | 'baskets' | 'basket' | 'build' | 'plan' | 'asset' | 'explore'
  | 'learn' | 'course2' | 'account' | 'withdraw' | 'backtest';

export interface Plan {
  name: string;
  lines: Line[];
  weeklyPence: number;
  initialPence: number;
  funding: Funding;
  startWeek: number;
  paused: boolean;
}

export interface PendingTransfer {
  id: number;
  address: string;
  pence: number;
  requestedWeek: number;
  status: 'held' | 'sent' | 'cancelled';
}

export interface DemoState {
  screen: Screen;
  factStep: number;
  profile: Profile;
  currency: Currency;
  /** True once the person picks a currency themselves; until then it follows the country. */
  currencyPinned: boolean;
  brand: 'quolin' | 'northbank';
  clientId: string;
  selectedBasket: BasketId | null;
  selectedAsset: AssetId | null;
  custom: Partial<Record<AssetId, number>>;
  draft: { name: string; lines: Line[] } | null;
  weeklyPence: number;
  initialPence: number;
  funding: Funding;
  acks: Record<string, boolean>;
  plan: Plan | null;
  coolingOffDone: boolean;
  /** The first buy, held back by a cooling-off rule until a day passes. */
  heldBuyPence: number;
  /** The demo clock: a week in the last year of real prices (0 = a year ago, 52 = today). */
  week: number;
  shocks: Shock[];
  txns: Txn[];
  nextId: number;
  limitReached: boolean;
  pendingSell: { requestedWeek: number } | null;
  transfers: PendingTransfer[];
  knownAddresses: string[];
  beneficiary: string;
  toast: string | null;
  /** What the backtest screen is testing, and where to go back to. */
  backtest: { name: string; lines: Line[]; from: Screen } | null;
  btPeriod: Period;
  btCompare: string[];
}

export const INITIAL: DemoState = {
  screen: 'welcome', factStep: 0, profile: EMPTY_PROFILE, currency: 'GBP', currencyPinned: false, brand: 'quolin',
  clientId: 'NB-20001', selectedBasket: null, selectedAsset: null, custom: { BTC: 6000, ETH: 3000, SOL: 1000 }, draft: null,
  weeklyPence: 2500, initialPence: 20_000, funding: 'bank_transfer', acks: {},
  plan: null, coolingOffDone: false, heldBuyPence: 0, week: 0, shocks: [], txns: [], nextId: 1,
  limitReached: false, pendingSell: null, transfers: [], knownAddresses: [], beneficiary: '', toast: null,
  backtest: null, btPeriod: '1Y', btCompare: ['SPX', 'CASH'],
};

const STATE_KEY = 'quolin.demo.v2';

interface Ctx {
  s: DemoState;
  ready: boolean;
  set: (patch: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) => void;
  go: (screen: Screen) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setLocal: (field: string, value: string | boolean) => void;
  /** Move to another country: new rule pack, and its currency unless one was pinned. */
  moveTo: (country: string) => void;
  setCurrency: (c: Currency) => void;
  jurisdiction: Jurisdiction | null;
  pack: Pack | null;
  result: OnboardingResult;
  rates: Rates;
  log: (body: Omit<LedgerBody, 'client_id' | 'client_name' | 'source'>) => void;
  portfolio: Summary;
  dateLabel: string;
  /** Pre-trade check, exactly as the purchase stage will run it. */
  preCheck: (amountPence: number, opts?: { funding?: Funding; acks?: Record<string, boolean> }) => Determination | null;
  startPlan: () => void;
  advance: (weeks: number) => void;
  passADay: () => void;
  shock: (pct: number) => void;
  clearShocks: () => void;
  buyNow: (pence: number) => void;
  sellNow: (pence: number) => void;
  requestSellAll: () => void;
  cancelSell: () => void;
  sendToWallet: (address: string, pence: number) => 'sent' | 'held';
  cancelTransfer: (id: number) => void;
  setPlan: (patch: Partial<Plan>) => void;
}

const DemoContext = createContext<Ctx | null>(null);

const priorBuys = (txns: Txn[]) => txns.filter((t) => t.kind === 'buy').length;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [s, setState] = useState<DemoState>(INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DemoState>;
        setState({ ...INITIAL, ...saved, profile: { ...EMPTY_PROFILE, ...(saved.profile ?? {}) }, toast: null });
      }
    } catch {
      /* fresh start */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ ...s, toast: null }));
    } catch {
      /* not persisted */
    }
  }, [s, ready]);

  const set = useCallback<Ctx['set']>((patch) => {
    setState((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);
  const go = useCallback((screen: Screen) => set({ screen }), [set]);
  const setProfile = useCallback(
    (patch: Partial<Profile>) => setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } })), []);
  const setLocal = useCallback((field: string, value: string | boolean) =>
    setState((prev) => ({ ...prev, profile: { ...prev.profile, local: { ...prev.profile.local, [field]: value } } })), []);
  const moveTo = useCallback((country: string) => setState((prev) => ({
    ...prev,
    profile: { ...prev.profile, country, taxCountry: country },
    currency: prev.currencyPinned ? prev.currency : homeCurrency(country) ?? prev.currency,
    acks: {},
  })), []);
  const setCurrency = useCallback((c: Currency) => set({ currency: c, currencyPinned: true }), [set]);

  // The bank can publish a pack update from the console tab; the app follows it.
  const versions = useSyncExternalStore(subscribe, () => JSON.stringify(packVersions()), () => '{}');
  const rates = useSyncExternalStore(subscribeFx, getRates, getRates);
  // Live price history replaces the snapshot when it arrives; everything derived re-renders.
  const history = useSyncExternalStore(subscribeHistory, getHistory, getHistory);
  const jurisdiction = jurisdictionOf(s.profile.country);
  const pack = useMemo(
    () => (jurisdiction && ready ? activePack(jurisdiction) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jurisdiction, versions, ready],
  );
  const result = useMemo(() => decideOnboarding(s.profile, pack), [s.profile, pack]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const portfolio = useMemo(() => summarise(s.txns, s.week, s.shocks), [s.txns, s.week, s.shocks, history]);

  const log = useCallback<Ctx['log']>((body) => {
    void record({ ...body, client_id: s.clientId, client_name: s.profile.name || 'You', source: 'app' });
  }, [s.clientId, s.profile.name]);

  // Actions read the latest state through a ref so they can be called back to back.
  const ref = useRef({ s, pack, result });
  ref.current = { s, pack, result };

  const meta = (p: Pack | null) => ({ jurisdiction: p?.jurisdiction_name ?? null, pack_id: p?.pack_id ?? null, pack_version: p?.version ?? null });
  const reasonsOf = (d: Determination) => d.findings.map((f) => ({ rule_id: f.rule_id, title: f.reason.title, plain_english: f.reason.plain_english }));

  const check = useCallback((st: DemoState, p: Pack, amount: number, week: number, txns: Txn[], over?: { funding?: Funding; acks?: Record<string, boolean>; cooled?: boolean }) =>
    checkPurchase(p, st.profile, {
      amountPence: amount, heldPence: valueAt(txns, week, st.shocks), priorPurchases: priorBuys(txns),
      coolingOffComplete: over?.cooled ?? st.coolingOffDone, funding: over?.funding ?? st.plan?.funding ?? st.funding,
      acknowledgements: over?.acks ?? st.acks,
    }), []);

  const preCheck = useCallback<Ctx['preCheck']>((amount, opts) => {
    const { s: st, pack: p } = ref.current;
    if (!p) return null;
    return check(st, p, amount, st.week, st.txns, { funding: opts?.funding, acks: opts?.acks });
  }, [check]);

  /** One buy through the engine. Over the limit, it buys only the headroom left, then stops. */
  const tryBuy = useCallback((st: DemoState, p: Pack, amount: number, week: number, txns: Txn[], lines: Line[], nextId: number, note: string, cooled?: boolean) => {
    const limit = ref.current.result.limitPence;
    let d = check(st, p, amount, week, txns, { cooled });
    let spend = amount;
    let capped = false;
    if (d.findings.some((f) => f.reason_code === 'OVER_LIMIT')) {
      spend = headroomPence(limit, valueAt(txns, week, st.shocks));
      capped = true;
      d = spend >= 100 ? check(st, p, spend, week, txns, { cooled }) : d;
    }
    if (d.outcome !== 'ALLOW' || spend < 100) return { bought: [] as Txn[], d, spend: 0, capped };
    return { bought: buyLines(lines, spend, week, st.shocks, nextId, note), d, spend, capped };
  }, [check]);

  const startPlan = useCallback(() => {
    const { s: st, pack: p } = ref.current;
    if (!p || !st.draft) return;
    const plan: Plan = {
      name: st.draft.name, lines: st.draft.lines, weeklyPence: st.weeklyPence, initialPence: st.initialPence,
      funding: st.funding, startWeek: st.week, paused: false,
    };
    const first = check({ ...st, plan }, p, Math.max(st.initialPence, st.weeklyPence), st.week, st.txns);
    const cooling = first.findings.some((f) => f.reason_code === 'COOLING_OFF');
    let next: Partial<DemoState> = { plan, screen: 'home', limitReached: false, pendingSell: null };
    let summary = `${plan.name} · ${money0(st.initialPence)} now + ${money0(st.weeklyPence)}/week`;
    if (cooling) {
      next = { ...next, heldBuyPence: st.initialPence };
      summary += ' · first buy held 24h (cooling-off)';
    } else if (st.initialPence > 0) {
      const r = tryBuy({ ...st, plan }, p, st.initialPence, st.week, st.txns, plan.lines, st.nextId, 'First buy');
      next = { ...next, txns: [...st.txns, ...r.bought], nextId: st.nextId + r.bought.length, limitReached: r.capped, heldBuyPence: 0 };
      summary += r.spend ? ` · bought ${money0(r.spend)}${r.capped ? ' (capped at limit)' : ''}` : '';
    }
    set(next);
    log({ kind: 'plan', ...meta(p), outcome: cooling ? 'ALLOW' : first.outcome, summary, reasons: reasonsOf(first), determination: first, limit_pence: ref.current.result.limitPence });
  }, [check, tryBuy, set, log]);

  /** A day passes: cooling-off ends, held buys and 24h holds go through at this week's prices. */
  const settleDay = useCallback((st: DemoState, p: Pack | null): { patch: Partial<DemoState>; notes: string[] } => {
    let txns = st.txns, nextId = st.nextId;
    const notes: string[] = [];
    const patch: Partial<DemoState> = { coolingOffDone: true };
    if (p && st.plan && st.heldBuyPence > 0) {
      const r = tryBuy({ ...st, coolingOffDone: true }, p, st.heldBuyPence, st.week, txns, st.plan.lines, nextId, 'First buy (after cooling-off)', true);
      txns = [...txns, ...r.bought]; nextId += r.bought.length;
      if (r.spend) notes.push(`first buy of ${money0(r.spend)} went through`);
      patch.heldBuyPence = 0;
      if (r.capped) patch.limitReached = true;
    }
    if (st.pendingSell) {
      const sold = sellPro(txns, Infinity, st.week, st.shocks, nextId, 'sell', 'Sell everything (after 24h hold)');
      txns = [...txns, ...sold]; nextId += sold.length;
      notes.push(`sold everything for ${money0(sold.reduce((x, t) => x + t.pence, 0))}`);
      patch.pendingSell = null;
      if (st.plan) patch.plan = { ...st.plan, paused: true };
    }
    const held = st.transfers.filter((t) => t.status === 'held');
    if (held.length) {
      for (const t of held) {
        const out = sellPro(txns, t.pence, st.week, st.shocks, nextId, 'transfer_out', `To ${short(t.address)}`);
        txns = [...txns, ...out]; nextId += out.length;
        notes.push(`${money0(t.pence)} sent to ${short(t.address)}`);
      }
      patch.transfers = st.transfers.map((t) => (t.status === 'held' ? { ...t, status: 'sent' as const } : t));
      patch.knownAddresses = [...new Set([...st.knownAddresses, ...held.map((t) => t.address)])];
    }
    return { patch: { ...patch, txns, nextId }, notes };
  }, [tryBuy]);

  const passADay = useCallback(() => {
    const { s: st, pack: p } = ref.current;
    const { patch, notes } = settleDay(st, p);
    set({ ...patch, toast: notes.length ? `A day later: ${notes.join(', ')}.` : 'A day later: cooling-off complete.' });
  }, [settleDay, set]);

  const advance = useCallback((weeks: number) => {
    const { s: st0, pack: p } = ref.current;
    const target = Math.min(52, st0.week + weeks);
    if (target === st0.week) return;
    // The first day settles anything waiting on a 24-hour hold.
    const day = settleDay(st0, p);
    let st: DemoState = { ...st0, ...day.patch };
    let txns = st.txns, nextId = st.nextId, limitReached = st.limitReached;
    let buys = 0, spent = 0, last: Determination | null = null;
    for (let w = st0.week + 1; w <= target; w++) {
      if (!p || !st.plan || st.plan.paused) continue;
      const r = tryBuy({ ...st, txns }, p, st.plan.weeklyPence, w, txns, st.plan.lines, nextId, 'Weekly buy');
      last = r.d;
      if (r.spend) { txns = [...txns, ...r.bought]; nextId += r.bought.length; buys++; spent += r.spend; limitReached = r.capped; }
      else if (r.d.findings.some((f) => f.reason_code === 'OVER_LIMIT')) limitReached = true;
    }
    st = { ...st, txns, nextId, limitReached, week: target };
    set({ ...st, toast: null });
    if (p && st.plan && (buys || last)) {
      log({
        kind: 'plan_run', ...meta(p), outcome: last?.outcome ?? 'ALLOW',
        summary: `${fmtWeek(st0.week)} → ${fmtWeek(target)}: ${buys} weekly buy${buys === 1 ? '' : 's'}, ${money0(spent)}${limitReached ? ' · paused at the personal limit' : ''}`,
        reasons: last ? reasonsOf(last) : [], determination: last, limit_pence: ref.current.result.limitPence,
      });
    }
  }, [settleDay, tryBuy, set, log]);

  const shock = useCallback((pct: number) => set((st) => ({ shocks: [...st.shocks, { week: st.week, pct }] })), [set]);
  const clearShocks = useCallback(() => set({ shocks: [] }), [set]);

  const buyNow = useCallback((pence: number) => {
    const { s: st, pack: p } = ref.current;
    if (!p || !st.plan) return;
    const r = tryBuy(st, p, pence, st.week, st.txns, st.plan.lines, st.nextId, 'Top-up');
    set({ txns: [...st.txns, ...r.bought], nextId: st.nextId + r.bought.length, limitReached: r.capped || st.limitReached,
      toast: r.spend ? `Bought ${money0(r.spend)}${r.capped ? ', up to your limit' : ''}.` : `Not bought: ${r.d.findings[0]?.reason.title ?? 'blocked'}.` });
    log({ kind: 'buy', ...meta(p), outcome: r.spend ? 'ALLOW' : r.d.outcome, summary: `Top-up ${money0(pence)}${r.capped ? ` → ${money0(r.spend)} (limit)` : ''}`, reasons: reasonsOf(r.d), determination: r.d, limit_pence: ref.current.result.limitPence });
  }, [tryBuy, set, log]);

  const sellNow = useCallback((pence: number) => {
    const { s: st, pack: p } = ref.current;
    const sold = sellPro(st.txns, pence, st.week, st.shocks, st.nextId, 'sell', 'Sold to bank account');
    const got = sold.reduce((x, t) => x + t.pence, 0);
    set({ txns: [...st.txns, ...sold], nextId: st.nextId + sold.length, limitReached: false, toast: `Sold ${money0(got)}. It’s on its way to your bank account.` });
    log({ kind: 'sell', ...meta(p), outcome: 'NOTED', summary: `Sold ${money0(got)} to own bank account (closed loop)`, reasons: [] });
  }, [set, log]);

  const requestSellAll = useCallback(() => {
    const { s: st, pack: p } = ref.current;
    set({ pendingSell: { requestedWeek: st.week } });
    log({ kind: 'sell_request', ...meta(p), outcome: 'NOTED', summary: `Sell everything requested in a fall · held 24h · pressure check: no`, reasons: [] });
  }, [set, log]);
  const cancelSell = useCallback(() => set({ pendingSell: null, toast: 'Sale cancelled. Your plan carries on.' }), [set]);

  const sendToWallet = useCallback((address: string, pence: number): 'sent' | 'held' => {
    const { s: st, pack: p } = ref.current;
    const known = st.knownAddresses.includes(address);
    if (known) {
      const out = sellPro(st.txns, pence, st.week, st.shocks, st.nextId, 'transfer_out', `To ${short(address)}`);
      set({ txns: [...st.txns, ...out], nextId: st.nextId + out.length, toast: `${money0(pence)} sent to ${short(address)}.` });
    } else {
      set({ transfers: [...st.transfers, { id: st.nextId, address, pence, requestedWeek: st.week, status: 'held' }], nextId: st.nextId + 1 });
    }
    log({ kind: 'withdrawal', ...meta(p), outcome: known ? 'NOTED' : 'REFER', summary: `${money0(pence)} to wallet ${short(address)}${known ? '' : ' · new address: held 24h'}`, reasons: [] });
    return known ? 'sent' : 'held';
  }, [set, log]);
  const cancelTransfer = useCallback((id: number) =>
    set((st) => ({ transfers: st.transfers.map((t) => (t.id === id ? { ...t, status: 'cancelled' as const } : t)) })), [set]);

  const setPlan = useCallback((patch: Partial<Plan>) => set((st) => (st.plan ? { plan: { ...st.plan, ...patch } } : {})), [set]);

  const value: Ctx = {
    s, ready, set, go, setProfile, setLocal, moveTo, setCurrency, jurisdiction, pack, result, rates, log, portfolio,
    dateLabel: fmtWeek(s.week), preCheck, startPlan, advance, passADay, shock, clearShocks, buyNow, sellNow,
    requestSellAll, cancelSell, sendToWallet, cancelTransfer, setPlan,
  };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** Ledger summaries are written in GBP, the bank's reporting currency. */
const money0 = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function useDemo(): Ctx {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo outside DemoProvider');
  return ctx;
}

export function resetDemoState() {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* nothing stored */
  }
}
