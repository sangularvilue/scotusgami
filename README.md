# SCOTUSgami

**A Scorigami for the Supreme Court** — every possible division of the nine
justices into majority / dissent / took-no-part, with squares that fill in as
real cases produce each alignment. Live at
[scotusgami.grannis.xyz](https://scotusgami.grannis.xyz).

Covers the current natural court (Roberts–Jackson, October Term 2022–present).

## The math

Each case maps to a 9-character key over the justices in seniority order
(`M` majority, `D` dissent, `A` absent), e.g. SFFA v. Harvard is `MMMDDMMMA`
(6–2, Jackson out). The displayed universe, grouped by number absent:

| bench        | squares |
| ------------ | ------- |
| full bench   | 256     |
| one out      | 837     |
| two out      | 2,304   |
| three+ / ties| only if they occur |

## Data

- **[Oyez](https://www.oyez.org)** — primary source. Case list + per-case vote
  matrices, QP, holding, opinion authors and joins.
- **[Supreme Court Database](https://scdb.la.psu.edu)** — supplements terms
  where Oyez hasn't entered votes yet (currently most of OT2024). Oyez records
  replace SCDB ones per-docket automatically as Oyez catches up.

A Vercel cron hits `/api/refresh` daily at 11:15 ET to re-scrape the current
term into Redis.

## Stack

Next.js (App Router) · Tailwind v4 · Upstash Redis · Vercel.

```bash
npm run dev                        # local dev (falls back to data/*.json without Redis env)
npx tsx scripts/check-grid.ts      # combinatorics sanity checks
npx tsx scripts/backfill.ts        # scrape all terms from Oyez → data/
npx tsx scripts/supplement-scdb.ts 2024   # SCDB gap-fill for one term → data/
npx tsx scripts/load-redis.ts      # push data/ into Upstash
```

Note: build/dev use `--webpack` (Turbopack rejects projects on mapped network
drives).
