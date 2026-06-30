import type { Metadata } from "next";
import BingoBoard from "@/components/BingoBoard";
import { buildBingoGrid, type BingoGrid } from "@/lib/bingo";
import { currentTerm } from "@/lib/oyez";
import type { BingoCase } from "@/lib/types";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "SCOTUSgami · Bingo",
  description:
    "Opinion-authorship bingo for the current term — who has written from each argument sitting, and who is still owed an opinion.",
};

/** Redis in production; fall back to data/bingo-{term}.json for local dev. */
async function loadGrid(term: number): Promise<BingoGrid | null> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { loadBingo } = await import("@/lib/redis");
    const cases = await loadBingo(term);
    return cases.length ? buildBingoGrid(term, cases) : null;
  }
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const cases = JSON.parse(
      readFileSync(join(process.cwd(), "data", `bingo-${term}.json`), "utf8")
    ) as BingoCase[];
    return buildBingoGrid(term, cases);
  } catch {
    return null;
  }
}

async function loadBingoData(): Promise<{
  grids: { term: number; grid: BingoGrid }[];
  lastRefresh: string | null;
}> {
  const term = currentTerm();
  // Current term plus the one ahead, so the upcoming term's granted cases show
  // up before its argument calendar is published.
  const terms = [term, term + 1];

  let lastRefresh: string | null = null;
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { loadMeta } = await import("@/lib/redis");
    lastRefresh = (await loadMeta())?.lastRefresh ?? null;
  }

  const grids = (
    await Promise.all(
      terms.map(async (t) => ({ term: t, grid: await loadGrid(t) }))
    )
  ).filter((g): g is { term: number; grid: BingoGrid } => g.grid !== null);

  return { grids, lastRefresh };
}

function termSummary(grid: BingoGrid): string {
  const parts: string[] = [];
  if (grid.decidedCount) parts.push(`${grid.decidedCount} decided`);
  if (grid.pendingCount) parts.push(`${grid.pendingCount} pending`);
  if (grid.granted.length) parts.push(`${grid.granted.length} granted`);
  return parts.join(" · ") || "no cases yet";
}

export default async function BingoPage() {
  const { grids, lastRefresh } = await loadBingoData();

  return (
    <main className="relative z-10 flex flex-col">
      <header className="reveal mx-auto w-full max-w-5xl px-5 pb-8 pt-12 text-center">
        <p className="smallcaps text-[13px] text-gold">who is owed an opinion</p>
        <h1 className="font-display mt-2 text-5xl font-medium tracking-tight text-cream sm:text-6xl">
          SCOTUS<span className="italic text-gold-bright">bingo</span>
        </h1>
        <div className="rule-double mx-auto mt-5 w-56" />
        <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-cream-dim">
          Within each argument sitting the Chief hands every justice roughly one
          majority opinion. So the cases already decided tell you who is still{" "}
          <span className="text-slate-dissent">owed</span> one — and therefore
          who is likely holding each case still out.
        </p>
        <a
          href="/"
          className="mt-5 inline-block rounded border border-gold/60 px-4 py-1.5 font-mono text-[12px] text-gold transition-colors hover:bg-gold/10"
        >
          ← the full board
        </a>
      </header>

      {grids.length === 0 ? (
        <p className="mx-auto max-w-md px-5 pb-16 text-center text-[14px] text-cream-dim">
          No argued cases recorded yet. The card fills in as the daily refresh
          pulls argument and opinion data from Oyez.
        </p>
      ) : (
        <div className="space-y-12 pb-8">
          {grids.map(({ term, grid }, i) => {
            const upcoming = grid.sittings.length === 0 && grid.granted.length > 0;
            return (
              <section key={term}>
                <div className="mx-auto mb-3 w-full max-w-5xl px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-line pb-2">
                    <h2 className="font-display text-2xl text-cream">
                      October Term {term}
                    </h2>
                    <span className="font-mono text-[11px] text-cream-faint">
                      {termSummary(grid)}
                    </span>
                  </div>
                  {upcoming && (
                    <p className="mt-2 text-[12px] leading-relaxed text-cream-dim">
                      Cert granted, but the Court hasn&apos;t released the OT
                      {term} argument calendar yet — these cases sit unscheduled
                      and slot into their sittings as argument dates are set.
                    </p>
                  )}
                </div>
                <BingoBoard grid={grid} showLegend={i === 0} />
              </section>
            );
          })}
        </div>
      )}

      <footer className="relative z-10 border-t border-ink-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-3 px-5 py-6 font-mono text-[11px] text-cream-faint">
          <span>October Terms {currentTerm()}–{currentTerm() + 1}</span>
          {lastRefresh && (
            <span>updated {new Date(lastRefresh).toISOString().slice(0, 10)}</span>
          )}
          <a
            href="https://www.oyez.org"
            target="_blank"
            rel="noreferrer"
            className="text-cream-dim hover:text-gold-bright"
          >
            data: Oyez
          </a>
        </div>
      </footer>
    </main>
  );
}
