import type { Metadata } from "next";
import Link from "next/link";
import Game from "@/components/game/Game";
import { loadData } from "@/lib/data";
import { toGameCases } from "@/lib/game";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Immaculate Bench — SCOTUSgami",
  description:
    "The daily Supreme Court grid. Name a case where both justices were on the same side. Unanimous decisions don't count.",
};

export default async function GamePage() {
  const { cases } = await loadData();
  const gameCases = toGameCases(cases);

  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <header className="reveal mx-auto w-full max-w-2xl px-5 pb-8 pt-10 text-center">
        <Link
          href="/"
          className="font-mono text-[11px] text-cream-faint hover:text-gold-bright"
        >
          ← the wall
        </Link>
        <p className="smallcaps mt-4 text-[12px] text-gold">the daily grid</p>
        <h1 className="font-display mt-1 text-4xl font-medium tracking-tight text-cream sm:text-5xl">
          Immaculate <span className="italic text-gold-bright">Bench</span>
        </h1>
        <div className="rule-double mx-auto mt-4 w-40" />
      </header>

      <Game cases={gameCases} />

      <footer className="mt-auto border-t border-ink-line">
        <div className="mx-auto flex w-full max-w-2xl items-baseline justify-between px-5 py-5 font-mono text-[11px] text-cream-faint">
          <span>a new bench every day</span>
          <Link href="/" className="text-cream-dim hover:text-gold-bright">
            scotusgami
          </Link>
        </div>
      </footer>
    </main>
  );
}
