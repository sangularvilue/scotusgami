"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

/* ---- shapes mirrored from the API ---- */
interface ClientHeader {
  kind: "justice" | "category";
  id: string;
  label: string;
}
interface ClientPuzzle {
  date: string;
  rows: ClientHeader[];
  cols: ClientHeader[];
}
interface GuessResult {
  ok: boolean;
  caseId: string;
  name: string;
  term: number;
  split: string;
  points: number;
}
interface SearchHit {
  id: string;
  name: string;
  term: number;
}
interface RevealAnswer {
  id: string;
  name: string;
  term: number;
  split: string;
  points: number;
}

const GUESSES = 9;

interface CellFill {
  caseId: string;
  name: string;
  term: number;
  split: string;
  points: number;
}
interface Saved {
  cells: (CellFill | null)[];
  guessesUsed: number;
}

const gameKey = (d: string) => `ibench:v2:${d}`;
const STATS_KEY = "ibench:v2:stats";

function load<T>(k: string): T | null {
  try {
    const r = localStorage.getItem(k);
    return r ? (JSON.parse(r) as T) : null;
  } catch {
    return null;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Game() {
  const [date, setDate] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<ClientPuzzle | null>(null);
  const [cells, setCells] = useState<(CellFill | null)[]>(Array(9).fill(null));
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState<{ cell: number; ok: boolean } | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [revealData, setRevealData] = useState<RevealAnswer[][] | null>(null);
  const [revealCell, setRevealCell] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const statsRecorded = useRef(false);

  // init: local date + saved state + fetch puzzle
  useEffect(() => {
    const d = localDate();
    setDate(d);
    const saved = load<Saved>(gameKey(d));
    if (saved) {
      setCells(saved.cells);
      setGuessesUsed(saved.guessesUsed);
    }
    fetch(`/api/game/today?date=${d}`)
      .then((r) => r.json())
      .then((p: ClientPuzzle) => setPuzzle(p))
      .catch(() => {});
  }, []);

  const filled = cells.filter(Boolean).length;
  const score = cells.reduce((s, c) => s + (c?.points ?? 0), 0);
  const over = guessesUsed >= GUESSES || filled === 9;
  const immaculate = filled === 9;
  const usedIds = new Set(cells.filter(Boolean).map((c) => c!.caseId));

  // record stats once at game over
  useEffect(() => {
    if (!date || !over || statsRecorded.current) return;
    statsRecorded.current = true;
    interface Stats {
      played: number;
      immaculate: number;
      bestScore: number;
      streak: number;
      lastPlayed: string;
    }
    const s = load<Stats>(STATS_KEY) ?? {
      played: 0,
      immaculate: 0,
      bestScore: 0,
      streak: 0,
      lastPlayed: "",
    };
    if (s.lastPlayed === date) return;
    const y = new Date(Date.now() - 86400000);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    save(STATS_KEY, {
      played: s.played + 1,
      immaculate: s.immaculate + (filled === 9 ? 1 : 0),
      bestScore: Math.max(s.bestScore, score),
      streak: s.lastPlayed === yStr ? s.streak + 1 : 1,
      lastPlayed: date,
    });
  }, [over, date, filled, score]);

  // fetch reveal at game over
  useEffect(() => {
    if (over && date && !revealData) {
      fetch(`/api/game/reveal?date=${date}`)
        .then((r) => r.json())
        .then((d: RevealAnswer[][]) => setRevealData(d))
        .catch(() => {});
    }
  }, [over, date, revealData]);

  // debounced search
  useEffect(() => {
    if (active === null || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/game/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((h: SearchHit[]) => setHits(h.filter((x) => !usedIds.has(x.id))))
        .catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, active]);

  if (!date || !puzzle) {
    return (
      <div className="py-24 text-center font-mono text-[12px] text-cream-faint">
        drawing today&apos;s bench…
      </div>
    );
  }

  const persist = (next: (CellFill | null)[], g: number) =>
    save(gameKey(date), { cells: next, guessesUsed: g });

  const submit = async (cell: number, hit: SearchHit) => {
    if (pending) return;
    setPending(true);
    try {
      const res: GuessResult = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, cell, caseId: hit.id }),
      }).then((r) => r.json());
      const nextGuesses = guessesUsed + 1;
      let next = cells;
      if (res.ok) {
        next = cells.map((v, i) =>
          i === cell
            ? {
                caseId: res.caseId,
                name: res.name,
                term: res.term,
                split: res.split,
                points: res.points,
              }
            : v
        );
        setCells(next);
      }
      setGuessesUsed(nextGuesses);
      persist(next, nextGuesses);
      setFlash({ cell, ok: res.ok });
      setTimeout(() => setFlash(null), 650);
      setActive(null);
      setQuery("");
      setHits([]);
    } finally {
      setPending(false);
    }
  };

  const colOf = (i: number) => puzzle.cols[i % 3];
  const rowOf = (i: number) => puzzle.rows[Math.floor(i / 3)];

  const shareText = () => {
    const grid = [0, 1, 2]
      .map((r) => [0, 1, 2].map((c) => (cells[r * 3 + c] ? "🟦" : "⬛")).join(""))
      .join("\n");
    return `Immaculate Bench ${date}\n${filled}/9 · ${score} pts${immaculate ? " — IMMACULATE" : ""}\n${grid}\nscotusgami.grannis.xyz/game`;
  };

  const HeaderCell = ({ h }: { h: ClientHeader }) => (
    <div className="flex min-h-[3.2rem] items-center justify-center px-1 text-center">
      <span
        className={`text-[12px] leading-tight ${h.kind === "justice" ? "font-display text-[15px] italic text-cream" : "font-sans font-medium text-cream-dim"}`}
      >
        {h.label}
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] text-cream-faint">
          {date}
          <button
            onClick={() => setShowRules(true)}
            aria-label="Rules and scoring"
            className="flex size-[18px] cursor-pointer items-center justify-center rounded-full border border-ink-line font-display text-[11px] italic text-cream-dim hover:border-gold hover:text-gold"
          >
            i
          </button>
        </span>
        <span className="font-mono text-[12px]">
          <span className="text-gold-bright">{score}</span>{" "}
          <span className="text-cream-faint">pts ·</span>{" "}
          <span className={over ? "text-cream-faint" : "text-gold"}>
            {GUESSES - guessesUsed}
          </span>{" "}
          <span className="text-cream-faint">left</span>
        </span>
      </div>

      <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-1.5">
        <div />
        {puzzle.cols.map((h) => (
          <HeaderCell key={h.id} h={h} />
        ))}
        {[0, 1, 2].map((r) => (
          <Fragment key={r}>
            <div className="flex items-center pr-1">
              <HeaderCell h={puzzle.rows[r]} />
            </div>
            {[0, 1, 2].map((c) => {
              const i = r * 3 + c;
              const fill = cells[i];
              const flashing = flash?.cell === i;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (over) {
                      if (!fill) setRevealCell(i);
                    } else if (!fill) {
                      setActive(i);
                      setQuery("");
                      setHits([]);
                      setTimeout(() => inputRef.current?.focus(), 30);
                    }
                  }}
                  className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border p-1.5 text-center transition-colors ${
                    fill
                      ? "border-gold/60 bg-[#182030]"
                      : "border-ink-line bg-ink-raised/60 hover:border-cream-faint"
                  } ${flashing ? (flash!.ok ? "outline outline-2 outline-gold" : "outline outline-2 outline-red-400/70") : ""}`}
                >
                  {fill ? (
                    <>
                      <span className="line-clamp-4 font-display text-[11px] italic leading-tight text-cream">
                        {fill.name}
                      </span>
                      <span className="mt-1 font-mono text-[9px] text-cream-faint">
                        {fill.split} · OT{fill.term}
                      </span>
                      <span className="mt-0.5 font-mono text-[9px] text-gold/80">
                        +{fill.points}
                      </span>
                    </>
                  ) : over ? (
                    <span className="font-mono text-[10px] text-gold/70 underline decoration-dotted">
                      reveal
                    </span>
                  ) : (
                    <span className="font-display text-2xl text-cream-faint">+</span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-cream-faint">
        Name a case that fits both clues.{" "}
        <button
          onClick={() => setShowRules(true)}
          className="cursor-pointer text-gold/80 underline decoration-dotted hover:text-gold-bright"
        >
          rules &amp; scoring
        </button>
      </p>

      {over && (
        <div className="mt-6 rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4 text-center">
          <div className="font-display text-xl text-cream">
            {immaculate ? "Immaculate." : `${filled} of 9`}
            <span className="ml-3 text-gold-bright">{score} pts</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareText()).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-3 cursor-pointer rounded border border-gold/60 px-4 py-1.5 font-mono text-[11px] text-gold hover:bg-gold/10"
          >
            {copied ? "copied" : "share"}
          </button>
        </div>
      )}

      {/* guess modal */}
      {active !== null && !over && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setActive(null)} />
          <div className="fixed left-1/2 top-[16%] z-50 w-[min(460px,93vw)] -translate-x-1/2 rounded-md border border-ink-line border-t-2 border-t-gold bg-[#141a24] p-4 shadow-2xl">
            <div className="mb-2 text-[13px] text-cream">
              <span className="text-cream-dim">{rowOf(active).label}</span>
              <span className="mx-2 text-gold">×</span>
              <span className="text-cream-dim">{colOf(active).label}</span>
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
                if (e.key === "Enter" && hits.length === 1) submit(active, hits[0]);
              }}
              placeholder="search every case, 1946–today…"
              className="w-full rounded border border-ink-line bg-ink px-3 py-2 text-[13px] text-cream outline-none placeholder:text-cream-faint focus:border-gold/60"
            />
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    disabled={pending}
                    onClick={() => submit(active, h)}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-[12.5px] text-cream-dim hover:bg-ink hover:text-cream disabled:opacity-50"
                  >
                    {h.name}
                    <span className="font-mono text-[10px] text-cream-faint"> · OT{h.term}</span>
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && hits.length === 0 && (
                <li className="px-2 py-1.5 text-[12px] text-cream-faint">no cases match</li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* reveal modal */}
      {revealCell !== null && revealData && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setRevealCell(null)} />
          <div className="fixed left-1/2 top-[14%] z-50 w-[min(460px,93vw)] -translate-x-1/2 rounded-md border border-ink-line border-t-2 border-t-gold bg-[#141a24] p-4 shadow-2xl">
            <div className="mb-2 text-[13px] text-cream">
              <span className="text-cream-dim">{rowOf(revealCell).label}</span>
              <span className="mx-2 text-gold">×</span>
              <span className="text-cream-dim">{colOf(revealCell).label}</span>
            </div>
            <div className="mb-2 font-mono text-[10px] text-cream-faint">
              {revealData[revealCell].length} notable answers (more obscure ones count too)
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {revealData[revealCell].map((a) => (
                <li key={a.id} className="text-[12.5px] text-cream-dim">
                  <span className="font-mono text-[10px] text-gold/80">+{a.points} </span>
                  {a.name}
                  <span className="font-mono text-[10px] text-cream-faint">
                    {" "}
                    · {a.split} · OT{a.term}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* rules modal */}
      {showRules && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowRules(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[82vh] w-[min(470px,93vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-ink-line border-t-2 border-t-gold bg-[#141a24] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="font-display text-lg text-cream">Rules &amp; scoring</h2>
              <button
                onClick={() => setShowRules(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 cursor-pointer rounded px-2 py-1 text-cream-faint hover:text-cream"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-cream-dim">
              <li>
                <span className="text-cream">The grid.</span> Three clues across,
                three down — each a justice or a category (a topic, an opinion
                author, a margin, an era…). A fresh bench every day, the same
                for everyone.
              </li>
              <li>
                <span className="text-cream">A correct answer</span> is a case
                that fits both clues:
                <ul className="mt-1 ml-3 list-disc space-y-1">
                  <li>two justices → both on the same side (joint majority or joint dissent)</li>
                  <li>a justice + a category → the case fits the category and that justice was in the majority</li>
                  <li>two categories → the case fits both</li>
                </ul>
              </li>
              <li>
                <span className="text-cream">The pool</span> is every U.S.
                Supreme Court decision since 1946. Justice clues cover the last
                20 justices to sit; cases from any era are fair game as answers.
                Unanimous decisions don&apos;t count when a justice clue is
                involved.
              </li>
              <li>
                <span className="text-cream">Nine guesses.</span> Wrong guesses
                burn one; each case is usable once. Every cell is solvable from
                a case famous enough for a Wikipedia article — but{" "}
                <span className="text-cream">any</span> real case that fits is
                accepted.
              </li>
              <li>
                <span className="text-cream">Scoring.</span> Each box is worth{" "}
                <span className="font-mono text-gold">100–200 points</span>,
                inverse to the case&apos;s fame (recent Wikipedia pageviews).
                The blockbuster scores 100; an obscure deep cut with no article
                scores 200. Your total is the sum of your boxes — max 1,800.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
