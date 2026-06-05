"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  GUESSES,
  caseId,
  generatePuzzle,
  localDateString,
  sameSide,
  validAnswers,
  type GameCase,
} from "@/lib/game";
import { fmtDate } from "@/lib/format";
import { JUSTICE_BY_ID } from "@/lib/justices";

interface SavedGame {
  /** caseId or null per cell (row-major) */
  cells: (string | null)[];
  guessesUsed: number;
}

interface Stats {
  played: number;
  immaculate: number;
  totalCells: number;
  streak: number;
  lastPlayed: string;
}

const gameKey = (date: string) => `ibench:${date}`;
const STATS_KEY = "ibench:stats";

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export default function Game({ cases }: { cases: GameCase[] }) {
  const [date, setDate] = useState<string | null>(null);
  const [cells, setCells] = useState<(string | null)[]>(Array(9).fill(null));
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<{ cell: number; ok: boolean } | null>(null);
  const [revealCell, setRevealCell] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const statsRecorded = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // client-only init (local timezone daily rollover + saved state)
  useEffect(() => {
    const d = localDateString();
    const saved = load<SavedGame>(gameKey(d));
    if (saved) {
      setCells(saved.cells);
      setGuessesUsed(saved.guessesUsed);
    }
    setDate(d);
  }, []);

  const puzzle = useMemo(
    () => (date ? generatePuzzle(cases, date) : null),
    [cases, date]
  );

  const byId = useMemo(() => {
    const m = new Map<string, GameCase>();
    for (const c of cases) m.set(caseId(c), c);
    return m;
  }, [cases]);

  const filled = cells.filter(Boolean).length;
  const over = guessesUsed >= GUESSES || filled === 9;
  const immaculate = filled === 9 && guessesUsed === 9;

  // record stats once at game over
  useEffect(() => {
    if (!date || !over || statsRecorded.current) return;
    statsRecorded.current = true;
    const s = load<Stats>(STATS_KEY) ?? {
      played: 0,
      immaculate: 0,
      totalCells: 0,
      streak: 0,
      lastPlayed: "",
    };
    if (s.lastPlayed === date) return; // already counted (page reload)
    const yesterday = localDateString(new Date(Date.now() - 86400000));
    save(STATS_KEY, {
      played: s.played + 1,
      immaculate: s.immaculate + (filled === 9 ? 1 : 0),
      totalCells: s.totalCells + filled,
      streak: s.lastPlayed === yesterday ? s.streak + 1 : 1,
      lastPlayed: date,
    });
  }, [over, date, filled]);

  if (!date || !puzzle) {
    return (
      <div className="py-24 text-center font-mono text-[12px] text-cream-faint">
        drawing today&apos;s bench…
      </div>
    );
  }

  const persist = (nextCells: (string | null)[], nextGuesses: number) => {
    save(gameKey(date), { cells: nextCells, guessesUsed: nextGuesses });
  };

  const pairFor = (cell: number) => ({
    row: puzzle.rows[Math.floor(cell / 3)],
    col: puzzle.cols[cell % 3],
  });

  const guess = (cell: number, c: GameCase) => {
    const { row, col } = pairFor(cell);
    const id = caseId(c);
    const used = cells.includes(id);
    const ok = !used && sameSide(c, row, col);
    const nextCells = ok
      ? cells.map((v, i) => (i === cell ? id : v))
      : cells;
    const nextGuesses = guessesUsed + 1;
    setCells(nextCells);
    setGuessesUsed(nextGuesses);
    persist(nextCells, nextGuesses);
    setFlash({ cell, ok });
    setTimeout(() => setFlash(null), 650);
    setActive(null);
    setQuery("");
  };

  const matches =
    query.trim().length >= 2
      ? cases
          .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  const stats = load<Stats>(STATS_KEY);

  const shareText = () => {
    const rowsEmoji = [0, 1, 2]
      .map((r) =>
        [0, 1, 2].map((c) => (cells[r * 3 + c] ? "🟨" : "⬛")).join("")
      )
      .join("\n");
    return `Immaculate Bench ${date}\n${filled}/9${immaculate ? " — IMMACULATE" : ""}\n${rowsEmoji}\nscotusgami.grannis.xyz/game`;
  };

  const name = (id: string) => JUSTICE_BY_ID[id].lastName;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-20">
      {/* status line */}
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-cream-faint">{date}</span>
        <span className="font-mono text-[12px]">
          <span className={guessesUsed >= GUESSES ? "text-cream-faint" : "text-gold"}>
            {GUESSES - guessesUsed}
          </span>{" "}
          <span className="text-cream-faint">guesses left</span>
        </span>
      </div>

      {/* the grid */}
      <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-1.5">
        <div />
        {puzzle.cols.map((id) => (
          <div
            key={id}
            className="flex items-end justify-center pb-1 text-center font-display text-[15px] italic text-cream"
          >
            {name(id)}
          </div>
        ))}
        {[0, 1, 2].map((r) => (
          <Fragment key={puzzle.rows[r]}>
            <div className="flex items-center justify-end pr-2 text-right font-display text-[15px] italic text-cream">
              {name(puzzle.rows[r])}
            </div>
            {[0, 1, 2].map((c) => {
              const i = r * 3 + c;
              const answer = cells[i] ? byId.get(cells[i]!) : null;
              const { row, col } = pairFor(i);
              const valid = validAnswers(cases, row, col);
              const flashing = flash?.cell === i;
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (over) {
                      if (!answer) setRevealCell(i);
                    } else if (!answer) {
                      setActive(i);
                      setQuery("");
                      setTimeout(() => inputRef.current?.focus(), 30);
                    }
                  }}
                  className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border p-2 text-center transition-colors ${
                    answer
                      ? "border-gold/60 bg-[#182030]"
                      : "border-ink-line bg-ink-raised/60 hover:border-cream-faint"
                  } ${flashing ? (flash!.ok ? "outline outline-2 outline-gold" : "outline outline-2 outline-red-400/70") : ""}`}
                >
                  {answer ? (
                    <>
                      <span className="line-clamp-3 font-display text-[12px] italic leading-tight text-cream">
                        {answer.name}
                      </span>
                      <span className="mt-1 font-mono text-[9.5px] text-cream-faint">
                        {answer.split} · OT{answer.term}
                      </span>
                      <span className="mt-0.5 font-mono text-[9px] text-gold/80">
                        1 of {valid.length} valid
                      </span>
                    </>
                  ) : over ? (
                    <span className="font-mono text-[10px] text-cream-faint">
                      {valid.length} valid
                      <br />
                      <span className="text-gold/70 underline decoration-dotted">
                        reveal
                      </span>
                    </span>
                  ) : (
                    <span className="font-display text-2xl text-cream-faint">+</span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-cream-faint">
        Name a case where both justices were on the same side — together in the
        majority or together in dissent. Unanimous decisions don&apos;t count.
        One use per case.
      </p>

      {/* game-over panel */}
      {over && (
        <div className="mt-6 rounded-md border border-ink-line bg-ink-raised/60 px-5 py-4 text-center">
          <div className="font-display text-xl text-cream">
            {immaculate ? "Immaculate." : `${filled} of 9`}
          </div>
          {stats && (
            <div className="mt-1 font-mono text-[10.5px] text-cream-faint">
              streak {stats.streak} · played {stats.played} · immaculate{" "}
              {stats.immaculate}
            </div>
          )}
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
          <div className="fixed left-1/2 top-[20%] z-50 w-[min(440px,92vw)] -translate-x-1/2 rounded-md border border-ink-line border-t-2 border-t-gold bg-[#141a24] p-4 shadow-2xl">
            <div className="mb-2 font-display text-[14px] italic text-cream">
              {name(pairFor(active).row)} + {name(pairFor(active).col)}, same side
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
                if (e.key === "Enter" && matches.length === 1) guess(active, matches[0]);
              }}
              placeholder="search cases…"
              className="w-full rounded border border-ink-line bg-ink px-3 py-2 text-[13px] text-cream outline-none placeholder:text-cream-faint focus:border-gold/60"
            />
            <ul className="mt-2 max-h-60 overflow-y-auto">
              {matches.map((c) => (
                <li key={caseId(c)}>
                  <button
                    onClick={() => guess(active, c)}
                    className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-[12.5px] text-cream-dim hover:bg-ink hover:text-cream"
                  >
                    {c.name}
                    <span className="font-mono text-[10px] text-cream-faint">
                      {" "}
                      · OT{c.term} · {fmtDate(c.decided)}
                    </span>
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && matches.length === 0 && (
                <li className="px-2 py-1.5 text-[12px] text-cream-faint">
                  no cases match
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* reveal modal (after game over) */}
      {revealCell !== null && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setRevealCell(null)} />
          <div className="fixed left-1/2 top-[18%] z-50 w-[min(440px,92vw)] -translate-x-1/2 rounded-md border border-ink-line border-t-2 border-t-gold bg-[#141a24] p-4 shadow-2xl">
            <div className="mb-2 font-display text-[14px] italic text-cream">
              {name(pairFor(revealCell).row)} + {name(pairFor(revealCell).col)} —
              valid answers
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {validAnswers(cases, pairFor(revealCell).row, pairFor(revealCell).col).map(
                (i) => (
                  <li key={caseId(cases[i])} className="text-[12.5px] text-cream-dim">
                    <a
                      href={cases[i].oyezUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-gold-bright"
                    >
                      {cases[i].name}
                    </a>
                    <span className="font-mono text-[10px] text-cream-faint">
                      {" "}
                      · {cases[i].split} · OT{cases[i].term}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
