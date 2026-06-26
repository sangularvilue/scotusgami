import type { BingoCaseLite, BingoGrid } from "@/lib/bingo";
import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "@/lib/justices";

const COLS = { gridTemplateColumns: "108px repeat(9, minmax(0, 1fr))" };

// rubric red — flags a justice who took two opinions from one sitting (a
// classic sign of a flipped majority or a colleague running behind).
const DOUBLE = "#c0564b";

function Cell({
  authored,
  owed,
}: {
  authored: BingoCaseLite[] | undefined;
  owed: boolean;
}) {
  if (authored?.length) {
    const double = authored.length > 1;
    return (
      <div
        className="relative flex flex-col justify-center gap-0.5 rounded border border-gold/50 bg-gold/15 px-1.5 py-1"
        style={
          double
            ? { outline: `1.5px solid ${DOUBLE}`, outlineOffset: "2px" }
            : undefined
        }
      >
        {double && (
          <span
            title="two opinions from one sitting"
            className="absolute -right-1.5 -top-2 rounded-sm px-1 text-[8px] font-bold leading-[1.5] text-cream"
            style={{ background: DOUBLE }}
          >
            ×2
          </span>
        )}
        {authored.map((c) => (
          <a
            key={c.docket}
            href={c.oyezUrl}
            target="_blank"
            rel="noreferrer"
            title={`${c.name}${c.decided ? ` — decided ${c.decided}` : ""}`}
            className="block truncate text-[10px] leading-tight text-gold-bright hover:underline"
          >
            {c.name}
          </a>
        ))}
      </div>
    );
  }
  if (owed) {
    return (
      <div
        title="no opinion yet from this sitting — a candidate to be holding a pending case"
        className="flex items-center justify-center rounded border border-dashed border-slate-dissent/45 bg-slate-dissent/5 px-1 py-1"
      >
        <span className="smallcaps text-[9px] text-slate-dissent/80">owed</span>
      </div>
    );
  }
  return <div className="rounded border border-ink-line/50" />;
}

export default function BingoBoard({ grid }: { grid: BingoGrid }) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-16">
      <div className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-cream-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-gold/50 bg-gold/15" />
          wrote the opinion
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-slate-dissent/45 bg-slate-dissent/5" />
          owed — candidate for a case still out
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-gold/50 bg-gold/15"
            style={{ outline: `1.5px solid ${DOUBLE}`, outlineOffset: "1px" }}
          />
          two from one sitting
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* justice column headers + term tallies */}
          <div className="sticky top-0 z-10 grid gap-1 border-b border-ink-line bg-ink/85 py-2 backdrop-blur" style={COLS}>
            <div className="smallcaps self-end pb-0.5 text-[10px] text-cream-faint">
              sitting
            </div>
            {IDEOLOGICAL_IDS.map((id) => {
              const j = JUSTICE_BY_ID[id];
              const n = grid.perJustice[id] ?? 0;
              return (
                <div key={id} className="text-center" title={j.fullName}>
                  <div className="text-[11px] font-semibold text-cream-dim">
                    {j.lastName}
                  </div>
                  <div className="font-mono text-[10px] text-gold">{n}</div>
                </div>
              );
            })}
          </div>

          {/* one block per sitting */}
          <div className="mt-1 space-y-1.5">
            {grid.sittings.map((s) => (
              <div key={s.sitting}>
                <div className="grid items-stretch gap-1" style={COLS}>
                  <div className="flex flex-col justify-center">
                    <span className="font-display text-[15px] text-cream">
                      {s.sitting}
                    </span>
                    <span className="font-mono text-[10px] text-cream-faint">
                      {s.authored.length} writ
                      {s.pending.length > 0 && ` · ${s.pending.length} out`}
                    </span>
                  </div>
                  {IDEOLOGICAL_IDS.map((id) => (
                    <Cell
                      key={id}
                      authored={s.byAuthor[id]}
                      owed={s.owed.includes(id)}
                    />
                  ))}
                </div>

                {s.pending.length > 0 && (
                  <div className="mt-1 ml-[112px] flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-snug">
                    <span className="smallcaps text-[9px] text-slate-dissent/80">
                      still out
                    </span>
                    {s.pending.map((c, i) => (
                      <span key={c.docket}>
                        <a
                          href={c.oyezUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cream-dim hover:text-gold-bright"
                        >
                          {c.name}
                        </a>
                        {i < s.pending.length - 1 && (
                          <span className="text-cream-faint"> ·</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
