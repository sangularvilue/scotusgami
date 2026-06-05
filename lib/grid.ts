import { JUSTICE_BY_ID, N_JUSTICES, SENIORITY_IDS } from "./justices";
import type { Side } from "./types";

/** Encode a votes map into the canonical 9-char key (seniority order). */
export function encodeLineup(votes: Record<string, Side>): string {
  return SENIORITY_IDS.map((id) => votes[id] ?? "A").join("");
}

/** Decode a canonical key back into a votes map. */
export function decodeLineup(key: string): Record<string, Side> {
  const votes: Record<string, Side> = {};
  SENIORITY_IDS.forEach((id, i) => {
    votes[id] = key[i] as Side;
  });
  return votes;
}

export function keyCounts(key: string): { maj: number; dis: number; absent: number } {
  let maj = 0,
    dis = 0,
    absent = 0;
  for (const c of key) {
    if (c === "M") maj++;
    else if (c === "D") dis++;
    else absent++;
  }
  return { maj, dis, absent };
}

export function splitLabel(key: string): string {
  const { maj, dis } = keyCounts(key);
  return `${maj}–${dis}`;
}

/** All k-subsets of `ids`, each subset in the order ids were given. */
function combinations<T>(ids: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > ids.length) return [];
  const [head, ...rest] = ids;
  return [
    ...combinations(rest, k - 1).map((c) => [head, ...c]),
    ...combinations(rest, k),
  ];
}

/** Sort key for a set of justice ids: lexicographic by ideological position. */
function ideologicalRank(ids: string[]): string {
  return ids
    .map((id) => JUSTICE_BY_ID[id].ideology)
    .sort((a, b) => a - b)
    .map((n) => String.fromCharCode(65 + n))
    .join("");
}

function buildKey(absent: string[], dissent: string[]): string {
  const votes: Record<string, Side> = {};
  for (const id of SENIORITY_IDS) votes[id] = "M";
  for (const id of absent) votes[id] = "A";
  for (const id of dissent) votes[id] = "D";
  return encodeLineup(votes);
}

export interface SplitGroup {
  /** e.g. "6–3" */
  label: string;
  majSize: number;
  disSize: number;
  /** one lineup key per possible outcome (matrix row) */
  keys: string[];
}

export interface Section {
  /** number of absent justices */
  k: number;
  title: string;
  groups: SplitGroup[];
  /** total enumerated rows in this section */
  rowCount: number;
}

const SECTION_TITLES = ["Full bench", "One justice out", "Two justices out"];

/**
 * Enumerate the displayed universe as matrix rows: for each k (absent count)
 * a section whose groups are the splits (9–0, 8–1, ...). Within a group, rows
 * are ordered by absent set then dissent set (ideological order), so missing-
 * justice blocks and ideological blocs cluster.
 */
export function enumerateSections(extraKeys: string[] = []): Section[] {
  const sections: Section[] = [];
  for (let k = 0; k <= 2; k++) {
    const absentSets = combinations(SENIORITY_IDS, k).sort((a, b) =>
      ideologicalRank(a).localeCompare(ideologicalRank(b))
    );
    const n = N_JUSTICES - k;
    const maxDissent = Math.ceil(n / 2) - 1;
    const groups: SplitGroup[] = [];
    for (let d = 0; d <= maxDissent; d++) {
      const keys: string[] = [];
      for (const absent of absentSets) {
        const present = SENIORITY_IDS.filter((id) => !absent.includes(id));
        const combos = combinations(present, d).sort((a, b) =>
          ideologicalRank(a).localeCompare(ideologicalRank(b))
        );
        for (const c of combos) keys.push(buildKey(absent, c));
      }
      groups.push({ label: `${n - d}–${d}`, majSize: n - d, disSize: d, keys });
    }
    sections.push({
      k,
      title: SECTION_TITLES[k],
      groups,
      rowCount: groups.reduce((s, g) => s + g.keys.length, 0),
    });
  }

  // Anything observed outside the enumerated universe (3+ out, or a 4–4 tie)
  const enumerated = new Set(
    sections.flatMap((s) => s.groups.flatMap((g) => g.keys))
  );
  const extras = [...new Set(extraKeys)].filter((key) => !enumerated.has(key));
  if (extras.length > 0) {
    extras.sort();
    sections.push({
      k: 3,
      title: "Rare benches",
      groups: [{ label: "other", majSize: 0, disSize: 0, keys: extras }],
      rowCount: extras.length,
    });
  }
  return sections;
}

/** Quick self-check used by scripts/check-grid.ts */
export function expectedCounts(): Record<number, number> {
  const choose = (n: number, r: number): number => {
    if (r < 0 || r > n) return 0;
    let v = 1;
    for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
    return Math.round(v);
  };
  const out: Record<number, number> = {};
  for (let k = 0; k <= 2; k++) {
    const n = N_JUSTICES - k;
    let per = 0;
    for (let d = 0; d <= Math.ceil(n / 2) - 1; d++) per += choose(n, d);
    out[k] = choose(N_JUSTICES, k) * per;
  }
  return out;
}
