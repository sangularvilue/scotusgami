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
async function loadBingoData(): Promise<{
  grid: BingoGrid | null;
  lastRefresh: string | null;
  term: number;
}> {
  const term = currentTerm();
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { loadBingo, loadMeta } = await import("@/lib/redis");
    const [cases, meta] = await Promise.all([loadBingo(term), loadMeta()]);
    return {
      grid: cases.length ? buildBingoGrid(term, cases) : null,
      lastRefresh: meta?.lastRefresh ?? null,
      term,
    };
  }
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const cases = JSON.parse(
      readFileSync(join(process.cwd(), "data", `bingo-${term}.json`), "utf8")
    ) as BingoCase[];
    return { grid: buildBingoGrid(term, cases), lastRefresh: null, term };
  } catch {
    return { grid: null, lastRefresh: null, term };
  }
}

export default async function BingoPage() {
  const { grid, lastRefresh, term } = await loadBingoData();

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
          who is likely holding each case still out. October Term {term}.
        </p>
        <a
          href="/"
          className="mt-5 inline-block rounded border border-gold/60 px-4 py-1.5 font-mono text-[12px] text-gold transition-colors hover:bg-gold/10"
        >
          ← the full board
        </a>
      </header>

      {grid ? (
        <BingoBoard grid={grid} />
      ) : (
        <p className="mx-auto max-w-md px-5 pb-16 text-center text-[14px] text-cream-dim">
          No argued cases recorded for this term yet. The card fills in as the
          daily refresh pulls argument and opinion data from Oyez.
        </p>
      )}

      <footer className="relative z-10 border-t border-ink-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-3 px-5 py-6 font-mono text-[11px] text-cream-faint">
          <span>
            {grid
              ? `${grid.decidedCount} decided · ${grid.pendingCount} pending`
              : "—"}
          </span>
          {lastRefresh && (
            <span>updated {new Date(lastRefresh).toISOString().slice(0, 10)}</span>
          )}
          <a href="https://www.oyez.org" target="_blank" rel="noreferrer" className="text-cream-dim hover:text-gold-bright">
            data: Oyez
          </a>
        </div>
      </footer>
    </main>
  );
}
