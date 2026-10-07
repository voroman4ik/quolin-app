// Product content: what each asset is for, the baskets, display currencies and the course.
// Prices and drawdowns are illustrative and say so on screen.

export type AssetId = 'BTC' | 'ETH' | 'GOLD' | 'TBILL' | 'SOL' | 'DOGE' | 'BTC3L';

export interface AssetCard {
  id: AssetId;
  name: string;
  ticker: string;
  colour: string;
  /** Indicative price in GBP pence. */
  price_pence: number;
  one_liner: string;
  what_it_does: string;
  who_uses_it: string;
  value_from: string;
  what_can_kill_it: string;
  /** Worst peak-to-trough fall, in basis points of value lost. */
  worst_fall_bps: number;
  worst_when: string;
}

export const ASSETS: Record<AssetId, AssetCard> = {
  BTC: {
    id: 'BTC', name: 'Bitcoin', ticker: 'BTC', colour: 'var(--bronze)', price_pence: 8_240_000,
    one_liner: 'Digital gold: scarce, and nobody can print more.',
    what_it_does: 'A way to hold and send value that no single bank or government controls.',
    who_uses_it: 'Savers hedging against currency debasement, a growing number of funds and companies, and people in countries with unstable money.',
    value_from: 'A fixed supply of 21 million, and millions of people agreeing to treat it as a store of value.',
    what_can_kill_it: 'Loss of belief, a serious technical flaw, or bans in major economies.',
    worst_fall_bps: 7700, worst_when: '2022',
  },
  ETH: {
    id: 'ETH', name: 'Ether', ticker: 'ETH', colour: 'var(--steel)', price_pence: 305_000,
    one_liner: 'The fuel for apps built on the Ethereum network.',
    what_it_does: 'Pays for running programs on Ethereum: payments, tokenised funds, stablecoins.',
    who_uses_it: 'Developers, fintechs, and asset managers issuing tokenised funds on Ethereum.',
    value_from: 'Demand for using the network. Every transaction needs Ether to pay for it.',
    what_can_kill_it: 'A faster or cheaper rival network winning, or regulation of the apps built on it.',
    worst_fall_bps: 8200, worst_when: '2022',
  },
  GOLD: {
    id: 'GOLD', name: 'Tokenised gold', ticker: 'PAXG', colour: '#C9A75F', price_pence: 305_000,
    one_liner: 'Real gold bars in a vault, owned as a token.',
    what_it_does: 'Each token is a claim on one troy ounce of London Good Delivery gold.',
    who_uses_it: 'Savers who want gold without storing it, in amounts as small as £10.',
    value_from: 'The gold itself. The issuer publishes monthly vault audits.',
    what_can_kill_it: 'The issuer failing or the gold not being there. You rely on the issuer and the audits.',
    worst_fall_bps: 2000, worst_when: '2022',
  },
  TBILL: {
    id: 'TBILL', name: 'Tokenised T-bills', ticker: 'MMF', colour: 'var(--muted)', price_pence: 100,
    one_liner: 'A money-market fund holding short-term government debt.',
    what_it_does: 'Earns roughly the government’s short-term interest rate, paid into the token’s price.',
    who_uses_it: 'Cautious savers, and companies parking cash between uses.',
    value_from: 'US Treasury bills: loans to the US government, repaid within months.',
    what_can_kill_it: 'The fund manager failing, or a US government default. Both very unlikely, not impossible.',
    worst_fall_bps: 0, worst_when: 'never fallen',
  },
  SOL: {
    id: 'SOL', name: 'Solana', ticker: 'SOL', colour: '#6E6A9E', price_pence: 15_200,
    one_liner: 'A faster, cheaper network competing with Ethereum.',
    what_it_does: 'Runs payments and apps with low fees and high speed.',
    who_uses_it: 'Payment companies, traders and app developers.',
    value_from: 'Demand for using the network, as with Ether.',
    what_can_kill_it: 'Outages (it has had several), losing the race to rivals, or concentration in a few big holders.',
    worst_fall_bps: 9600, worst_when: '2022',
  },
  DOGE: {
    id: 'DOGE', name: 'Dogecoin', ticker: 'DOGE', colour: '#999', price_pence: 14,
    one_liner: 'A meme coin. Never on the Approved List.',
    what_it_does: 'Started as a joke. Moves on social media sentiment.',
    who_uses_it: 'Speculators.', value_from: 'Attention.', what_can_kill_it: 'Attention moving on.',
    worst_fall_bps: 9200, worst_when: '2021–22',
  },
  BTC3L: {
    id: 'BTC3L', name: 'Bitcoin 3× leveraged', ticker: 'BTC3L', colour: '#999', price_pence: 120,
    one_liner: 'Borrowed exposure. Never offered.',
    what_it_does: 'Moves three times as much as Bitcoin, both ways.',
    who_uses_it: 'Traders.', value_from: 'Borrowing.', what_can_kill_it: 'One bad week.',
    worst_fall_bps: 9990, worst_when: '2022',
  },
};

