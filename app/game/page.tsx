import type { Metadata } from "next";
import Link from "next/link";
import Game from "@/components/game/Game";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Immaculate Bench — SCOTUSgami",
  description:
    "The daily Supreme Court grid. Name a case that fits both clues — a justice in the majority, a topic, an author, an era. 1946 to today.",
};

export default function GamePage() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <header className="reveal mx-auto w-full max-w-3xl px-5 pb-6 pt-10 text-center">
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
        <p className="smallcaps mt-3 text-[11px] text-cream-faint">
          every U.S. Supreme Court decision · 1946 to today
        </p>
      </header>

      <Game />

      <footer className="mt-auto border-t border-ink-line">
        <div className="mx-auto flex w-full max-w-3xl items-baseline justify-between px-5 py-5 font-mono text-[11px] text-cream-faint">
          <span>a new bench every day</span>
          <Link href="/" className="text-cream-dim hover:text-gold-bright">
            scotusgami
          </Link>
        </div>
      </footer>
    </main>
  );
}
