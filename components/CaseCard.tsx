import { splitLabel } from "@/lib/grid";
import { fmtDate, lineupSides, opinionLines } from "@/lib/format";
import type { CaseRecord } from "@/lib/types";

function SideRow({
  dot,
  label,
  names,
}: {
  dot: string;
  label: string;
  names: string;
}) {
  if (!names) return null;
  return (
    <div className="flex items-baseline gap-2 text-[12.5px] leading-snug">
      <span
        className="mt-[1px] inline-block size-2 shrink-0 self-center rounded-[2px]"
        style={{ background: dot }}
      />
      <span className="smallcaps shrink-0 text-[10.5px] text-cream-faint">{label}</span>
      <span className="text-cream-dim">{names}</span>
    </div>
  );
}

function CaseBlock({
  c,
  tag,
  full,
}: {
  c: CaseRecord;
  tag: string | null;
  full: boolean;
}) {
  return (
    <div className="border-t border-ink-line px-4 py-3">
      {tag && (
        <div className="smallcaps mb-1 text-[10.5px] text-gold">{tag}</div>
      )}
      <div className="font-display text-[15px] italic leading-tight text-cream">
        {c.name}
      </div>
      <div className="mt-1 font-mono text-[10.5px] tracking-wide text-cream-faint">
        No. {c.docket} · decided {fmtDate(c.decided)}
        {c.source === "scdb" && " · votes via SCDB"}
      </div>
      {full && c.question && (
        <p className="mt-2 text-[12px] leading-relaxed text-cream-dim">
          <span className="smallcaps text-[10.5px] text-cream-faint">Question · </span>
          {c.question}
        </p>
      )}
      {c.holding && (
        <p
          className={`mt-2 text-[12px] leading-relaxed text-cream-dim ${full ? "" : "line-clamp-3"}`}
        >
          {c.holding}
        </p>
      )}
      <div className="mt-2 space-y-0.5">
        {opinionLines(c).map((l) => (
          <div key={l.label} className="text-[11.5px] leading-snug">
            <span className="smallcaps text-[10.5px] text-cream-faint">
              {l.label} ·{" "}
            </span>
            <span className="text-cream-dim">{l.text}</span>
          </div>
        ))}
      </div>
      {full && (
        <a
          href={c.oyezUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-[10.5px] text-gold hover:text-gold-bright"
        >
          read on Oyez ↗
        </a>
      )}
    </div>
  );
}

export default function CaseCard({
  lineupKey,
  records,
  full,
  onClose,
}: {
  lineupKey: string;
  records: CaseRecord[];
  /** pinned mode: full text, links, all cases */
  full: boolean;
  onClose?: () => void;
}) {
  const sides = lineupSides(lineupKey);
  const first = records[0];
  const latest = records[records.length - 1];
  const names = (js: typeof sides.maj) => js.map((j) => j.lastName).join(" · ");

  return (
    <div>
      <div className="flex items-start justify-between px-4 pt-3">
        <div>
          <span className="font-display text-2xl text-gold-bright">
            {splitLabel(lineupKey)}
          </span>
          <span className="smallcaps ml-3 text-[11px] text-cream-faint">
            {records.length === 0
              ? "never happened"
              : records.length === 1
                ? "one case"
                : `${records.length} cases`}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 cursor-pointer rounded px-2 py-1 text-cream-faint hover:text-cream"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-1 px-4 pb-3 pt-2">
        <SideRow dot="var(--gold)" label="majority" names={names(sides.maj)} />
        <SideRow dot="var(--slate)" label="dissent" names={names(sides.dis)} />
        <SideRow dot="var(--absent)" label="out" names={names(sides.out)} />
      </div>

      {records.length === 0 && (
        <div className="border-t border-ink-line px-4 py-3 text-[12px] italic leading-relaxed text-cream-faint">
          This alignment of the Court has never produced a decision. Awaiting
          its first case.
        </div>
      )}

      {records.length === 1 && <CaseBlock c={first} tag={null} full={full} />}

      {records.length >= 2 && (
        <>
          <CaseBlock c={first} tag="first" full={full} />
          <CaseBlock c={latest} tag="most recent" full={full} />
        </>
      )}

      {full && records.length > 2 && (
        <div className="border-t border-ink-line px-4 py-3">
          <div className="smallcaps mb-1.5 text-[10.5px] text-cream-faint">
            all {records.length} cases
          </div>
          <ul className="space-y-1">
            {[...records].reverse().map((c) => (
              <li key={`${c.term}-${c.docket}`} className="text-[12px] leading-snug">
                <a
                  href={c.oyezUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cream-dim hover:text-gold-bright"
                >
                  {c.name}
                </a>
                <span className="font-mono text-[10px] text-cream-faint">
                  {" "}
                  · {fmtDate(c.decided)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!full && (
        <div className="border-t border-ink-line px-4 py-2 font-mono text-[10px] text-cream-faint">
          click to pin{records.length > 0 ? " · links · full text" : ""}
        </div>
      )}
    </div>
  );
}
