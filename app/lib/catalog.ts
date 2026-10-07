// Product content: what each asset is for, the baskets, display currencies and the course.
// Prices come from lib/market.ts (real CoinGecko history); drawdowns and copy are curated.

import { COIN_DATA, priceAt } from './market';
import { getRates } from './fx';

export const ASSET_IDS = [
  'BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'USDC', 'SOL', 'TRX', 'ZEC', 'HYPE', 'DOGE', 'XMR', 'LINK', 'ADA', 'XLM',
  'PAXG', 'TBILL',
] as const;
export type AssetId = (typeof ASSET_IDS)[number];

/** The top 15 by market cap (CoinGecko snapshot), then the two real-world assets. */
export const TOP_15: AssetId[] = ASSET_IDS.slice(0, 15) as unknown as AssetId[];

export type Category = 'core' | 'large' | 'stablecoin' | 'real_world' | 'meme' | 'privacy' | 'exchange' | 'young';

export const CATEGORY_LABEL: Record<Category, string> = {
  core: 'Core', large: 'Large network', stablecoin: 'Stablecoin', real_world: 'Real-world asset',
  meme: 'Meme coin', privacy: 'Privacy coin', exchange: 'Exchange token', young: 'Under 3 years old',
};

export interface AssetCard {
  id: AssetId;
  name: string;
  ticker: string;
  logo: string;
  colour: string;
  category: Category;
  rank: number | null;
  one_liner: string;
  what_it_does: string;
  who_uses_it: string;
  value_from: string;
  what_can_kill_it: string;
  /** Worst peak-to-trough fall on record, in basis points of value lost. */
  worst_fall_bps: number;
  worst_when: string;
}

type Copy = Omit<AssetCard, 'id' | 'ticker' | 'logo' | 'rank'> & { ticker?: string; logo?: string };

