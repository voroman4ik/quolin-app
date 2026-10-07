# Quolin demo app

The phone-frame demo from `docs/strategy.md` §5: crypto, the careful way, sold through banks.

```bash
npm install
npm run dev          # http://localhost:3000  (bank console: /bank)
npm test             # engine, seven packs, local rules, portfolio, backtest, currency, evidence chain
npm run build
npm run market-data  # refresh the CoinGecko snapshot (ranks, logos) in lib/market-data.json
npm run history      # refresh the offline snapshot of 10 years of real prices (lib/history.json)
```

## Seven jurisdictions, switchable

Country picks the rule pack; currency follows it unless the person pins one. Switch from the
phone header (`UK rules · GBP ▾`), the Account tab, or the demo guide. The right panel shows the
same person under all seven packs side by side.

| Pack | Local rules (beyond the shared base) | Asks in the fact-find | Currency |
|---|---|---|---|
| UK (FCA) | investor category declared; 24h cooling-off before first buy | investor category | GBP |
| SG (MAS) | no buying with a credit card; cap 5% | — | SGD |
| EU (MiCA) | white papers confirmed before first buy; USDT, gold, privacy coins not allowed | — | EUR |
| HK (SFC) | eligible large-caps only (2+ indices); lower limits (max 8%) | — | HKD |
| AU (ASIC) | target market: 5+ year horizon | — | AUD |
| MY (SC) | optional Shariah screen (drops interest-bearing T-bills) | Shariah preference | MYR |
| US (OCC/state) | New York referred (BitLicense) | state | USD |

Japan has no pack and refers. All packs are **illustrative and not reviewed**.

Amounts are typed in the person's currency and converted to the GBP base the engine runs on.
Live ECB rates (Frankfurter) when online, a 7 Oct 2026 snapshot otherwise. Limits are shares of
savings, so no rule depends on a rate.

## Real data, live

| What | Source | Live | Offline fallback |
|---|---|---|---|
| Coin prices, 24h change, rank | CoinGecko `/coins/markets` | `/api/prices`, every 2 min | latest weekly close |
| 10 years of weekly prices: 15 coins, tokenised gold, S&P 500, Nasdaq 100, MSCI World, FTSE 100, Apple, Microsoft, Nvidia, Amazon, Tesla, gold, US Treasuries, £ cash | Yahoo Finance daily closes (dividend-adjusted), GBP via daily GBP/USD | `/api/history`, cached 6h | `lib/history.json` |
| Tokenised T-bills | 3-month US T-bill yield (^IRX), accrued daily | same | same |
| Worst fall on record | computed from each asset's full daily history, in GBP | same | same |
| Exchange rates | ECB reference rates (Frankfurter) | on load | 7 Oct 2026 rates |

Yahoo's chart API is unofficial; for production use a licensed feed (e.g. Twelve Data or LSEG for
shares, Kaiko or CoinGecko Pro for crypto). `lib/data/yahoo.ts` is the only place that knows the source.

## Every number follows what you do

The demo replays the last year of real prices: the plan starts a year ago and the time controls
(+1 day / week / month / 3 months / to today) move through it. The portfolio is event-sourced
(`lib/portfolio.ts`): every buy, sale and transfer is a transaction at that week's price, and value,
gain, realised loss, the limit meter, the chart and the tax export are derived from them. Each weekly
buy runs the purchase rules; at the personal limit it buys only the headroom, then pauses.
"What if it fell 30%?" applies a shock to crypto (not cash or T-bills).

Baskets take a one-off amount plus a weekly amount.

**Backtest** is its own screen, opened from any basket, your own basket or an asset: choose
3M / 6M / 1Y / 3Y / 5Y / 10Y (periods need history for every asset: Ether starts Nov 2017, so Core
stops at 5Y; Bitcoin alone goes to 10Y) and compare against up to four of: S&P 500, Nasdaq 100,
MSCI World, FTSE 100, Apple, Microsoft, Nvidia, Amazon, Tesla, gold, US Treasuries, £ cash,
Bitcoin, Ether, Solana, XRP. Shows biggest fall first, then annual return and volatility, and what
your one-off plus weekly plan would be worth in each.

Search: on the Baskets tab (baskets and assets), All assets, and Build your own.

Wallets: no 90-day lock. A new address waits 24 hours once (with a "has anyone asked you to?"
check); known addresses go straight through.

## Engine

`lib/engine/` is a TypeScript port of the quolin-main DSL v2. Rules are comparisons only: no arithmetic, worst outcome wins, rule order doesn't matter, a missing fact refers by name, money in pence and proportions in basis points. Evidence is a SHA-256 hash chain.

`lib/packs/` holds the seven packs: shared base rules (fact-find, Approved List policy, personal limit) plus each country's local rules, questions, disclosures, thresholds and Approved List. Each pack has an illustrative v2 the bank console can publish. **All packs are illustrative and not reviewed.** Prices are real (CoinGecko snapshot); worst-ever drawdowns and approval statuses are curated and approximate.

## Choices to review

- Failing the course is **Not yet** (retake tomorrow), not **Not for you** as the two-pager says. Telling a nervous first-timer "never" for a quiz score felt wrong. It's one line in `lib/packs/index.ts` (`KNOWLEDGE.consumer`).
- Loss-capacity band comes from the "50% fall" answer, pulled down by a cautious attitude or by dependants with under 6 months' buffer (`lossBand` in `lib/decide.ts`). Limits by band are 0 / 2% / 5% / 10% / 10%, capped per country (SG 5%, others 10%).
- In the UK and HK, gold and T-bills await a legal opinion, so **Steady isn't offered there** and Digital Gold becomes 100% Bitcoin. Switch to Singapore or the US to see Steady.
- Quolin's own policy never lists privacy coins (ZEC, XMR), meme coins (DOGE), exchange tokens (BNB) or anything under 3 years old (HYPE), even where a regulator would allow them. ZEC rose 7.6× this year and is still excluded.
- Stablecoins (USDT, USDC) are shown with their approval status but kept out of baskets.
- The personal limit is on what you hold (market value), so a rally can carry you above it: buying pauses, nothing is force-sold.
- Japan has no pack, so it refers rather than guesses.
