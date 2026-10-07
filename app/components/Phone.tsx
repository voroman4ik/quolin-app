'use client';

import { useState } from 'react';
import { useDemo, type Screen } from './demo-state';
import { Wordmark } from './ui';
import { FactFind, Welcome } from './screens/Onboarding';
import { Course } from './screens/Course';
import { Result } from './screens/Result';
import { AssetDetail, BasketDetail, Baskets, Build, Explore, PlanSetup } from './screens/Invest';
import { Account, Home, Learn, PlaceAndCurrency, Withdraw } from './screens/Money';
import { BacktestScreen } from './screens/Backtest';

const TABS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Portfolio', icon: <path d="M4 18 9 12l4 3 7-9M4 21h16" /> },
  { id: 'baskets', label: 'Baskets', icon: <path d="M4 9h16l-1.5 10h-13zM8 9l4-5 4 5" /> },
  { id: 'learn', label: 'Learn', icon: <path d="M3 8l9-4 9 4-9 4zM7 10v5c3 2 7 2 10 0v-5" /> },
  { id: 'account', label: 'Account', icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6" /> },
];
const TABBED: Screen[] = ['home', 'baskets', 'learn', 'account', 'basket', 'build', 'withdraw', 'explore', 'asset', 'backtest'];

function Body({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'welcome': return <Welcome />;
    case 'factfind': return <FactFind />;
    case 'course': return <Course level={1} />;
    case 'course2': return <Course level={2} />;
    case 'result': return <Result />;
    case 'home': return <Home />;
    case 'baskets': return <Baskets />;
    case 'basket': return <BasketDetail />;
    case 'build': return <Build />;
    case 'plan': return <PlanSetup />;
    case 'learn': return <Learn />;
    case 'account': return <Account />;
    case 'withdraw': return <Withdraw />;
    case 'explore': return <Explore />;
    case 'asset': return <AssetDetail />;
    case 'backtest': return <BacktestScreen />;
  }
}

export function Phone() {
  const { s, go, ready, pack } = useDemo();
  const [place, setPlace] = useState(false);
  const tabbed = TABBED.includes(s.screen);
  const active = ['basket', 'build', 'explore', 'asset', 'backtest'].includes(s.screen) ? 'baskets' : s.screen === 'withdraw' ? 'home' : s.screen;

  return (
    <div className="phone" aria-label="Quolin app">
      <div className="phone-status" aria-hidden><span>9:41</span><span className="notch" /><span>●●● 5G</span></div>
      {s.screen !== 'welcome' && (
        <div className="phone-head">
          <Wordmark brand={s.brand} />
          <button className="pill place" onClick={() => setPlace(true)} aria-label="Change country or currency">
            {pack ? `${pack.pack_id} rules` : 'No rules'} · {s.currency} ▾
          </button>
        </div>
      )}
      {ready ? <Body screen={s.screen} /> : <div className="phone-scroll" />}
      {place && (
        <div className="sheet-backdrop" onClick={() => setPlace(false)}>
          <div className="sheet" role="dialog" aria-label="Country and currency" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">Where you live, and your currency</h2>
            <p className="small muted">Your country picks the rules: what you’re asked, what’s on the Approved List, and your limit. Your currency only changes how amounts are shown.</p>
            <PlaceAndCurrency />
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setPlace(false)}>Done</button>
          </div>
        </div>
      )}
      {tabbed && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} aria-current={active === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
