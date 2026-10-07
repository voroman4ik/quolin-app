// Live price history for backtests and the demo replay. Fetched from Yahoo Finance and cached
// for six hours, so the app is always within a working day of the market without hammering it.
import { buildHistory } from '@/lib/data/yahoo';

export const revalidate = 21600;

export async function GET() {
  try {
    const h = await buildHistory();
    return Response.json(h, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
