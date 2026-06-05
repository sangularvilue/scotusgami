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

/** How to read a row: column-per-justice, plus the side colors. */
export default function Legend() {
  return (
    <div className="reveal flex flex-wrap items-center gap-x-10 gap-y-4 rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4">
      <div className="max-w-72 text-[11.5px] leading-snug text-cream-faint">
        Each row is one possible Court — one column per justice, most liberal
        (Sotomayor) to most conservative (Thomas), left to right.
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Swatch color="var(--gold)" label="majority" />
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-3.5 rounded-full"
            style={{ background: "var(--slate)" }}
          />
          <span className="smallcaps text-[11px] text-cream-dim">dissent</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] border border-ink-line" />
          <span className="smallcaps text-[11px] text-cream-dim">took no part</span>
        </span>
        <span className="text-[11.5px] text-cream-faint">
          Lit rows have happened · faded rows await their first case
        </span>
      </div>
    </div>
  );
}
