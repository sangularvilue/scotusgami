import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "@/lib/justices";

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-[2px]"
        style={{ background: color }}
      />
      <span className="smallcaps text-[11px] text-cream-dim">{label}</span>
    </span>
  );
}

/** How to read a square: the 3×3 cell-to-justice map plus the side colors. */
export default function Legend() {
  return (
    <div className="reveal flex flex-wrap items-center gap-x-8 gap-y-4 rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-3 gap-[2px]">
          {IDEOLOGICAL_IDS.map((id) => (
            <div
              key={id}
              title={JUSTICE_BY_ID[id].fullName}
              className="flex size-7 items-center justify-center rounded-[3px] border border-ink-line bg-ink font-mono text-[8.5px] text-cream-dim"
            >
              {JUSTICE_BY_ID[id].short}
            </div>
          ))}
        </div>
        <div className="max-w-44 text-[11.5px] leading-snug text-cream-faint">
          Each square is the Court. One cell per justice, liberals toward the
          top-left.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Swatch color="var(--gold)" label="majority" />
        <Swatch color="var(--slate)" label="dissent" />
        <Swatch color="var(--absent)" label="took no part" />
        <span className="ml-1 text-[11.5px] text-cream-faint">
          Vivid squares have happened · ghosts await their first case
        </span>
      </div>
    </div>
  );
}
