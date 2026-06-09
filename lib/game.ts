import { CATEGORY_BY_ID, type Category } from "./categories";
import { GAME_JUSTICES, justiceLabel } from "./roster";
import type { Header, PoolCase, Puzzle } from "./game-types";

export const GUESSES = 9;

/* ---------------- header helpers ---------------- */

export function headerId(h: Header): string {
  return `${h.kind}:${h.id}`;
}

export function headerLabel(h: Header): string {
  return h.kind === "justice"
    ? justiceLabel(h.id)
    : (CATEGORY_BY_ID[h.id]?.label ?? h.id);
}

/* ---------------- cell rules ---------------- */
// J×J : both justices on the SAME side (both majority or both dissent),
//        non-unanimous (so a 9–0 isn't a gimme for "both in majority").
// J×C : case matches the category AND the justice was in the MAJORITY,
//        non-unanimous.
// C×C : case matches both categories (unanimous allowed — no justice gate).

function justiceSide(c: PoolCase, id: string): "M" | "D" | null {
  const s = c.votes[id];
  return s === "M" || s === "D" ? s : null;
}

const isUnanimous = (c: PoolCase) => c.min === 0;

function matchesCategory(c: PoolCase, cat: Category): boolean {
  return cat.test(c);
}

/** Does `c` satisfy the cell formed by headers a and b? */
export function cellValid(c: PoolCase, a: Header, b: Header): boolean {
  if (a.kind === "justice" && b.kind === "justice") {
    const sa = justiceSide(c, a.id);
    const sb = justiceSide(c, b.id);
    return sa != null && sa === sb && !isUnanimous(c);
  }
  if (a.kind === "justice" || b.kind === "justice") {
    const j = (a.kind === "justice" ? a : b) as { kind: "justice"; id: string };
    const cat = CATEGORY_BY_ID[(a.kind === "category" ? a : b).id];
    if (!cat) return false;
    return justiceSide(c, j.id) === "M" && !isUnanimous(c) && matchesCategory(c, cat);
  }
  const ca = CATEGORY_BY_ID[a.id];
  const cb = CATEGORY_BY_ID[b.id];
  return !!ca && !!cb && matchesCategory(c, ca) && matchesCategory(c, cb);
}

/* ---------------- scoring ---------------- */
// 100 (most famous case in the pool) → 200 (no Wikipedia article). Rare pulls
// are worth double a gimme; total is the sum of boxes.

export function pointsFor(c: PoolCase, maxFame: number): number {
  const denom = Math.log(1 + Math.max(1, maxFame));
  const fame = c.fame ?? 0;
  return 100 + Math.max(0, Math.round(100 * (1 - Math.log(1 + fame) / denom)));
}

export function maxFameOf(pool: PoolCase[]): number {
  return Math.max(1, ...pool.map((c) => c.fame ?? 0));
}

/* ---------------- deterministic daily generator ---------------- */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Precomputed notable-pool index sets for fast cell-count during generation. */
interface HeaderSets {
  header: Header;
  weight: number; // notable coverage — drives proportional appearance
  maj?: Set<number>; // justice in majority, non-unanimous (justice headers)
  dis?: Set<number>; // justice in dissent (justice headers)
  match?: Set<number>; // category matches (category headers)
}

function buildHeaderSets(notable: PoolCase[]): { justices: HeaderSets[]; cats: HeaderSets[] } {
  const justices: HeaderSets[] = [];
  for (const j of GAME_JUSTICES) {
    const maj = new Set<number>();
    const dis = new Set<number>();
    notable.forEach((c, i) => {
      const s = justiceSide(c, j.id);
      if (s === "M" && !isUnanimous(c)) maj.add(i);
      else if (s === "D") dis.add(i);
    });
    if (maj.size + dis.size > 0)
      justices.push({ header: { kind: "justice", id: j.id }, maj, dis, weight: maj.size + dis.size });
  }
  const cats: HeaderSets[] = [];
  for (const cat of Object.values(CATEGORY_BY_ID)) {
    const match = new Set<number>();
    notable.forEach((c, i) => {
      if (cat.test(c)) match.add(i);
    });
    if (match.size > 0)
      cats.push({ header: { kind: "category", id: cat.id }, match, weight: match.size });
  }
  return { justices, cats };
}

