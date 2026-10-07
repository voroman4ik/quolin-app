// Real price history, from Yahoo Finance's chart API (daily closes, adjusted for dividends
// where Yahoo provides it), converted to GBP with the daily GBP/USD rate.
// Used live by /api/history (cached) and by scripts/fetch-history.ts for the offline snapshot.
// Self-contained on purpose: no imports, so Node can run it directly.

export interface WorstFall { pct: number; peak: string; trough: string; since: string }

export interface History {
  source: string;
  fetched_at: string;
  /** Weekly grid, oldest first, ending at the latest close. */
  dates: string[];
  benchmarks: Record<string, { group: string; label: string; ticker: string }>;
  /** GBP price per week; null before the asset existed. */
  series: Record<string, (number | null)[]>;
  /** Worst peak-to-trough fall over all the history Yahoo has, in GBP. */
  worst: Record<string, WorstFall>;
  /** First date each series has data. */
  starts: Record<string, string>;
  live?: boolean;
}

/** Quolin's asset ids → Yahoo tickers. */
export const ASSET_TICKERS: Record<string, string> = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', USDT: 'USDT-USD', BNB: 'BNB-USD', XRP: 'XRP-USD', USDC: 'USDC-USD',
  SOL: 'SOL-USD', TRX: 'TRX-USD', ZEC: 'ZEC-USD', HYPE: 'HYPE32196-USD', DOGE: 'DOGE-USD', XMR: 'XMR-USD',
  LINK: 'LINK-USD', ADA: 'ADA-USD', XLM: 'XLM-USD', PAXG: 'PAXG-USD',
};

/** What people compare crypto against. */
export const BENCHMARKS: Record<string, { group: string; label: string; ticker: string }> = {
  SPX: { group: 'Index funds', label: 'S&P 500', ticker: 'SPY' },
  NDX: { group: 'Index funds', label: 'Nasdaq 100', ticker: 'QQQ' },
  WORLD: { group: 'Index funds', label: 'MSCI World', ticker: 'URTH' },
  FTSE: { group: 'Index funds', label: 'FTSE 100', ticker: '^FTSE' },
  AAPL: { group: 'Shares', label: 'Apple', ticker: 'AAPL' },
  MSFT: { group: 'Shares', label: 'Microsoft', ticker: 'MSFT' },
  NVDA: { group: 'Shares', label: 'Nvidia', ticker: 'NVDA' },
  AMZN: { group: 'Shares', label: 'Amazon', ticker: 'AMZN' },
  TSLA: { group: 'Shares', label: 'Tesla', ticker: 'TSLA' },
  GOLD: { group: 'Gold, bonds, cash', label: 'Gold', ticker: 'GLD' },
  BONDS: { group: 'Gold, bonds, cash', label: 'US Treasuries (7–10y)', ticker: 'IEF' },
  CASH: { group: 'Gold, bonds, cash', label: 'Cash (£)', ticker: 'ERNS.L' },
};

export const YEARS = 10;
const DAY = 86_400_000;

type Points = [number, number][];

async function daily(ticker: string): Promise<{ currency: string; points: Points }> {
  const now = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=0&period2=${now}&interval=1d`;
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Quolin demo)' } });
    if (res.ok) {
      const r = (await res.json()).chart.result[0];
      const close: (number | null)[] = r.indicators.adjclose?.[0]?.adjclose ?? r.indicators.quote[0].close;
      const points = (r.timestamp as number[]).map((t, i) => [t * 1000, close[i]] as [number, number | null])
        .filter((p): p is [number, number] => p[1] != null && p[1] > 0);
      return { currency: r.meta.currency, points };
    }
    lastErr = `HTTP ${res.status}`;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`${ticker}: ${lastErr}`);
}

/** Last value on or before t (binary search); null before the series starts. */
function at(points: Points, t: number): number | null {
  let lo = 0, hi = points.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans < 0 ? null : points[ans][1];
}

function worstFall(points: Points): WorstFall {
  let peak = points[0], worst = 0, wPeak = points[0][0], wTrough = points[0][0];
  for (const p of points) {
    if (p[1] > peak[1]) peak = p;
    const dd = p[1] / peak[1] - 1;
    if (dd < worst) { worst = dd; wPeak = peak[0]; wTrough = p[0]; }
  }
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { pct: Math.round(worst * 1000) / 10, peak: d(wPeak), trough: d(wTrough), since: d(points[0][0]) };
}

/** Run up to `n` fetches at once, politely. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export async function buildHistory(): Promise<History> {
  const fx = (await daily('GBPUSD=X')).points;
  const toGbp = (cur: string, pts: Points): Points => pts
    .map(([t, v]) => {
      if (cur === 'GBP') return [t, v] as [number, number];
      if (cur === 'GBp') return [t, v / 100] as [number, number];
      const r = at(fx, t);
      return r ? ([t, v / r] as [number, number]) : null;
    })
    .filter((p): p is [number, number] => p !== null);

  // Tokenised T-bills: a dollar earning the 3-month T-bill yield, accrued daily, held in GBP.
  const irx = (await daily('^IRX')).points;
  const cashUsd: Points = [];
  let usd = 1;
  for (let i = 0; i < irx.length; i++) {
    if (i > 0) usd *= 1 + (irx[i - 1][1] / 100) * ((irx[i][0] - irx[i - 1][0]) / (365 * DAY));
    cashUsd.push([irx[i][0], usd]);
  }

  const ids = [...Object.keys(ASSET_TICKERS), ...Object.keys(BENCHMARKS)];
  const tickers = ids.map((id) => ASSET_TICKERS[id] ?? BENCHMARKS[id].ticker);
  const raw = await pool(tickers, 4, daily);
  const gbp: Record<string, Points> = Object.fromEntries(ids.map((id, k) => [id, toGbp(raw[k].currency, raw[k].points)]));
  gbp.TBILL = toGbp('USD', cashUsd);

  // A weekly grid ending at Bitcoin's latest close (crypto trades every day).
  const end = gbp.BTC[gbp.BTC.length - 1][0];
  const weeks = YEARS * 52;
  const grid = Array.from({ length: weeks + 1 }, (_, i) => end - (weeks - i) * 7 * DAY);
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);

  const series: History['series'] = {};
  const worst: History['worst'] = {};
  const starts: History['starts'] = {};
  for (const [id, pts] of Object.entries(gbp)) {
    series[id] = grid.map((t) => {
      const v = at(pts, t);
      return v == null || t < pts[0][0] ? null : Number(v.toPrecision(6));
    });
    worst[id] = worstFall(pts);
    starts[id] = d(pts[0][0]);
  }

  return {
    source: 'Yahoo Finance daily closes (dividend-adjusted where available), GBP via daily GBP/USD; cash is the iShares £ Ultrashort Bond ETF; tokenised T-bills from the 3-month T-bill yield',
    fetched_at: new Date().toISOString(),
    dates: grid.map(d),
    benchmarks: BENCHMARKS,
    series, worst, starts,
  };
}
