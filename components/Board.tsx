"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import CaseCard from "./CaseCard";
import Legend from "./Legend";
import Sidebar from "./Sidebar";
import Strip from "./Strip";
import { decodeLineup, type Section, type SplitGroup } from "@/lib/grid";
import { IDEOLOGICAL_IDS, JUSTICE_BY_ID } from "@/lib/justices";
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

/* ---------------- rows & panes (memoized: never re-render on hover) ---------------- */

const Row = memo(function Row({ k, n }: { k: string; n: number }) {
  return (
    <div
      id={`sq-${k}`}
      data-key={k}
      className={`vrow ${n > 0 ? "hit" : "ghost"} ${n > 1 ? "multi" : ""}`}
    >
      <Strip k={k} />
    </div>
  );
});

interface Pane {
  /** missing justices this pane covers, e.g. "Jackson out" (k≥1 blocks) */
  label: string | null;
  /** which columns are absent throughout this pane */
  outCols: Set<number>;
  keys: string[];
}

const PaneView = memo(function PaneView({
  pane,
  byKey,
}: {
  pane: Pane;
  byKey: Record<string, number[]>;
}) {
  return (
    <div>
      {pane.label && (
        <div className="smallcaps mb-0.5 pl-[3px] text-[10px] text-cream-faint">
          {pane.label}
        </div>
      )}
      <div className="pane-ticks">
        {IDEOLOGICAL_IDS.map((id, col) => (
          <span
            key={id}
            title={JUSTICE_BY_ID[id].fullName}
            className={pane.outCols.has(col) ? "out" : ""}
          >
            {JUSTICE_BY_ID[id].lastName}
          </span>
        ))}
      </div>
      <div className="mt-0.5 space-y-px">
        {pane.keys.map((k) => (
          <Row key={k} k={k} n={byKey[k]?.length ?? 0} />
        ))}
      </div>
    </div>
  );
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const choose = (n: number, r: number): number => {
  if (r < 0 || r > n) return 0;
  let v = 1;
  for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
};

function outColsOf(key: string): Set<number> {
  const votes = decodeLineup(key);
  const out = new Set<number>();
  IDEOLOGICAL_IDS.forEach((id, col) => {
    if (votes[id] === "A") out.add(col);
  });
  return out;
}

function outLabel(key: string): string {
  const votes = decodeLineup(key);
  const names = IDEOLOGICAL_IDS.filter((id) => votes[id] === "A").map(
    (id) => JUSTICE_BY_ID[id].lastName
  );
  return names.join(" + ") + " out";
}

/**
 * Split a group's rows into vertical panes. Rows arrive ordered by absent set
 * then dissent set, so for k≥1 each absent set is a contiguous block — give
 * each its own labeled pane. Full-bench (and d=0) groups just chunk.
 */
function buildPanes(section: Section, group: SplitGroup): Pane[] {
  const blockSize =
    section.k >= 1 && section.k <= 2 && group.disSize > 0
      ? choose(9 - section.k, group.disSize)
      : 0;
  if (blockSize >= 4 && group.keys.length % blockSize === 0) {
    return chunk(group.keys, blockSize).map((keys) => ({
      label: outLabel(keys[0]),
      outCols: outColsOf(keys[0]),
      keys,
    }));
  }
  return chunk(group.keys, 42).map((keys) => ({
    label: null,
    outCols: section.k === 0 ? new Set<number>() : outColsOf(keys[0]),
    keys,
  }));
}

const GroupView = memo(function GroupView({
  section,
  group,
  byKey,
}: {
  section: Section;
  group: SplitGroup;
  byKey: Record<string, number[]>;
}) {
  const filled = group.keys.filter((k) => byKey[k]?.length).length;
  const pct = (100 * filled) / group.keys.length;
  const pctLabel =
    filled === 0 ? "0%" : pct < 1 ? "<1%" : `${Math.round(pct)}%`;
  const panes = useMemo(() => buildPanes(section, group), [section, group]);
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-lg text-cream">{group.label}</span>
        <span className="font-mono text-[10.5px] text-cream-faint">
          {filled}/{group.keys.length}
        </span>
        <span
          className={`font-mono text-[10.5px] ${filled > 0 ? "text-gold" : "text-cream-faint"}`}
        >
          {pctLabel} seen
        </span>
        <span className="h-px grow self-center bg-ink-line" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-7 gap-y-5">
        {panes.map((p, i) => (
          <PaneView key={i} pane={p} byKey={byKey} />
        ))}
      </div>
    </div>
  );
});

function sectionFillStats(section: Section, byKey: Record<string, number[]>) {
  let total = 0;
  let filled = 0;
  for (const g of section.groups) {
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
    <div className="mt-4 space-y-7">
      {section.groups.map((g) => (
        <GroupView key={g.label} section={section} group={g} byKey={byKey} />
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

  const recordsFor = useCallback(
    (key: string) => (byKey[key] ?? EMPTY).map((i) => cases[i]),
    [byKey, cases]
  );

  const placeCard = (rect: DOMRect) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const W = 340;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - W / 2, 10), vw - W - 10);
    const below = rect.bottom + 10;
    const y = below + 320 < vh ? below : Math.max(10, rect.top - 10 - 320);
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

  // reflect pin state on the row itself
  useEffect(() => {
    if (!pinned) return;
    const el = document.getElementById(`sq-${pinned}`);
    el?.classList.add("pinned");
    return () => el?.classList.remove("pinned");
  }, [pinned]);

  const jumpTo = useCallback((key: string) => {
    const el = document.getElementById(`sq-${key}`);
    if (el) {
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