const COPY: Record<AssetId, Copy> = {
  BTC: {
    name: 'Bitcoin', colour: '#B7791F', category: 'core',
    one_liner: 'Digital gold: scarce, and nobody can print more.',
    what_it_does: 'A way to hold and send value that no single bank or government controls.',
    who_uses_it: 'Savers hedging against currency debasement, funds, listed companies, and people in countries with unstable money.',
    value_from: 'A fixed supply of 21 million, and millions of people agreeing to treat it as a store of value.',
    what_can_kill_it: 'Loss of belief, a serious technical flaw, or bans in major economies.',
    worst_fall_bps: 8300, worst_when: '2018',
  },
  ETH: {
    name: 'Ether', colour: '#3A5265', category: 'core',
    one_liner: 'The fuel for apps built on the Ethereum network.',
    what_it_does: 'Pays for running programs on Ethereum: payments, tokenised funds, stablecoins.',
    who_uses_it: 'Developers, fintechs, and asset managers issuing tokenised funds.',
    value_from: 'Demand for using the network. Every transaction needs Ether to pay for it.',
    what_can_kill_it: 'A faster or cheaper rival winning, or regulation of the apps built on it.',
    worst_fall_bps: 9400, worst_when: '2018',
  },
  USDT: {
    name: 'Tether', colour: '#26A17B', category: 'stablecoin',
    one_liner: 'A token meant to stay worth one US dollar.',
    what_it_does: 'Lets people hold dollars on crypto networks, mostly to trade.',
    who_uses_it: 'Traders and people in countries where dollars are hard to get.',
    value_from: 'Reserves the issuer says it holds, mostly US Treasury bills.',
    what_can_kill_it: 'The reserves not being there, or regulators shutting the issuer out. Not MiCA-authorised in the EU.',
    worst_fall_bps: 500, worst_when: '2022',
  },
  BNB: {
    name: 'BNB', colour: '#F0B90B', category: 'exchange',
    one_liner: 'The token of the Binance exchange. Not on the Approved List.',
    what_it_does: 'Pays fees on Binance and its own network.',
    who_uses_it: 'Binance customers.',
    value_from: 'Binance’s business and its token burns.',
    what_can_kill_it: 'Anything that happens to one company. We don’t list tokens whose value depends on a single exchange.',
    worst_fall_bps: 8000, worst_when: '2022',
  },
  XRP: {
    name: 'XRP', colour: '#23292F', category: 'large',
    one_liner: 'A network built for fast payments between banks.',
    what_it_does: 'Settles cross-border payments in seconds.',
    who_uses_it: 'Payment firms and some banks, plus a large retail following.',
    value_from: 'Demand for the network, and Ripple’s business with financial institutions.',
    what_can_kill_it: 'Banks choosing other rails, and a large supply held by one company.',
    worst_fall_bps: 9600, worst_when: '2018–20',
  },
  USDC: {
    name: 'USD Coin', colour: '#2775CA', category: 'stablecoin',
    one_liner: 'A regulated dollar token with published reserves.',
    what_it_does: 'Holds a US dollar on crypto networks, redeemable one for one.',
    who_uses_it: 'Payment companies, fintechs, and people moving dollars quickly.',
    value_from: 'Cash and short-term Treasuries, audited monthly. Authorised as an e-money token under MiCA.',
    what_can_kill_it: 'A bank holding its reserves failing. It briefly fell to 87 cents in March 2023.',
    worst_fall_bps: 1300, worst_when: '2023',
  },
  SOL: {
    name: 'Solana', colour: '#7A5AF8', category: 'large',
    one_liner: 'A faster, cheaper network competing with Ethereum.',
    what_it_does: 'Runs payments and apps with low fees and high speed.',
    who_uses_it: 'Payment companies, traders and app developers.',
    value_from: 'Demand for using the network, as with Ether.',
    what_can_kill_it: 'Outages (it has had several), losing the race to rivals, or concentration in a few big holders.',
    worst_fall_bps: 9600, worst_when: '2022',
  },
  TRX: {
    name: 'TRON', colour: '#C23631', category: 'large',
    one_liner: 'A network mostly used to move Tether cheaply.',
    what_it_does: 'Carries a large share of the world’s USDT transfers.',
    who_uses_it: 'People sending dollars across borders, especially in Asia and Africa.',
    value_from: 'Fees from stablecoin transfers.',
    what_can_kill_it: 'Control concentrated in few hands, and its heavy use in scams flagged by regulators.',
    worst_fall_bps: 9500, worst_when: '2018–20',
  },
  ZEC: {
    name: 'Zcash', colour: '#F4B728', category: 'privacy',
    one_liner: 'A privacy coin. Never on the Approved List.',
    what_it_does: 'Can hide who sent what to whom.',
    who_uses_it: 'People who want financial privacy, and some who want to avoid checks.',
    value_from: 'Demand for private payments.',
    what_can_kill_it: 'Delistings: the EU’s anti-money-laundering rules bar anonymous crypto from 2027.',
    worst_fall_bps: 9900, worst_when: '2016–19',
  },
  HYPE: {
    name: 'Hyperliquid', colour: '#55C9A6', category: 'young',
    one_liner: 'A trading exchange’s token, launched in 2024. Too young for the list.',
    what_it_does: 'Powers a decentralised exchange for leveraged trading.',
    who_uses_it: 'Active traders.',
    value_from: 'Fees from the exchange.',
    what_can_kill_it: 'Its short history: we want at least three years before listing anything.',
    worst_fall_bps: 7000, worst_when: '2025',
  },
  DOGE: {
    name: 'Dogecoin', colour: '#C2A633', category: 'meme',
    one_liner: 'A meme coin. Never on the Approved List.',
    what_it_does: 'Started as a joke. Moves on social media sentiment.',
    who_uses_it: 'Speculators.', value_from: 'Attention.', what_can_kill_it: 'Attention moving on.',
    worst_fall_bps: 9200, worst_when: '2021–22',
  },
  XMR: {
    name: 'Monero', colour: '#FF6600', category: 'privacy',
    one_liner: 'A privacy coin. Never on the Approved List.',
    what_it_does: 'Hides senders, receivers and amounts by default.',
    who_uses_it: 'People who want financial privacy, and some who want to avoid checks.',
    value_from: 'Demand for private payments.',
    what_can_kill_it: 'Already delisted by many exchanges in the UK, EU and Asia.',
    worst_fall_bps: 9400, worst_when: '2018',
  },
  LINK: {
    name: 'Chainlink', colour: '#2A5ADA', category: 'large',
    one_liner: 'Brings real-world data, like prices, onto blockchains.',
    what_it_does: 'Feeds prices and other facts to apps that need them, including bank pilots.',
    who_uses_it: 'App developers, and banks and market infrastructure testing tokenisation.',
    value_from: 'Fees paid for data services.',
    what_can_kill_it: 'Rival data networks, or apps building their own.',
    worst_fall_bps: 9000, worst_when: '2021–22',
  },
  ADA: {
    name: 'Cardano', colour: '#0033AD', category: 'large',
    one_liner: 'A research-led network competing with Ethereum.',
    what_it_does: 'Runs apps and payments, with a slow, peer-reviewed approach to upgrades.',
    who_uses_it: 'A large community of holders; fewer apps than its rivals.',
    value_from: 'Demand for using and securing the network.',
    what_can_kill_it: 'Too little real use compared with rivals.',
    worst_fall_bps: 9500, worst_when: '2021–22',
  },
  XLM: {
    name: 'Stellar', colour: '#14B6E7', category: 'large',
    one_liner: 'A payments network for moving money cheaply worldwide.',
    what_it_does: 'Moves money and tokenised funds across borders for fractions of a penny.',
    who_uses_it: 'Remittance firms and some asset managers issuing tokenised funds.',
    value_from: 'Use as a payments rail.',
    what_can_kill_it: 'Payment firms choosing other rails.',
    worst_fall_bps: 9500, worst_when: '2018–20',
  },
  PAXG: {
    name: 'Tokenised gold', colour: '#C9A75F', category: 'real_world',
    one_liner: 'Real gold bars in a London vault, owned as a token.',
    what_it_does: 'Each token is a claim on one troy ounce of London Good Delivery gold.',
    who_uses_it: 'Savers who want gold without storing it, in small amounts.',
    value_from: 'The gold itself. The issuer publishes monthly vault audits.',
    what_can_kill_it: 'The issuer failing or the gold not being there. You rely on the issuer and the audits.',
    worst_fall_bps: 2000, worst_when: '2022',
  },
  TBILL: {
    name: 'Tokenised T-bills', ticker: 'T-BILL', logo: '/coins/tbill.svg', colour: '#6E8191', category: 'real_world',
    one_liner: 'A money-market fund holding short-term US government debt.',
    what_it_does: 'Earns roughly the US short-term interest rate, about 4% a year, paid into the token’s price.',
    who_uses_it: 'Cautious savers, and companies parking cash between uses.',
    value_from: 'US Treasury bills: loans to the US government, repaid within months.',
    what_can_kill_it: 'The fund manager failing, or a US default. Very unlikely, not impossible. Held in dollars, so the pound/dollar rate moves it.',
    worst_fall_bps: 0, worst_when: 'never fallen in dollars',
  },
};

