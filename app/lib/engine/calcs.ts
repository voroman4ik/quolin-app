import type { ThresholdValue } from './types';

type Read = (path: string) => unknown;
type Calc = (read: Read, thresholds: Record<string, ThresholdValue>) => number;

const num = (read: Read, path: string) => read(path) as number;

/** The share of savings this person may hold in crypto: the band's share, never above the
 *  regime's cap. Pure integer arithmetic, rounded down. */
function personalLimitBps(read: Read, t: Record<string, ThresholdValue>): number {
  const table = t.limit_bps_by_loss_band as Record<string, number>;
  const band = String(num(read, 'client.loss_capacity_band'));
  const bandBps = table[band] ?? 0;
  return Math.min(bandBps, t.max_crypto_concentration_bps as number);
}

/** Registered derived values. A pack may name only these (dsl-spec §7). */
export const CALCS: Record<string, Calc> = {
  personal_limit_bps: personalLimitBps,

  personal_limit_cents: (read, t) =>
    Math.floor((num(read, 'client.assessable_portfolio_cents') * personalLimitBps(read, t)) / 10_000),

  post_trade_crypto_cents: (read) =>
    num(read, 'positions.crypto_value_cents') + num(read, 'trade.amount_cents'),

  post_trade_crypto_bps: (read) => {
    const portfolio = num(read, 'client.assessable_portfolio_cents');
    const after = num(read, 'positions.crypto_value_cents') + num(read, 'trade.amount_cents');
    // Somebody with nothing who buys anything has put all of it in.
    if (portfolio === 0) return after > 0 ? 10_000 : 0;
    return Math.floor((after * 10_000) / portfolio);
  },
};
