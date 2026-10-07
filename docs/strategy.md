# Quolin: crypto people can trust

Research and strategy brief, 7 October 2026. Draws on: Fortuna deck, Quolin pre-seed deck and two-pager, `quolin-main` (the Python engine), `quolin-demo-main` (the decision-tree demo), and the external research cited at the bottom.

---

## 1. The problem, with numbers

Macro: **people know about crypto but don't trust it, so they don't invest.** UK awareness is 91% but ownership *fell* from 12% to 8% in 2025 (FCA Wave 6). Only 5% of current owners bought for the first time after Oct 2024, so almost no new people are coming in.

### Why people don't trust it

You listed 5 reasons. The evidence supports all of them, and there are 5 more worth adding.

| # | Barrier | Evidence | What the person actually feels |
|---|---|---|---|
| 1 | **Scams and bad stories** | FBI IC3 2025: $11.4bn crypto fraud losses (+22%), $7.2bn of it investment fraud, $4.4bn from over-60s. 54% have seen crypto scam ads on social media. 25% of UK crypto users have met a scam. | "Crypto is where you get robbed." |
| 2 | **Volatility** | Top stated concern in US surveys (33–41%). "Too risky" is the #2 reason in the UK (17%). | "I'll lose half overnight." |
| 3 | **No recovery** (decentralised) | ~20% of all BTC is believed lost forever. Seed phrases, irreversible transfers. | "One mistake and it's gone." |
| 4 | **Too complex** | **#1 UK reason for not buying: "I don't understand how it works" (22%).** | "I don't get it, so it's not for me." |
| 5 | **No tangible value** | Biggest US barrier: "I don't believe it's legitimate", up ~20% in a year. | "Apple makes my iPhone. What does Bitcoin make?" |
| 6 | **No protection** *(new)* | #3 UK reason (12%). 66% of users expect no recourse. **20% of non-users would invest if regulation came with protection when the firm fails.** | "If the exchange goes bust, nobody pays me back." (FTX) |
| 7 | **"Not worth it for my money"** *(new)* | #4 UK reason (11%). | "It's for whales and crypto bros." |
| 8 | **My own bank tells me it's dangerous** *(new)* | UK banks block or cap transfers to exchanges (e.g. Monzo £5k/30 days, credit cards blocked). | The institution I trust says no. |
| 9 | **Identity / stigma** *(new)* | 66% of UK male users vs 52% of female users accept the risk. The culture is hype, memes, "to the moon". | "That's not people like me." |
| 10 | **Admin: tax, death, paperwork** *(new)* | UK CGT applies to every disposal. Inheritance of self-custodied keys is unsolved for most people. | "What happens when I die? How do I file this?" |

**The insight that holds it together:** five of these ten (1, 3, 6, 8, 10) are not about crypto at all. They are about **who stands between you and the asset**. A bank already solves them for savings: it has a name, a helpline, password reset, a compensation scheme and a regulator. The other five (2, 4, 5, 7, 9) are about **how crypto is presented**: as a casino, not as an investment.

So the job splits in two:

1. **Put a trusted institution between the person and the chain.** This is the bank channel.
2. **Present crypto like Vanguard presents index funds:** few assets, explained plainly, sized to what you can lose, bought slowly. This is the app.

---

## 2. What the past ideas each got right, and where each broke

| Idea | Kept | Dropped / fixed |
|---|---|---|
| **Fortuna** (themes, ETF-style baskets, backtest "time machine", 0.65% fee, own MAS licence) | Themed baskets, "invest in ideas", ETF simplicity, low flat fee | **Own licence plus non-custodial** contradicts "safe haven": non-custodial means seed phrases, so problem #3 comes back. **Backtests against the S&P** to show crypto "outperforms" are past-performance marketing; FCA promotion rules restrict them, and it is the hype framing we are trying to escape. Turn the time machine round to show **the worst drawdown you'd have lived through**. |
| **Quolin B2B** (decision engine, RAA, limits, approved list, evidence chain, packs for SG/HK/AU/EU, sell via compliance heads) | The whole engine: classify, assess, limit, allow/block/refer, replay, inspection reports. Bank barrier analysis (capital, custody, client checks). "Never a cut of trading." | It was invisible to retail and sold a narrow compliance tool into a ~38-firm market. The engine is the trust layer, but nobody *sees* it. |
| **quolin-demo** (live decision tree, a regulatory update flips a trade) | The "rules change and the system reacts live" demo moment. | Trade-surveillance framing, US-centric. |