export type BasketId = 'core' | 'digital_gold' | 'steady';

export interface Basket {
  id: BasketId;
  name: string;
  tagline: string;
  what_for: string;
  lines: { asset: AssetId; weight_bps: number }[];
}

export const BASKETS: Basket[] = [
  {
    id: 'core', name: 'Core', tagline: 'The two largest, most established assets.',
    what_for: 'A small, simple slice of crypto, held the way an index fund holds the biggest companies.',
    lines: [{ asset: 'BTC', weight_bps: 7000 }, { asset: 'ETH', weight_bps: 3000 }],
  },
  {
    id: 'digital_gold', name: 'Digital Gold', tagline: 'Scarce assets nobody can print more of.',
    what_for: 'A small slice of savings held outside any single currency or bank.',
    lines: [{ asset: 'BTC', weight_bps: 6000 }, { asset: 'GOLD', weight_bps: 2500 }, { asset: 'TBILL', weight_bps: 1500 }],
  },
  {
    id: 'steady', name: 'Steady', tagline: 'Mostly real-world assets, with a little Bitcoin.',
    what_for: 'A first step for cautious savers: gold and government debt with a small Bitcoin slice.',
    lines: [{ asset: 'TBILL', weight_bps: 4500 }, { asset: 'GOLD', weight_bps: 4000 }, { asset: 'BTC', weight_bps: 1500 }],
  },
];

/** What £1,000 would have become at the worst point, given each asset's worst fall. */
export function worstCase(lines: { asset: AssetId; weight_bps: number }[], start = 1000): number {
  const kept = lines.reduce((s, l) => s + (l.weight_bps / 10_000) * (1 - ASSETS[l.asset].worst_fall_bps / 10_000), 0);
  return Math.round(start * kept);
}

export type Currency = 'GBP' | 'SGD' | 'EUR' | 'HKD' | 'AUD' | 'MYR' | 'USD';

/** Illustrative display rates from GBP. Display only: every decision is made in GBP pence. */
export const CURRENCIES: Record<Currency, { symbol: string; rate: number }> = {
  GBP: { symbol: '£', rate: 1 },
  SGD: { symbol: 'S$', rate: 1.72 },
  EUR: { symbol: '€', rate: 1.17 },
  HKD: { symbol: 'HK$', rate: 10.4 },
  AUD: { symbol: 'A$', rate: 2.03 },
  MYR: { symbol: 'RM', rate: 5.7 },
  USD: { symbol: '$', rate: 1.33 },
};

export function money(pence: number, cur: Currency, opts: { exact?: boolean } = {}): string {
  const { symbol, rate } = CURRENCIES[cur];
  const v = (pence / 100) * rate;
  const digits = opts.exact || Math.abs(v) < 100 ? 2 : 0;
  const s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? '−' : ''}${symbol}${s}`;
}

/** Round a GBP amount to a friendly local figure (e.g. £25 → S$45, not S$43). */
export function friendly(pence: number, cur: Currency): string {
  const { symbol, rate } = CURRENCIES[cur];
  const v = (pence / 100) * rate;
  const step = v >= 1000 ? 50 : v >= 100 ? 10 : 5;
  return `${symbol}${(Math.round(v / step) * step).toLocaleString('en-GB')}`;
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
    question: 'Bitcoin fell 77% in 2022. If you’d put in £1,000 at the top, what would it have been worth at the bottom?',
    options: ['About £900', 'About £500', 'About £230'], correct: 2,
    why: 'A 77% fall leaves 23%. £1,000 became about £230.',
  },
  {
    title: 'What protects you, and what doesn’t',
    body: 'Your coins are held by a regulated custodian, kept separate from Quolin’s own money. If Quolin failed, they’d still be yours. But crypto is not covered by a deposit guarantee like FSCS.',
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
    question: 'Solana fell 96% in 2022. What did £100 become?',
    options: ['£4', '£40', '£60'], correct: 0, why: 'A 96% fall leaves £4 of every £100.',
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