export const ASSETS: Record<AssetId, AssetCard> = Object.fromEntries(
  ASSET_IDS.map((id) => {
    const c = COPY[id];
    const d = COIN_DATA[id];
    return [id, {
      ...c, id, ticker: c.ticker ?? id, logo: c.logo ?? d?.logo ?? '', rank: d && TOP_15.includes(id) ? TOP_15.indexOf(id) + 1 : null,
    }];
  }),
) as Record<AssetId, AssetCard>;

/** Indicative price in GBP pence at a demo week (real history). */
export const pricePence = (id: AssetId, week: number) => priceAt(id, week) * 100;

export type BasketId = 'core' | 'digital_gold' | 'steady' | 'payments';

export interface Basket {
  id: BasketId;
  name: string;
  tagline: string;
  what_for: string;
  level: number;
  lines: { asset: AssetId; weight_bps: number }[];
}

export const BASKETS: Basket[] = [
  {
    id: 'core', name: 'Core', tagline: 'The two largest, most established assets.', level: 1,
    what_for: 'A small, simple slice of crypto, held the way an index fund holds the biggest companies.',
    lines: [{ asset: 'BTC', weight_bps: 7000 }, { asset: 'ETH', weight_bps: 3000 }],
  },
  {
    id: 'digital_gold', name: 'Digital Gold', tagline: 'Scarce assets nobody can print more of.', level: 1,
    what_for: 'A small slice of savings held outside any single currency or bank.',
    lines: [{ asset: 'BTC', weight_bps: 6000 }, { asset: 'PAXG', weight_bps: 2500 }, { asset: 'TBILL', weight_bps: 1500 }],
  },
  {
    id: 'steady', name: 'Steady', tagline: 'Mostly real-world assets, with a little Bitcoin.', level: 1,
    what_for: 'A first step for cautious savers: gold and government debt with a small Bitcoin slice.',
    lines: [{ asset: 'TBILL', weight_bps: 4500 }, { asset: 'PAXG', weight_bps: 4000 }, { asset: 'BTC', weight_bps: 1500 }],
  },
  {
    id: 'payments', name: 'Payments networks', tagline: 'The networks moving money across borders.', level: 2,
    what_for: 'A themed slice for people who believe crypto’s use is moving money: Ether plus the large payment networks, each capped at 10%.',
    lines: [
      { asset: 'ETH', weight_bps: 6000 }, { asset: 'XRP', weight_bps: 1000 }, { asset: 'SOL', weight_bps: 1000 },
      { asset: 'XLM', weight_bps: 1000 }, { asset: 'LINK', weight_bps: 1000 },
    ],
  },
];

