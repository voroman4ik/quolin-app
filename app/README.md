# Quolin demo app

The phone-frame demo from `docs/strategy.md` §5: crypto, the careful way, sold through banks.

```bash
npm install
npm run dev        # http://localhost:3000  (bank console: /bank)
npm test           # engine, packs, baskets, purchase rules, evidence chain
npm run build
```

## What's in it

**Customer app (`/`).** Phone frame on desktop, full screen on mobile. The left panel is the demo guide: jump to any step, show each of the four outcomes, switch country (which picks the rule pack), currency and brand (Quolin or Northbank white-label). The right panel shows the engine trace for the latest decision.

1. Welcome, then the adviser-style fact-find: you, money, goals, risk.
2. Learn to unlock: 5 lessons, each ending in a question. This is also the regulator's test.
3. Result: Allow / Not yet / Refer / Not for you, with the personal limit and plain-English reasons.
4. Baskets (Core, Digital Gold, Steady), each with a what-it's-for card and a worst-year card. Assets not approved in the person's country are left out and the basket rebalances.
5. Build your own: Level 2 lessons unlock it. The engine checks each weight live ("Capped at 10%", "Not on the Approved List here").
6. Weekly plan, with the UK 24h cooling-off rule and buying that stops at the limit.
7. Portfolio: a 30% fall met with context, and a 24h pause on "sell everything". Scam Shield withdrawals only go to your own bank account. Account has a beneficiary and a CGT CSV export.

**Bank console (`/bank`).** Every decision with its reasons, the rules it ran and its frozen snapshot. Includes a refer queue, replay that proves a decision reproduces, the Approved List matrix, a "publish regulator update" button that re-assesses the book live, and a tamper test that breaks the hash chain. It shares a localStorage ledger with the app, so open it in a second tab and decisions appear as they're made.

## Engine

`lib/engine/` is a TypeScript port of the quolin-main DSL v2. Rules are comparisons only: no arithmetic, worst outcome wins, rule order doesn't matter, a missing fact refers by name, money in pence and proportions in basis points. Evidence is a SHA-256 hash chain.

`lib/packs/` holds the UK, SG, EU and HK packs. They share one rule set and differ in thresholds, cooling-off and the Approved List (taken from the two-pager table). Each pack has an illustrative v2. **All packs are illustrative and not reviewed.** Prices, drawdowns and FX rates are illustrative too.

## Choices to review

- Failing the course is **Not yet** (retake tomorrow), not **Not for you** as the two-pager says. Telling a nervous first-timer "never" for a quiz score felt wrong. It's one line in `lib/packs/index.ts` (`KNOWLEDGE.consumer`).
- Loss-capacity band comes from the "50% fall" answer, pulled down by a cautious attitude or by dependants with under 6 months' buffer (`lossBand` in `lib/decide.ts`). Limits by band are 0 / 2% / 5% / 10% / 10%, capped per country (SG 5%, others 10%).
- In the UK and HK, gold and T-bills await a legal opinion, so **Steady isn't offered there** and Digital Gold becomes 100% Bitcoin. Switch the country to Singapore to see Steady.
- MY, AU and US have no pack, so they refer rather than guess.
