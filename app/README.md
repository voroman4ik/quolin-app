# Quolin demo app

The phone-frame demo from `docs/strategy.md` §5: crypto, the careful way, sold through banks.

```bash
npm install
npm run dev          # http://localhost:3000  (bank console: /bank)
npm test             # engine, seven packs, local rules, portfolio, backtest, currency, evidence chain
npm run build
npm run market-data  # refresh the CoinGecko snapshot (prices, logos) in lib/market-data.json
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

## Real prices, and every number follows what you do

`lib/market-data.json` holds the top 15 coins by market cap (CoinGecko, 7 Oct 2026; excluding
non-retail tokens and duplicate stablecoins) plus tokenised gold, with logos in `public/coins/` and
53 weekly GBP closes. The demo replays that year: the plan starts a year ago and the time controls
(+1 day / week / month / 3 months / to today) move through real prices.

The portfolio is event-sourced (`lib/portfolio.ts`): every buy, sale and transfer is a transaction
at that week's price, and value, gain, realised loss, the limit meter, the chart and the tax export
are all derived from them. Each weekly buy runs the purchase rules; at the personal limit it buys
only the headroom, then pauses. "What if it fell 30%?" applies a shock to crypto (not T-bills).

Baskets take a one-off amount plus a weekly amount, with a backtest on the real year
(`lib/backtest.ts`): biggest fall first, then annual return, volatility, best and worst week,
return per unit of risk, against Bitcoin alone and cash, and what the chosen plan would be worth today.

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
