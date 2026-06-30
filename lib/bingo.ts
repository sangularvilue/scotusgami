import { SENIORITY_IDS } from "./justices";
import type { BingoCase } from "./types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A SCOTUS argument sitting often straddles a month boundary (e.g. the February
// sitting runs late Feb into early March), so we can't bucket by calendar month.
// Instead we group argued cases into sessions: a gap larger than this many days
// between consecutive argument dates starts a new sitting.
const SESSION_GAP_DAYS = 12;

/**
 * Cases the Court consolidated to be argued and decided together under a single
 * opinion. Oyez lists each consolidated petition as its own docket carrying its
 * own (null) decision, and the slip-opinion list reports the merged decision
 * under just one of them — so without this map a consolidated companion dangles
 * forever as "still out" after its group has actually come down.
 *
 * Each group is ONE merits decision with ONE author. List the lead docket first
 * (its case supplies the displayed tile and name); the rest are folded into it.
 * The group is treated as decided as soon as ANY member resolves, so it does not
 * matter which docket the slip list happens to file the opinion under.
 *
 * Source: the Court's consolidation orders — verify against supremecourt.gov.
 */
export const CONSOLIDATED_GROUPS: string[][] = [
  // West Virginia v. B.P.J. (24-43) + Little v. Hecox (24-38) — consolidated for
  // argument, decided together (slip filed under 24-43).
  ["24-43", "24-38"],
];

/**
 * Fold consolidated companion cases into their lead. The lead absorbs the
 * group's decided date/author from whichever member resolved, records the
 * companions in `consolidatedWith`, and the members are dropped so the group
 * occupies a single tile counted as one opinion. Non-destructive: returns a new
 * list, leaving the stored (raw) bingo cases intact.
 */
export function collapseConsolidated(cases: BingoCase[]): BingoCase[] {
  if (!CONSOLIDATED_GROUPS.length) return cases;
  const byDocket = new Map(cases.map((c) => [c.docket, c] as const));
  const drop = new Set<string>();
  const patched = new Map<string, BingoCase>();

  for (const group of CONSOLIDATED_GROUPS) {
    // Members present on the card, in lead-first order — so members[0] is the
    // lead (the first listed docket that actually exists this term).
    const members = group
      .map((d) => byDocket.get(d))
      .filter((c): c is BingoCase => !!c);
    if (members.length < 2) continue; // nothing to merge

    const lead = members[0];
    const resolved = members.find((m) => m.decided && m.majorityAuthor);
    patched.set(lead.docket, {
      ...lead,
      decided: lead.decided ?? resolved?.decided ?? null,
      majorityAuthor: lead.majorityAuthor ?? resolved?.majorityAuthor ?? null,
      consolidatedWith: members.slice(1).map((m) => m.name),
    });
    for (const m of members.slice(1)) drop.add(m.docket);
  }

  return cases
    .filter((c) => !drop.has(c.docket))
    .map((c) => patched.get(c.docket) ?? c);
}

export interface BingoCaseLite {
  name: string;
  docket: string;
  oyezUrl: string;
  decided: string | null;
  /** companion case names folded in via consolidation (lead tile only) */
  consolidatedWith?: string[];
}

export interface BingoSitting {
  sitting: string;
  /** justice id → the decided opinion(s) that justice authored this sitting */
  byAuthor: Record<string, BingoCaseLite[]>;
  /** argued-but-undecided cases from this sitting */
  pending: BingoCaseLite[];
  /** justice ids that have authored ≥1 majority this sitting */
  authored: string[];
  /**
   * justice ids with no majority yet this sitting — i.e. still "owed" one.
   * Only populated when the sitting still has pending cases (otherwise the
   * sitting is closed and an empty cell just means that justice was skipped).
   */
  owed: string[];
}

export interface BingoGrid {
  term: number;
  sittings: BingoSitting[];
  /** justice id → majorities authored this term */
  perJustice: Record<string, number>;
  decidedCount: number;
  pendingCount: number;
}

const lite = (c: BingoCase): BingoCaseLite => ({
  name: c.name,
  docket: c.docket,
  oyezUrl: c.oyezUrl,
  decided: c.decided,
  ...(c.consolidatedWith?.length ? { consolidatedWith: c.consolidatedWith } : {}),
});

/**
 * Fold a term's argued cases into the bingo card: for each sitting, who has
 * written and which cases are still out. The "owed" set is the heart of the
 * game — the justices who could still be holding a pending opinion.
 */
export function buildBingoGrid(term: number, cases: BingoCase[]): BingoGrid {
  // Fold consolidated companions into their lead so each shared opinion is one
  // tile (and a companion never lingers as "still out" once the group is down).
  cases = collapseConsolidated(cases);

  // Only cases argued during this term's sittings. Drops holdovers argued before
  // the term opened (a case carried over from the prior term and decided now).
  const termStart = `${term}-10-01`;
  const argued = cases
    .filter((c) => c.argued && c.argued >= termStart)
    .sort((a, b) => a.argued!.localeCompare(b.argued!));

  // Split the chronological list into sessions on large date gaps.
  const sessions: BingoCase[][] = [];
  let prevTs: number | null = null;
  for (const c of argued) {
    const ts = Date.parse(`${c.argued}T00:00:00Z`);
    const newSession =
      prevTs === null || (ts - prevTs) / 86_400_000 > SESSION_GAP_DAYS;
    if (newSession) sessions.push([]);
    sessions[sessions.length - 1].push(c);
    prevTs = ts;
  }

  const perJustice: Record<string, number> = {};
  const sittings: BingoSitting[] = sessions.map((group) => {
    const sitting =
      MONTHS[new Date(`${group[0].argued}T00:00:00Z`).getUTCMonth()];
    const byAuthor: Record<string, BingoCaseLite[]> = {};
    const pending: BingoCaseLite[] = [];

    for (const c of group) {
      if (c.decided && c.majorityAuthor) {
        (byAuthor[c.majorityAuthor] ??= []).push(lite(c));
        perJustice[c.majorityAuthor] = (perJustice[c.majorityAuthor] ?? 0) + 1;
      } else if (!c.decided) {
        pending.push(lite(c));
      }
      // decided with an unresolved author (rare for the current bench) is left
      // off the grid rather than guessed at.
    }

    const authored = SENIORITY_IDS.filter((id) => byAuthor[id]?.length);
    const owed = pending.length
      ? SENIORITY_IDS.filter((id) => !authored.includes(id))
      : [];

    return { sitting, byAuthor, pending, authored, owed };
  });

  return {
    term,
    sittings,
    perJustice,
    // authored opinions actually shown — excludes DIG'd / per-curiam argued
    // cases (decided but no assigned author), so it matches the visible tiles.
    decidedCount: sittings.reduce(
      (n, s) => n + Object.values(s.byAuthor).reduce((m, a) => m + a.length, 0),
      0
    ),
    pendingCount: argued.filter((c) => !c.decided).length,
  };
}
