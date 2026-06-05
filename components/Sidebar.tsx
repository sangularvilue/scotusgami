"use client";

import { memo } from "react";
import Strip from "./Strip";
import { fmtDate } from "@/lib/format";
import { splitLabel } from "@/lib/grid";
import { stripWidth } from "@/lib/strip";
import type { CaseRecord } from "@/lib/types";

interface Stat {
  title: string;
  filled: number;
  total: number;
}

const MiniStrip = memo(function MiniStrip({ k }: { k: string }) {
  return (
    <span
      className="block shrink-0 rounded-[3px] border border-ink-line bg-ink px-[3px] py-[3px] leading-[0]"
      style={{ width: stripWidth(22, 1) + 8 }}
    >
      <Strip k={k} cellW={22} cellH={10} gap={1} />
    </span>
  );
});

export default function Sidebar({
  cases,
  byKey,
  recent,
  stats,
  lastRefresh,
  onJump,
}: {
  cases: CaseRecord[];
  byKey: Record<string, number[]>;
  recent: number[];
  stats: Stat[];
  lastRefresh: string | null;
  onJump: (key: string) => void;
}) {
  const distinct = Object.keys(byKey).length;
  return (
    <aside className="reveal lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
      <div className="rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4">
        <h2 className="smallcaps text-[12px] text-gold">The ledger</h2>
        <dl className="mt-3 space-y-2.5">
          {stats.map((s) => (
            <div key={s.title}>
              <div className="flex items-baseline justify-between">
                <dt className="text-[12px] text-cream-dim">{s.title}</dt>
                <dd className="font-mono text-[11px] text-cream">
                  {s.filled}
                  <span className="text-cream-faint">/{s.total}</span>
                </dd>
              </div>
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-ink">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${(100 * s.filled) / s.total}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-3 border-t border-ink-line pt-2.5 font-mono text-[10.5px] leading-relaxed text-cream-faint">
          {cases.length} cases · {distinct} distinct lineups
          {lastRefresh && (
            <>
              <br />
              refreshed {fmtDate(lastRefresh.slice(0, 10))}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4">
        <h2 className="smallcaps text-[12px] text-gold">Recent SCOTUSgamis</h2>
        <p className="mt-1 text-[11px] leading-snug text-cream-faint">
          Lineups occurring for the first time.
        </p>
        <ul className="mt-3 space-y-3">
          {recent.map((i) => {
            const c = cases[i];
            return (
              <li key={`${c.term}-${c.docket}`}>
                <button
                  onClick={() => onJump(c.lineupKey)}
                  className="group flex w-full cursor-pointer flex-col gap-1.5 text-left"
                >
                  <MiniStrip k={c.lineupKey} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[13px] italic leading-tight text-cream group-hover:text-gold-bright">
                      {c.name}
                    </span>
                    <span className="font-mono text-[10px] text-cream-faint">
                      {splitLabel(c.lineupKey)} · {fmtDate(c.decided)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
