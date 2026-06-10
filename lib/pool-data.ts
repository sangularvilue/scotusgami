import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cellValid,
  generatePuzzle,
  headerLabel,
  maxFameOf,
  pointsFor,
  validAnswers,
} from "./game";
import type { Header, PoolCase, Puzzle } from "./game-types";

/* ---- pool (loaded once per server instance) ---- */

let _pool: PoolCase[] | null = null;
function pool(): PoolCase[] {
  if (!_pool) {
    _pool = JSON.parse(
      readFileSync(join(process.cwd(), "data", "pool.json"), "utf8")
    ) as PoolCase[];
  }
  return _pool;
}

let _notable: PoolCase[] | null = null;
const notable = () => (_notable ??= pool().filter((c) => c.notable));

let _maxFame = 0;
const maxFame = () => (_maxFame ||= maxFameOf(pool()));

let _byId: Map<string, PoolCase> | null = null;
const byId = () => (_byId ??= new Map(pool().map((c) => [c.id, c])));

/* ---- daily puzzle (Redis-cached, deterministic) ---- */

export interface ClientHeader {
  kind: "justice" | "category";
  id: string;
  label: string;
}
export interface ClientPuzzle {
  date: string;
  rows: ClientHeader[];
  cols: ClientHeader[];
}

const toClient = (h: Header): ClientHeader => ({
  kind: h.kind,
  id: h.id,
  label: headerLabel(h),
});

const puzzleKey = (date: string) => `scotusgami:bench:${date}`;

export async function getPuzzle(date: string): Promise<{ puzzle: Puzzle; client: ClientPuzzle }> {
  let puzzle: Puzzle | null = null;
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { kvGet, kvSet } = await import("./kv");
    puzzle = await kvGet<Puzzle>(puzzleKey(date));
    if (!puzzle) {
      puzzle = generatePuzzle(notable(), date);
      await kvSet(puzzleKey(date), puzzle);
    }
  } else {
    puzzle = generatePuzzle(notable(), date);
  }
  const client: ClientPuzzle = {
    date,
    rows: puzzle.rows.map(toClient),
    cols: puzzle.cols.map(toClient),
  };
  return { puzzle, client };
}

/* ---- play-time operations ---- */

export interface GuessResult {
  ok: boolean;
  caseId: string;
  name: string;
  term: number;
  split: string;
  points: number;
}

export async function checkGuess(
  date: string,
  cell: number,
  caseId: string
): Promise<GuessResult | { error: string }> {
  const c = byId().get(caseId);
  if (!c) return { error: "unknown case" };
  const { puzzle } = await getPuzzle(date);
  const row = puzzle.rows[Math.floor(cell / 3)];
  const col = puzzle.cols[cell % 3];
  if (!row || !col) return { error: "bad cell" };
  const ok = cellValid(c, row, col);
  return {
    ok,
    caseId: c.id,
    name: c.name,
    term: c.term,
    split: `${c.maj}–${c.min}`,
    points: ok ? pointsFor(c, maxFame()) : 0,
  };
}

export interface SearchHit {
  id: string;
  name: string;
  term: number;
}

export function search(q: string, limit = 10): SearchHit[] {
  // tokenized: every word in the query must appear in the case name (ignoring
  // "v"/"v." and punctuation), so "allen v milligan" matches "ALLEN v.
  // MILLIGAN" and word order / punctuation don't matter.
  // strip apostrophes (so "womens" matches "Women's") then split on punctuation
  const norm = (x: string) => x.toLowerCase().replace(/['’`]/g, "");
  const tokens = norm(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t !== "v");
  if (tokens.length === 0) return [];
  const hits: { c: PoolCase; score: number }[] = [];
  for (const c of pool()) {
    const name = norm(c.name);
    if (tokens.every((t) => name.includes(t))) {
      // rank: shorter names first (closer to the bare case name), then recency
      hits.push({ c, score: name.length });
    }
  }
  hits.sort((a, b) => a.score - b.score || b.c.term - a.c.term);
  return hits.slice(0, limit).map(({ c }) => ({ id: c.id, name: c.name, term: c.term }));
}

export interface RevealAnswer {
  id: string;
  name: string;
  term: number;
  split: string;
  points: number;
}

export async function reveal(date: string): Promise<RevealAnswer[][]> {
  const { puzzle } = await getPuzzle(date);
  const mf = maxFame();
  const out: RevealAnswer[][] = [];
  for (let i = 0; i < 9; i++) {
    const row = puzzle.rows[Math.floor(i / 3)];
    const col = puzzle.cols[i % 3];
    const idxs = validAnswers(notable(), row, col);
    const answers = idxs
      .map((j) => notable()[j])
      .map((c) => ({
        id: c.id,
        name: c.name,
        term: c.term,
        split: `${c.maj}–${c.min}`,
        points: pointsFor(c, mf),
      }))
      .sort((a, b) => b.points - a.points);
    out.push(answers);
  }
  return out;
}
