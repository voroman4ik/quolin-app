// Live prices for every coin Quolin shows, from CoinGecko (GBP), cached for two minutes.
import { ASSET_IDS } from '@/lib/catalog';
import { COIN_DATA } from '@/lib/market';

export const revalidate = 120;

export async function GET() {
  const ids = ASSET_IDS.map((a) => COIN_DATA[a]?.id).filter(Boolean).join(',');
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=gbp&ids=${ids}&price_change_percentage=24h`, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const rows = (await res.json()) as { id: string; current_price: number; price_change_percentage_24h: number | null; market_cap: number; market_cap_rank: number }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const prices = Object.fromEntries(ASSET_IDS.filter((a) => COIN_DATA[a] && byId[COIN_DATA[a].id]).map((a) => {
      const r = byId[COIN_DATA[a].id];
      return [a, { gbp: r.current_price, change24h: r.price_change_percentage_24h, marketCapGbp: r.market_cap, rank: r.market_cap_rank }];
    }));
    return Response.json({ source: 'CoinGecko', at: new Date().toISOString(), prices });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
