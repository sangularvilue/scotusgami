"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CaseCard from "./CaseCard";
import Legend from "./Legend";
import Sidebar from "./Sidebar";
import { glyphStyle } from "@/lib/glyph";
import { splitLabel, type Section, type SplitGroup, type Subsection } from "@/lib/grid";
import { JUSTICE_BY_ID } from "@/lib/justices";
import type { CaseRecord } from "@/lib/types";

export interface BoardProps {
  sections: Section[];
  /** all cases sorted ascending by decided date */
  cases: CaseRecord[];
  /** lineupKey → indices into cases */
  byKey: Record<string, number[]>;
  /** indices of the most recent first-time lineups, newest first */
  recent: number[];
  lastRefresh: string | null;
}

/* ---------------- squares (memoized: never re-render on hover) ---------------- */

const Square = memo(function Square({ k, n }: { k: string; n: number }) {
  return (
    <div
      id={`sq-${k}`}
      data-key={k}
      className={`sq ${n > 0 ? "hit" : "ghost"} ${n > 1 ? "multi" : ""}`}
    >
      <span className="glyph" style={glyphStyle(k)} />
    </div>
  );
});

const GroupRow = memo(function GroupRow({
  group,
  byKey,
}: {
  group: SplitGroup;
  byKey: Record<string, number[]>;
}) {
  const filled = group.keys.filter((k) => byKey[k]?.length).length;
  return (
    <div className="flex items-start gap-4">
      <div className="w-14 shrink-0 pt-1 text-right">
        <div className="font-display text-[15px] text-cream">{group.label}</div>
        <div className="font-mono text-[10px] text-cream-faint">
          {filled}/{group.keys.length}
        </div>
      </div>
      <div className="flex flex-wrap gap-[5px]">
        {group.keys.map((k) => (
          <Square key={k} k={k} n={byKey[k]?.length ?? 0} />
        ))}
      </div>
    </div>
  );
});

const SubsectionView = memo(function SubsectionView({
  sub,
  byKey,
}: {
  sub: Subsection;
  byKey: Record<string, number[]>;
}) {
  const label =
    sub.absentIds.length > 0
      ? sub.absentIds.map((id) => JUSTICE_BY_ID[id].lastName).join(" + ") + " out"
      : null;
  const total = sub.groups.reduce((s, g) => s + g.keys.length, 0);
  const filled = sub.groups.reduce(
    (s, g) => s + g.keys.filter((k) => byKey[k]?.length).length,
    0
  );
  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-baseline gap-2 pt-1">
          <span className="smallcaps text-[12px] text-cream-dim">{label}</span>
          <span className="font-mono text-[10px] text-cream-faint">
            {filled}/{total}
          </span>
          <span className="h-px grow self-center bg-ink-line" />
        </div>
      )}
      {sub.groups.map((g) => (
        <GroupRow key={g.label} group={g} byKey={byKey} />
      ))}
    </div>
  );
});

function sectionFillStats(section: Section, byKey: Record<string, number[]>) {
  let total = 0;
  let filled = 0;
  for (const sub of section.subsections)
    for (const g of sub.groups) {
      total += g.keys.length;
      filled += g.keys.filter((k) => byKey[k]?.length).length;
    }
  return { total, filled };
}

const SectionView = memo(function SectionView({
  section,
  byKey,
  defaultOpen,
}: {
  section: Section;
  byKey: Record<string, number[]>;
  defaultOpen: boolean;
}) {
  const { total, filled } = sectionFillStats(section, byKey);
  const header = (
    <div className="flex items-baseline gap-3">
      <h2 className="font-display text-xl text-cream">{section.title}</h2>
      <span className="font-mono text-[11px] text-gold">
        {filled} <span className="text-cream-faint">of {total} happened</span>
      </span>
    </div>
  );
  const body = (
    <div className="mt-4 space-y-4">
      {section.subsections.map((sub, i) => (
        <SubsectionView key={i} sub={sub} byKey={byKey} />
      ))}
    </div>
  );

  if (defaultOpen)
    return (
      <section className="reveal">
        {header}
        <div className="rule-double mt-2" />
        {body}
      </section>
    );

  return (
    <details className="section-fold reveal">
      <summary>
        <div className="flex items-baseline gap-3">
          <span className="fold-arrow text-gold">▸</span>
          {header}
        </div>
        <div className="rule-double mt-2" />
      </summary>
      {body}
    </details>
  );
});

/* ---------------- tooltip / pin orchestration ---------------- */

const EMPTY: number[] = [];

export default function Board({
  sections,
  cases,
  byKey,
  recent,
  lastRefresh,
}: BoardProps) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  const recordsFor = useCallback(
    (key: string) => (byKey[key] ?? EMPTY).map((i) => cases[i]),
    [byKey, cases]
  );

  const placeCard = (rect: DOMRect) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const W = 340;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - W / 2, 10), vw - W - 10);
    const below = rect.bottom + 12;
    const y = below + 320 < vh ? below : Math.max(10, rect.top - 12 - 320);
    return { x, y };
  };

  const onOver = useCallback((e: React.MouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!t) return;
    const { x, y } = placeCard(t.getBoundingClientRect());
    setHover({ key: t.dataset.key!, x, y });
  }, []);

  const onOut = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-key]")) setHover(null);
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-key]");
    if (!t) return;
    setHover(null);
    setPinned((p) => (p === t.dataset.key ? null : t.dataset.key!));
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPinned(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // reflect pin state on the square itself
  useEffect(() => {
    if (!pinned) return;
    const el = document.getElementById(`sq-${pinned}`);
    el?.classList.add("pinned");
    return () => el?.classList.remove("pinned");
  }, [pinned]);

  const jumpTo = useCallback((key: string) => {
    const el = document.getElementById(`sq-${key}`);
    if (el) {
      // open the enclosing <details> if needed
      let p = el.parentElement;
      while (p) {
        if (p instanceof HTMLDetailsElement) p.open = true;
        p = p.parentElement;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setPinned(key);
  }, []);

  const stats = useMemo(
    () =>
      sections
        .filter((s) => s.k <= 2)
        .map((s) => ({ title: s.title, ...sectionFillStats(s, byKey) })),
    [sections, byKey]
  );

  return (
    <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <Legend />
        <div
          ref={wallRef}
          className="mt-8 space-y-10"
          onMouseOver={onOver}
          onMouseOut={onOut}
          onClick={onClick}
        >
          {sections.map((s) => (
            <SectionView
              key={s.k}
              section={s}
              byKey={byKey}
              defaultOpen={s.k !== 2}
            />
          ))}
        </div>
      </div>

      <Sidebar
        cases={cases}
        byKey={byKey}
        recent={recent}
        stats={stats}
        lastRefresh={lastRefresh}
        onJump={jumpTo}
      />

      {hover && !pinned && (
        <div className="case-card" style={{ left: hover.x, top: hover.y }}>
          <CaseCard
            lineupKey={hover.key}
            records={recordsFor(hover.key)}
            full={false}
          />
        </div>
      )}

      {pinned && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setPinned(null)}
          />
          <div
            className="case-card interactive"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(420px, 92vw)",
            }}
          >
            <CaseCard
              lineupKey={pinned}
              records={recordsFor(pinned)}
              full
              onClose={() => setPinned(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export { splitLabel };
