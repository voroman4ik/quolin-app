// Snapshots real market data for the demo: the top 15 coins by market cap (CoinGecko),
// their logos, and a year of weekly GBP closes. Run with `npm run market-data`.
// The app ships this snapshot so it works offline; live prices refresh on top of it.
//
// Excluded from the top 15 on purpose: tokens retail can't trade (Figure HELOC),
// duplicate dollar stablecoins beyond USDT and USDC (USDS, USDe), and exchange IOUs (WBT, LEO).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.coingecko.com/api/v3';
const SKIP = new Set(['figure-heloc', 'usds', 'ethena-usde', 'whitebit', 'leo-token', 'rain']);
const EXTRA = ['pax-gold'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return res.json();
    if (res.status === 429) { await sleep(20_000 * attempt); continue; }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  throw new Error(`${path}: rate limited`);
}

const markets = await get('/coins/markets?vs_currency=gbp&order=market_cap_desc&per_page=40&page=1');
const top = markets.filter((c) => !SKIP.has(c.id)).slice(0, 15);
const extra = await get(`/coins/markets?vs_currency=gbp&ids=${EXTRA.join(',')}`);

await mkdir(join(ROOT, 'public/coins'), { recursive: true });
const out = { source: 'CoinGecko', fetched_at: new Date().toISOString(), currency: 'GBP', coins: [] };

for (const c of [...top, ...extra]) {
  const ticker = c.symbol.toUpperCase();
  const img = await fetch(c.image);
  const ext = (img.headers.get('content-type') ?? '').includes('jpeg') ? 'jpg' : (img.headers.get('content-type') ?? '').includes('webp') ? 'webp' : 'png';
  const file = `${ticker.toLowerCase()}.${ext}`;
  await writeFile(join(ROOT, 'public/coins', file), Buffer.from(await img.arrayBuffer()));

  await sleep(2500);
  const chart = await get(`/coins/${c.id}/market_chart?vs_currency=gbp&days=365&interval=daily`);
  // One close per week, oldest first, ending today: 53 points.
  const daily = chart.prices.map(([, p]) => p);
  const weekly = [];
  for (let i = daily.length - 1; i >= 0 && weekly.length < 53; i -= 7) weekly.unshift(daily[i]);

  out.coins.push({
    id: c.id, ticker, name: c.name, rank: c.market_cap_rank, logo: `/coins/${file}`,
    price_gbp: c.current_price, market_cap_gbp: c.market_cap, volume_24h_gbp: c.total_volume,
    below_peak_pct: c.ath_change_percentage === null ? null : Math.round(c.ath_change_percentage),
    weekly_gbp: weekly.map((p) => Number(p.toPrecision(6))),
  });
  console.log(`${ticker.padEnd(6)} £${c.current_price}  ${weekly.length} weeks`);
}

await writeFile(join(ROOT, 'lib/market-data.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${out.coins.length} coins`);
