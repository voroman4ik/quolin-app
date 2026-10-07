'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AssetId, BasketId, Currency } from '@/lib/catalog';
import { decideOnboarding, EMPTY_PROFILE, jurisdictionOf, type OnboardingResult, type Profile } from '@/lib/decide';
import { activePack, packVersions, record, subscribe, type LedgerBody } from '@/lib/ledger';
import type { Pack } from '@/lib/engine/types';
import type { Jurisdiction } from '@/lib/packs';

export type Screen =
  | 'welcome' | 'factfind' | 'course' | 'result'
  | 'home' | 'baskets' | 'basket' | 'build' | 'plan'
  | 'learn' | 'course2' | 'account' | 'withdraw';

export type Line = { asset: AssetId; weight_bps: number };

export interface Plan {
  name: string;
  lines: Line[];
  weeklyPence: number;
  startedAt: string;
  /** Set when the pack's cooling-off rule held the first buy back. */
  firstBuyAt: string | null;
}

export interface DemoState {
  screen: Screen;
  factStep: number;
  profile: Profile;
  currency: Currency;
  brand: 'quolin' | 'northbank';
  clientId: string;
  selectedBasket: BasketId | null;
  custom: Partial<Record<AssetId, number>>;
  draft: { name: string; lines: Line[] } | null;
  weeklyPence: number;
  plan: Plan | null;
  coolingOffDone: boolean;
  /** Simulated weeks since the plan started. */
  weeks: number;
  market: 'normal' | 'crash';
  sellPendingUntil: string | null;
  beneficiary: string;
}

export const INITIAL: DemoState = {
  screen: 'welcome', factStep: 0, profile: EMPTY_PROFILE, currency: 'GBP', brand: 'quolin',
  clientId: 'NB-20001', selectedBasket: null, custom: { BTC: 6000, ETH: 3000, SOL: 1000 }, draft: null,
  weeklyPence: 2500, plan: null, coolingOffDone: false, weeks: 0, market: 'normal',
  sellPendingUntil: null, beneficiary: '',
};

const STATE_KEY = 'quolin.demo.v1';

/** Market moves for the demo: up 12% over the plan, then a 30% fall. Illustrative. */
export const MARKET_FACTOR = { normal: 1.12, crash: 0.784 };

interface Ctx {
  s: DemoState;
  ready: boolean;
  set: (patch: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) => void;
  go: (screen: Screen) => void;
  setProfile: (patch: Partial<Profile>) => void;
  jurisdiction: Jurisdiction | null;
  pack: Pack | null;
  result: OnboardingResult;
  log: (body: Omit<LedgerBody, 'client_id' | 'client_name' | 'source'>) => void;
  portfolio: { investedPence: number; valuePence: number; changeBps: number; capped: boolean };
}

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [s, setState] = useState<DemoState>(INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) setState({ ...INITIAL, ...(JSON.parse(raw) as Partial<DemoState>) });
    } catch {
      /* fresh start */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(s));
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

  // The bank can publish a pack update from the console tab; the app follows it.
  const versions = useSyncExternalStore(subscribe, () => JSON.stringify(packVersions()), () => '{}');
  const jurisdiction = jurisdictionOf(s.profile.country);
  const pack = useMemo(
    () => (jurisdiction && ready ? activePack(jurisdiction) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jurisdiction, versions, ready],
  );
  const result = useMemo(() => decideOnboarding(s.profile, pack), [s.profile, pack]);

  const log = useCallback<Ctx['log']>((body) => {
    void record({ ...body, client_id: s.clientId, client_name: s.profile.name || 'You', source: 'app' });
  }, [s.clientId, s.profile.name]);

  const portfolio = useMemo(() => {
    const plan = s.plan;
    if (!plan || s.weeks === 0) return { investedPence: 0, valuePence: 0, changeBps: 0, capped: false };
    const uncapped = s.weeks * plan.weeklyPence;
    const investedPence = Math.min(uncapped, result.limitPence || uncapped);
    const valuePence = Math.round(investedPence * MARKET_FACTOR[s.market]);
    return {
      investedPence, valuePence, capped: uncapped > investedPence,
      changeBps: Math.round(((valuePence - investedPence) / investedPence) * 10_000),
    };
  }, [s.plan, s.weeks, s.market, result.limitPence]);

  const value: Ctx = { s, ready, set, go, setProfile, jurisdiction, pack, result, log, portfolio };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

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