/** What 1,000 would have become at the worst point, given each asset's worst fall on record. */
export function worstCase(lines: { asset: AssetId; weight_bps: number }[], start = 1000): number {
  const kept = lines.reduce((s, l) => s + (l.weight_bps / 10_000) * (1 - ASSETS[l.asset].worst_fall_bps / 10_000), 0);
  return Math.round(start * kept);
}

export type Currency = 'GBP' | 'SGD' | 'EUR' | 'HKD' | 'AUD' | 'MYR' | 'USD';

export const CURRENCIES: Record<Currency, { symbol: string; name: string; locale: string }> = {
  GBP: { symbol: '£', name: 'British pound', locale: 'en-GB' },
  SGD: { symbol: 'S$', name: 'Singapore dollar', locale: 'en-SG' },
  EUR: { symbol: '€', name: 'Euro', locale: 'en-IE' },
  HKD: { symbol: 'HK$', name: 'Hong Kong dollar', locale: 'en-HK' },
  AUD: { symbol: 'A$', name: 'Australian dollar', locale: 'en-AU' },
  MYR: { symbol: 'RM', name: 'Malaysian ringgit', locale: 'en-MY' },
  USD: { symbol: '$', name: 'US dollar', locale: 'en-US' },
};

/** Format an amount held in GBP pence (the engine's base) in a display currency, at today's rate. */
export function money(pence: number, cur: Currency, opts: { exact?: boolean } = {}): string {
  const v = (pence / 100) * getRates().rates[cur];
  const digits = opts.exact || (Math.abs(v) < 100 && v !== Math.round(v)) ? 2 : 0;
  const s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? '−' : ''}${CURRENCIES[cur].symbol}${s}`;
}

/** Round a GBP amount to a friendly local figure (e.g. £25 → S$40, not S$42.27). */
export function friendly(pence: number, cur: Currency): string {
  const v = (pence / 100) * getRates().rates[cur];
  const step = v >= 1000 ? 50 : v >= 100 ? 10 : 5;
  return `${CURRENCIES[cur].symbol}${(Math.round(v / step) * step).toLocaleString('en-GB')}`;
}

/** A price, with enough digits to be meaningful for sub-penny coins. */
export function price(pence: number, cur: Currency): string {
  const v = (pence / 100) * getRates().rates[cur];
  const digits = v >= 100 ? 0 : v >= 1 ? 2 : 4;
  return `${CURRENCIES[cur].symbol}${v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Convert an amount typed in a display currency into GBP pence. */
export function toBasePence(amount: number, cur: Currency): number {
  return Math.round((amount / getRates().rates[cur]) * 100);
}

export interface Lesson {
  title: string;
  body: string;
  question: string;
  options: string[];
  correct: number;
  why: string;
}

export const COURSE_L1: Lesson[] = [
  {
    title: 'It can fall a long way',
    body: 'Bitcoin has fallen by more than 70% three times. Each time it took years to come back. Nobody knows if it always will.',
    question: 'Bitcoin fell 77% in 2022. If you’d put in {c}1,000 at the top, what would it have been worth at the bottom?',
    options: ['About {c}900', 'About {c}500', 'About {c}230'], correct: 2,
    why: 'A 77% fall leaves 23%. {c}1,000 became about {c}230.',
  },
  {
    title: 'What protects you, and what doesn’t',
    body: 'Your coins are held by a regulated custodian, kept separate from Quolin’s own money. If Quolin failed, they’d still be yours. But crypto is not covered by a deposit guarantee like {deposit}.',
    question: 'If the price falls, does any scheme pay you back?',
    options: ['Yes, the deposit guarantee covers it', 'No. Price falls are your risk', 'Yes, Quolin refunds losses'], correct: 1,
    why: 'Segregated custody protects you if a firm fails. Nothing protects you from the price falling.',
  },
  {
    title: 'How the scams work',
    body: 'Most crypto losses aren’t hacks. They’re people being talked into sending coins to a stranger. Quolin only ever sends money back to your own bank account.',
    question: 'Someone you met online says they can double your crypto if you send it to their wallet. What do you do?',
    options: ['Send a small amount to test it', 'Ignore it and report it to your bank', 'Ask them for proof first'], correct: 1,
    why: 'Nobody can double your money. Anyone asking you to send crypto to them is a scam, every time.',
  },
  {
    title: 'Where the value comes from',
    body: 'Shares are backed by company profits. Bitcoin isn’t backed by anything. Its value comes from being scarce and from people agreeing to hold it.',
    question: 'What gives Bitcoin its value?',
    options: ['The government guarantees it', 'A fixed supply and people agreeing to hold it', 'Profits from a company'], correct: 1,
    why: 'There will only ever be 21 million. That scarcity, plus belief, is the whole case.',
  },
  {
    title: 'How much is sensible',
    body: 'Most advisers who include crypto suggest a small slice: an amount you could lose without changing your plans.',
    question: 'How much of your savings should go into crypto?',
    options: ['As much as possible while prices are low', 'Only what you could lose without changing your plans', 'Half, to balance things out'], correct: 1,
    why: 'That’s exactly what your personal limit works out.',
  },
];

export const COURSE_L2: Lesson[] = [
  {
    title: 'Smaller coins fall further',
    body: 'Beyond Bitcoin and Ether, assets are younger and less proven. Solana fell 96% in 2022.',
    question: 'Solana fell 96% in 2022. What did {c}100 become?',
    options: ['{c}4', '{c}40', '{c}60'], correct: 0, why: 'A 96% fall leaves {c}4 of every {c}100.',
  },
  {
    title: 'Why we cap them',
    body: 'Any single non-core asset is capped at 10% of a basket, so if one fails the rest of your plan survives.',
    question: 'Why is each non-core asset capped at 10%?',
    options: ['To stop one asset sinking the basket', 'To lower the fees', 'Because the regulator bans them'], correct: 0,
    why: 'Spreading risk means one failure is survivable.',
  },
  {
    title: 'Networks can stop',
    body: 'Some newer networks have had outages lasting hours, when nobody could buy or sell.',
    question: 'What can happen during a network outage?',
    options: ['Prices are frozen and safe', 'You may not be able to sell for a while', 'Your coins are refunded'], correct: 1,
    why: 'During an outage you can’t trade, whatever the price does elsewhere.',
  },
];
