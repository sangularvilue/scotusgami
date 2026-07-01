import type { Metadata } from "next";
import StatsView from "@/components/stats/StatsView";
import { loadData } from "@/lib/data";
import { computeAllStats } from "@/lib/scotus-stats";

// Recompute as new opinions land (the daily cron refreshes the case data).
export const revalidate = 600;

export const metadata: Metadata = {
  title: "SCOTUSgami · Stats",
  description:
    "Principal-component analysis of the current bench's voting: ideological axes, maverick justices, party-line vs ideological splits, and the least-expected lineups.",
};

export default async function StatsPage() {
  const { cases } = await loadData();
  const stats = computeAllStats(cases);

  return (
    <main className="relative z-10 flex flex-col">
      <header className="reveal mx-auto w-full max-w-5xl px-5 pb-8 pt-12 text-center">
        <p className="smallcaps text-[13px] text-gold">the shape of the vote</p>
        <h1 className="font-display mt-2 text-5xl font-medium tracking-tight text-cream sm:text-6xl">
          SCOTUS<span className="italic text-gold-bright">stats</span>
        </h1>
        <div className="rule-double mx-auto mt-5 w-56" />
        <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-cream-dim">
          Each case is scored per justice: <span className="text-gold">+1</span> in the majority or a concurrence,{" "}
          <span className="text-slate-dissent">−1</span> in dissent, <span className="text-cream-faint">0</span> for no
          part or a concur-in-part/dissent-in-part. With justices as variables and cases as observations, a plain
          covariance <span className="text-cream">PCA</span> (no scaling, no regularization) recovers the Court&apos;s
          voting axes.
        </p>
        <a
          href="/"
          className="mt-5 inline-block rounded border border-gold/60 px-4 py-1.5 font-mono text-[12px] text-gold transition-colors hover:bg-gold/10"
        >
          ← the full board
        </a>
      </header>

      {stats.overall ? (
        <StatsView stats={stats} />
      ) : (
        <p className="mx-auto max-w-md px-5 pb-16 text-center text-[14px] text-cream-dim">
          Not enough decided cases yet to run the analysis.
        </p>
      )}

      <footer className="relative z-10 mt-12 border-t border-ink-line">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 font-mono text-[11px] leading-relaxed text-cream-faint">
          <p>
            PC1 is oriented so conservative loads positive. &ldquo;Maverick&rdquo; = the justice whose loading sits
            least on PC1 (least explained by the dominant ideological axis). &ldquo;Any ideological line&rdquo; = a
            single cut in the PC1 ordering separates the two sides of a divided case. &ldquo;Most unexpected&rdquo; =
            the lineup with the largest Mahalanobis distance in PC space (least likely under a Gaussian PC model).
          </p>
        </div>
      </footer>
    </main>
  );
}