/** Weighted draw of k distinct items (weight ∝ case count). Deterministic via rng. */
function weightedPick(
  items: HeaderSets[],
  k: number,
  rng: () => number,
  exclude: Set<HeaderSets> = new Set()
): HeaderSets[] {
  const avail = items.filter((x) => !exclude.has(x));
  const out: HeaderSets[] = [];
  for (let n = 0; n < k && avail.length > 0; n++) {
    let total = 0;
    for (const x of avail) total += x.weight;
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < avail.length; i++) {
      r -= avail[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return out;
}

function inter(a: Set<number>, b: Set<number>): number {
  let n = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) n++;
  return n;
}

/** Count of notable answers for the cell formed by two HeaderSets. */
function cellCount(a: HeaderSets, b: HeaderSets): number {
  const aJ = a.header.kind === "justice";
  const bJ = b.header.kind === "justice";
  if (aJ && bJ) return inter(a.maj!, b.maj!) + inter(a.dis!, b.dis!);
  if (aJ) return inter(a.maj!, b.match!);
  if (bJ) return inter(b.maj!, a.match!);
  return inter(a.match!, b.match!);
}

/**
 * Pick 3 rows × 3 cols (free mix of justices and categories) such that every
 * cell has between 1 and `cap` notable answers. Deterministic per date:
 * scans seeded candidate boards and returns the one whose hardest cell is
 * smallest (most specific), so puzzles aren't trivially broad.
 */
export function generatePuzzle(notable: PoolCase[], date: string): Puzzle {
  const { justices, cats } = buildHeaderSets(notable);
  const rng = mulberry32(hashString(`immaculate-bench:${date}`));

  // Each board: one justice + two categories per axis (so every row and every
  // column has at least one justice). Headers are drawn weighted by case count,
  // so categories appear roughly in proportion to how many cases they cover.
  // Accept the first board (in weighted-sample order) whose every cell has at
  // least MIN notable answers — preserving the proportional distribution.
  const shuffle = (a: HeaderSets[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Difficulty: every cell needs ≥ MIN notable answers; category-involving
  // cells are also capped so broad clues (e.g. "Conservative result") can't
  // make a gimme — they only survive when paired with something narrow. The
  // single justice×justice cell is exempt (two aligned long-tenured justices
  // share inherently many cases).
  const MIN = 3;
  const attempt = (cap: number): HeaderSets[] | null => {
    for (let t = 0; t < 3000; t++) {
      const js = weightedPick(justices, 2, rng);
      if (js.length < 2) return null;
      const cs = weightedPick(cats, 4, rng);
      if (cs.length < 4) return null;
      const rows = shuffle([js[0], cs[0], cs[1]]);
      const cols = shuffle([js[1], cs[2], cs[3]]);
      let ok = true;
      for (const r of rows) {
        for (const c of cols) {
          const n = cellCount(r, c);
          const jj = r.header.kind === "justice" && c.header.kind === "justice";
          if (n < MIN || (!jj && n > cap)) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (ok) return [...rows, ...cols];
    }
    return null;
  };

  const headers = attempt(45) ?? attempt(90) ?? attempt(200) ?? attempt(Infinity);
  if (!headers) {
    // pathological fallback
    const js = justices.slice(0, 2);
    const cs = cats.slice(0, 4);
    return {
      date,
      rows: [js[0], cs[0], cs[1]].map((s) => s.header),
      cols: [js[1], cs[2], cs[3]].map((s) => s.header),
    };
  }
  return {
    date,
    rows: headers.slice(0, 3).map((s) => s.header),
    cols: headers.slice(3, 6).map((s) => s.header),
  };
}

/* ---------------- play-time helpers (full pool) ---------------- */

export const localDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** All valid answers (full pool) for a cell, indices into `pool`. */
export function validAnswers(
  pool: PoolCase[],
  a: Header,
  b: Header
): number[] {
  const out: number[] = [];
  pool.forEach((c, i) => {
    if (cellValid(c, a, b)) out.push(i);
  });
  return out;
}
