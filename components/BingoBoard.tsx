import type { BingoCaseLite, BingoGrid } from "@/lib/bingo";
import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "@/lib/justices";

// Fixed track widths so the still-out / granted cards can stack outward to the
// right of the nine-justice grid and the whole board scrolls horizontally.
const LABEL_W = 96;
const CELL_W = 82;
const COLS = { gridTemplateColumns: `${LABEL_W}px repeat(9, ${CELL_W}px)` };
const GRID_W = LABEL_W + 9 * CELL_W + 9 * 4; // + gap-1 between 10 tracks

// rubric red — flags a justice who took two opinions from one sitting (a
// classic sign of a flipped majority or a colleague running behind).
const DOUBLE = "#c0564b";

const caseTitle = (c: BingoCaseLite) =>
  `${c.name}${
    c.consolidatedWith?.length
      ? ` (consolidated with ${c.consolidatedWith.join(", ")})`
      : ""
  }${c.decided ? ` — decided ${c.decided}` : ""}`;

/** A justice's cell within a sitting: opinion(s) authored, owed, or empty. */
function JusticeCell({
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
            title={caseTitle(c)}
            className="block truncate text-[10px] leading-tight text-gold-bright hover:underline"
          >
            {c.name}
            {c.consolidatedWith?.length ? (
              <span className="text-gold/60"> +{c.consolidatedWith.length}</span>
            ) : null}
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

/**
 * An unattributed case card — a still-out (argued, undecided) case or a
 * granted-but-uncalendared one. Same shape as a written-opinion tile, dashed to
 * read as "not yet placed"; when it comes down it moves into its author's cell.
 */
function SideCard({ c }: { c: BingoCaseLite }) {
  return (
    <a
      href={c.oyezUrl}
      target="_blank"
      rel="noreferrer"
      title={caseTitle(c)}
      style={{ width: CELL_W + 18 }}
      className="flex shrink-0 items-center rounded border border-dashed border-gold/40 bg-gold/[0.07] px-1.5 py-1 text-[10px] leading-tight text-gold transition-colors hover:border-gold/70 hover:bg-gold/15 hover:text-gold-bright"
    >
      <span className="line-clamp-2">
        {c.name}
        {c.consolidatedWith?.length ? (
          <span className="text-gold/60"> +{c.consolidatedWith.length}</span>
        ) : null}
      </span>
    </a>
  );
}

/** A board row: the fixed label + 9-justice grid, then cards stacking right. */
function Row({
  label,
  sub,
  authoredBy,
  owed,
  cards,
}: {
  label: string;
  sub?: string;
  authoredBy?: Record<string, BingoCaseLite[]>;
  owed?: string[];
  cards: BingoCaseLite[];
}) {
  return (
    <div className="flex items-stretch gap-1">
      <div className="grid shrink-0 items-stretch gap-1" style={{ ...COLS, width: GRID_W }}>
        <div className="flex flex-col justify-center">
          <span className="font-display text-[15px] text-cream">{label}</span>
          {sub && (
            <span className="font-mono text-[10px] text-cream-faint">{sub}</span>
          )}
        </div>
        {IDEOLOGICAL_IDS.map((id) => (
          <JusticeCell
            key={id}
            authored={authoredBy?.[id]}
            owed={!!owed?.includes(id)}
          />
        ))}
      </div>
      {cards.length > 0 && (
        <div className="flex items-stretch gap-1 pl-1">
          {cards.map((c) => (
            <SideCard key={c.docket} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BingoBoard({
  grid,
  showLegend = false,
}: {
  grid: BingoGrid;
  showLegend?: boolean;
}) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-5">
      {showLegend && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-cream-dim">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-gold/50 bg-gold/15" />
            wrote the opinion
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-gold/40 bg-gold/[0.07]" />
            still out — author unknown
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-slate-dissent/45 bg-slate-dissent/5" />
            owed — candidate to be holding it
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-5 rounded-sm border border-gold/50 bg-gold/15"
              style={{ outline: `1.5px solid ${DOUBLE}`, outlineOffset: "1px" }}
            />
            two from one sitting
          </span>
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="w-max min-w-full">
          {/* justice column headers + term tallies */}
          <div
            className="sticky top-0 z-10 grid gap-1 border-b border-ink-line bg-ink/85 py-2 backdrop-blur"
            style={{ ...COLS, width: GRID_W }}
          >
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

          {/* one row per sitting, with still-out cases stacking to the right */}
          <div className="mt-1 space-y-1.5">
            {grid.sittings.map((s) => (
              <Row
                key={s.sitting}
                label={s.sitting}
                sub={`${s.authored.length} writ${
                  s.pending.length > 0 ? ` · ${s.pending.length} out` : ""
                }`}
                authoredBy={s.byAuthor}
                owed={s.owed}
                cards={s.pending}
              />
            ))}

            {/* granted-but-uncalendared cases (an upcoming term before its
                argument calendar drops) — no sitting yet, so they stack to the
                right of an empty grid until a date slots them in. */}
            {grid.granted.length > 0 && (
              <Row
                label="Granted"
                sub={`${grid.granted.length} awaiting`}
                cards={grid.granted}
              />
            )}
          </div>

          {grid.sittings.length === 0 && grid.granted.length === 0 && (
            <p className="py-6 text-[13px] text-cream-dim">
              No argued or granted cases recorded for this term yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