**The merge:** the Quolin engine's compliance gate becomes the consumer's **onboarding and guardrails**, and Fortuna's simplicity becomes the **product surface**. What a regulator requires (knowledge test, personal limits, risk warnings, cooling-off) is exactly what a nervous first-time investor needs. **We turn the compliance burden into the trust experience.**

---

## 3. The product: Quolin

**Line:** *Crypto, the careful way.* (Or keep the old deck's: *Not the same products for everyone. The same care.*)

**Shape:** a consumer-grade investing app that a bank puts its name on. B2B2C. The person downloads their bank's app (or a "Quolin by Northbank" app); the bank is the regulated firm; a licensed partner holds the coins; Quolin supplies the experience and the engine.

### Ten features, one per barrier

| Barrier | Feature | How it works |
|---|---|---|
| 1 Scams | **Scam Shield** | Closed loop: money only comes from and goes back to your own bank account. No sending to random wallets by default; external withdrawals unlock later, with a 24h delay and a "has anyone asked you to do this?" check. Your bank's name is on it, so a fake "Quolin" on Instagram is easy to spot. |
| 2 Volatility | **Calm by design** | Recurring buys (DCA) by default. No price-push notifications. A Worst-Case card on every asset: "In 2022 this fell 77%. £1,000 became £230." A cooling-off period on the first buy. A "pause, don't panic" flow when you try to sell everything in a crash. |
| 3 No recovery | **Bank-grade recovery** | No seed phrases. A regulated custodian holds the assets; you get password reset, a helpline and a named beneficiary for inheritance. "Forgot your password" works like it does at your bank. |
| 4 Complex | **Learn to unlock** | The regulator's knowledge test (SG RAA / UK appropriateness / HK knowledge assessment) becomes a 5-minute interactive course. Pass it and you unlock investing. **It is education and compliance in one step.** |
| 5 No value | **What it's for cards** | Each approved asset gets a plain-English card: what it does, who uses it, what gives it value, what can kill it. BTC is "digital gold: scarce, nobody can print more". Add **tokenised gold and T-bills** as bridge assets with obvious value behind them. |
| 6 No protection | **Approved List + segregation** | Only assets that pass published criteria (age, liquidity, regulated custody, no anonymous issuer, no leverage). Assets are held in segregation with a regulated custodian, so if Quolin fails your coins are still yours. Be honest that this **is not FSCS**. |
| 7 Not worth it | **Start from £10** | Fractional, recurring £10/week. Sized to your life, not to whales. |
| 8 Bank says no | **Inside your bank** | The bank offers it, so it is no longer "the bank blocking crypto". It is "the bank's careful crypto option". |
| 9 Stigma | **Quiet brand** | Quolin palette (ink, bronze, canvas). No rockets, no green candles, no leaderboard. It looks like a pension app. |
| 10 Admin | **Done for you** | Tax report export (CGT), inheritance beneficiary, and a statement your accountant understands. |

### The core mechanic: your personal limit

The engine (packs and thresholds from `quolin-main`) produces one number per person: **"You can put up to £X (Y% of your savings) into crypto."** It comes from loss capacity, knowledge and jurisdiction (HK already requires a personal limit). Most apps would see this as friction. Here it is the trust feature: **the app that tells you to invest *less*.** Every decision is recorded on the evidence chain, so the bank can prove to its regulator why each client was allowed what.

### Baskets (the ETF constructor, with guardrails)

- **Ready-made:** *Core* (BTC 70 / ETH 30), *Digital Gold* (BTC + tokenised gold), *Steady* (mostly tokenised T-bills or gold with a small BTC slice), *Builders* (ETH, SOL and others, for unlocked users only).
- **Build your own:** only from the Approved List, and the engine checks the weights. Any single non-core asset is capped, and the more speculative tiers stay locked until a higher knowledge level is passed.
- Monthly auto-rebalance, like an index.

### Regulatory caveat (must be resolved, not hand-waved)

Ready-made baskets with auto-rebalancing can count as **portfolio management**, and a recommended basket can count as **advice**. Both are heavier permissions than "arranging/dealing". The fix is the same as in the B2B deck: **the bank or licensed partner owns every policy and every basket.** Quolin supplies software and does not hold the regulatory role. A perimeter legal opinion is the first legal spend, as before.

---

## 4. Business model and go-to-market

**Do not launch as a standalone consumer exchange.** That means our own licence (FCA authorisation by Oct 2027, MAS licence plus capital), custody, and paying for every user in a market where Revolut, Coinbase and eToro already spend heavily on acquisition. Fortuna's plan failed on exactly this.

**Sell through banks: B2B2C.** The bank has the trust, the customers and the licence path. The rails (Bitpanda Technology Solutions, Coinbase CaaS, Zerohash) provide trading and custody. **Quolin is the missing middle: the trust experience and the compliance engine.**

```
Customer ──▶ Bank app (bank brand, bank's regulatory permissions)
               └─ Quolin layer: learn-to-unlock · personal limit · approved list ·
                  baskets · scam shield · evidence chain + regulator reports
                     └─ Rails partner: execution + regulated custody (Bitpanda / Zerohash / Coinbase)
```

**Why banks need us, even though Bitpanda already sells them rails:**
- BBVA, Openbank, Sparkassen, Raiffeisen (18m customers), BW-Bank, RAKBANK, Schwab, Morgan Stanley, PNC and SoFi have all launched or announced retail crypto in the last 18 months. **The market has decided banks will offer crypto.**
- What they ship is usually a bare buy/sell screen. Every bank's real fear is a *mis-selling or scam headline* involving its customers. Quolin sells the bank **"your customers buy crypto and nobody gets hurt, and you can prove it to the regulator"**.
- The rails providers are channel partners, not competitors (same as in the old deck).

**Pricing (hypothesis):** platform licence per bank (£150–400k/yr per jurisdiction, as in the old deck) plus a per-active-investor fee (£1–3/month). **Never a cut of trades** (keeps the independence argument). An optional small AUM fee on baskets, paid to the bank, with a share to us, is worth testing.

**Market order (recommendation):**
1. **EU (MiCA in force)**: banks are launching right now and need differentiation. Fastest bank sales.
2. **Singapore**: Su-Lee's network, the RAA is required, and the existing pack and engine work fits.
3. **UK**: the regime goes live 25 Oct 2027 and applications run 30 Sep 2026 – 28 Feb 2027. UK banks are deciding *now* whether to offer crypto. Pitch "be ready for day one".

**Optional consumer-direct later:** "Quolin" as its own brand once there is a licensed partner, for people whose bank doesn't offer it. Not before.

---

## 5. What we build first

**A phone-shaped web app on `localhost:3000`** (Next.js, mobile frame on desktop, installable PWA). Port to App Store later through Expo/React Native or Capacitor. The web version is faster to iterate on and is what a bank pitch needs.

**The demo is the sales tool.** It shows a fictional bank ("Northbank") with Quolin inside. One person's journey, about 4 minutes:

1. **Open**: "Crypto, the careful way" inside the Northbank app.
2. **Learn to unlock**: a 5-question interactive risk-awareness course (it is the regulatory test).
3. **Your limit**: 3 questions on savings and loss capacity, then *"Up to £1,200 (5% of savings). We'll suggest starting with £25 a week."*
4. **Pick a basket**: Core / Digital Gold / Steady, each with a What-it's-for card and a Worst-Case card.
5. **Build your own**: drag in SOL and the engine says *"Locked: pass Level 2 first"* or *"Capped at 10%"*, with the reason shown.
6. **Calm**: a crash scenario plays, the portfolio drops 30%, and the app responds with context, not panic.
7. **Bank view** (the switch for the B2B pitch): the compliance console. Every decision has plain-English reasons, the rule version and the evidence chain. This reuses the old Quolin UI concepts.

**Engine:** port the DSL evaluator (pure comparisons, about 2.5k lines of Python today) to TypeScript and reuse the pack JSON format. That keeps the demo one `npm run dev`. The Python engine stays as the production reference.

**Mock first, real later:** prices (live from a public API is easy), custody and execution stay mocked behind typed interfaces, the same pattern `quolin-main` used.

---

## 6. Open questions only you can answer

1. **B2B2C via banks first?** (Recommended.) Or own-brand consumer app first?
2. **First market for the demo:** UK framing (FCA, GBP), EU (MiCA, EUR) or Singapore (MAS RAA, SGD)? The engine can switch, but copy and currency need one default. Recommendation: **UK/GBP** for the demo (home base, live regime timing), with SG and EU packs selectable.
3. **Team:** is it still Su-Lee and Daniel? Who else is involved from Fortuna (Shagun, Mahmudur, Matthew)? This affects the deck and whether the demo is in Python or TypeScript.
4. **Tokenised gold / T-bills** on the Approved List from day one? They add "real value behind it" but add issuer risk and complexity.

---

## Sources

- FCA, *Cryptoassets consumer research 2025 (Wave 6)*: https://www.fca.org.uk/publication/research-notes/cryptoasset-consumer-research-2025-wave-6.pdf
- FBI IC3 2025 via The Block: https://www.theblock.co/post/397134/fbi-says-crypto-related-fraud-losses-hit-record-11-4-billion-in-2025-with-seniors-bearing-the-brunt
- Voter distrust survey (2026): https://www.webull.com/news/15242655255061504
- Good Money Guide crypto investor survey 2026: https://goodmoneyguide.com/cryptocurrency/crypto-investor-survey-2026/
- Pew, two-thirds of Americans don't trust crypto: https://www.theblock.co/amp/post/225734/pew-research-crypto-study
- FCA final crypto regime (PS26/9–13, go-live 25 Oct 2027): https://www.lw.com/en/insights/the-race-is-on-fca-publishes-final-rules-for-uk-cryptoasset-regime · https://www.fca.org.uk/publications/policy-statements/cryptoasset-regime
- FCA crypto promotions (24h cooling-off, appropriateness): https://cms.law/en/int/legal-updates/fca-publishes-final-rules-and-supplementary-draft-guidance-on-financial-promotions-for-cryptoassets
- UK crypto ETNs for retail and the ISA change: https://cryptouk.io/resources/the-uk-opened-the-door-to-crypto-etns-then-closed-it-through-the-tax-system/
- Banks launching via Bitpanda (BW-Bank, Raiffeisen, RAKBANK, BBVA, Openbank, Schwab…): https://blog.bitpanda.com/en/regulated-crypto-access-bw-bank-investors · https://en.coin-turk.com/raiffeisen-bank-inks-bitpanda-deal-to-offer-crypto-trading-to-18-million-clients/
- Paxos survey, 75% would buy crypto from their primary bank: https://insights.paxos.com/hubfs/2023PaxosCryptocurrencyAdoptionandPurchasingBehaviorSurvey.pdf
- CheckSig, 68% of Italians want crypto from their bank: https://clear.checksig.com/2025-06-17-checksig-survey-crypto-banking/
- UK bank crypto transfer limits: https://www.datawallet.com/de/krypto/best-crypto-friendly-banks-uk
- Basel crypto standard under targeted review (update due end-2026): https://www.bis.org/press/p260225.htm
- Lost BTC (~20%): https://vault12.com/glossary/social-recovery/
- Tokenised RWA market (~$22bn, gold tokens ~$5.5bn): https://blockeden.xyz/blog/2026/05/13/rwa-tokenization-19b-q1-2026-blackrock-buidl-pilot-to-production/ · https://beincrypto.com/only-one-asset-class-ready-rwa-tokenization/
- Bitwise 10 index ETF (BITW): https://www.fxstreet.com/cryptocurrencies/news/bitwise-10-crypto-index-etf-debuts-on-nyse-arca-featuring-btc-eth-and-xrp-202512091709
- Competitor consumer products (eToro Smart Portfolios, Revolut Robo, Trade Republic): https://www.etoro.com/en-us/blog/market-insights/introducing-crypto-copyfund-the-easiest-way-to-invest-in-top-cryptocurrencies · https://www.revolut.com/en-BG/news/revolut_launches_robo_advisor_in_eea_to_automate_investing/

---

## Decisions, 7 Oct 2026

- **Brand:** an own-brand Quolin app for the demo; sold through banks first (B2B2C), white-labelled for each one. Contacts: MY, SG, AU, HK, UK, US, EU.
- **Currency:** GBP default, with a currency switch (SGD, EUR, HKD, AUD, MYR, USD). Cross-border works through per-country rule packs plus a display-currency layer.
- **Market order:** Singapore leads (RAA in force, SG pack exists, tokenised money-market fund approved for retail, Su-Lee's network). EU scales (MiCA Art. 60 lets banks offer crypto by notification). UK and HK are "ready" markets (UK go-live 25 Oct 2027; HK requires a personal limit per client).
- **Team:** Volodymyr, Su-Lee, Dan only.
- **Tokenised gold and T-bills:** yes, per country where allowed. EU gold tokens are blocked (no MiCA asset-referenced token authorised yet). SG T-bills are OK (tokenised money-market fund approved for retail). UK and HK need a legal opinion.
- **Onboarding = an adviser's fact-find:** you, money, goals, risk and loss capacity, knowledge, then result (Allow / Not yet / Refer / Not for you).
- Two-pager: `docs/two-pager/Quolin_two-pager_Oct2026.pdf` (source HTML alongside).
