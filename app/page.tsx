import Board from "@/components/Board";
import { loadData } from "@/lib/data";
import { enumerateSections } from "@/lib/grid";

export const revalidate = 3600;

export default async function Home() {
  const { cases, meta } = await loadData();

  const byKey: Record<string, number[]> = {};
  cases.forEach((c, i) => {
    (byKey[c.lineupKey] ??= []).push(i);
  });

  const sections = enumerateSections(Object.keys(byKey));

  // first-time lineups, newest first
  const seen = new Set<string>();
  const gamis: number[] = [];
  cases.forEach((c, i) => {
    if (!seen.has(c.lineupKey)) {
      seen.add(c.lineupKey);
      gamis.push(i);
    }
  });
  const recent = gamis.slice(-12).reverse();

  return (
    <main className="relative z-10 flex flex-col">
      <header className="reveal mx-auto w-full max-w-7xl px-5 pb-10 pt-12 text-center">
        <p className="smallcaps text-[13px] text-gold">
          every division of the nine
        </p>
        <h1 className="font-display mt-2 text-6xl font-medium tracking-tight text-cream sm:text-7xl">
          SCOTUS<span className="italic text-gold-bright">gami</span>
        </h1>
        <div className="rule-double mx-auto mt-5 w-56" />
        <p className="mx-auto mt-5 max-w-xl text-[14px] leading-relaxed text-cream-dim">
          A justice may join the majority, dissent, or take no part. Every row
          below is one possible alignment of the Roberts Court since Justice
          Jackson joined — October Term 2022 to today. The lit ones have
          actually happened.
        </p>
      </header>

      <Board
        sections={sections}
        cases={cases}
        byKey={byKey}
        recent={recent}
        lastRefresh={meta?.lastRefresh || null}
      />

      <footer className="relative z-10 border-t border-ink-line">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-baseline justify-between gap-3 px-5 py-6 font-mono text-[11px] text-cream-faint">
          <span>
            data:{" "}
            <a
              href="https://www.oyez.org"
              target="_blank"
              rel="noreferrer"
              className="text-cream-dim hover:text-gold-bright"
            >
              Oyez
            </a>{" "}
            ·{" "}
            <a
              href="https://scdb.la.psu.edu"
              target="_blank"
              rel="noreferrer"
              className="text-cream-dim hover:text-gold-bright"
            >
              Supreme Court Database
            </a>
          </span>
          <span>a Scorigami for the Supreme Court</span>
          <a
            href="https://grannis.xyz"
            className="text-cream-dim hover:text-gold-bright"
          >
            grannis.xyz
          </a>
        </div>
      </footer>
    </main>
  );
}
