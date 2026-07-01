import { encodeLineup } from "./grid";
import { JUSTICE_BY_ID, NATURAL_COURT_START } from "./justices";
import type { BingoCase, CaseRecord, OpinionInfo, Side } from "./types";

const API = "https://api.oyez.org";
const FETCH_DELAY_MS = 150;

/* ---------- raw API shapes (only the fields we read) ---------- */

interface OyezCaseSummary {
  ID: number;
  docket_number: string;
  name: string;
  href: string;
  term: string;
  view_count?: number;
}

interface OyezMember {
  ID: number;
  identifier?: string;
  name: string;
  last_name?: string;
}

interface OyezVote {
  member: OyezMember;
  vote: "majority" | "minority" | "none" | null;
  opinion_type: string | null;
  joining: OyezMember[] | null;
}

interface OyezDecision {
  votes: OyezVote[] | null;
  majority_vote: number;
  minority_vote: number;
  winning_party: string | null;
  decision_type: string | null;
}

interface OyezCaseDetail extends OyezCaseSummary {
  question: string | null;
  description: string | null;
  justia_url: string | null;
  timeline: { event: string; dates: number[] | null }[] | null;
  decisions: OyezDecision[] | null;
}

/* ---------- helpers ---------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "scotusgami.grannis.xyz (personal project)" },
    });
    if (res.ok) return (await res.json()) as T;
    if (attempt < 2) await sleep(1000 * (attempt + 1));
  }
  throw new Error(`Oyez fetch failed: ${url}`);
}

export function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&sect;/g, "§")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve an Oyez member to one of our 9 justice ids, or null if not on the bench. */
function resolveJustice(m: OyezMember): string | null {
  if (m.identifier && JUSTICE_BY_ID[m.identifier]) return m.identifier;
  return null;
}

export interface ParseOutcome {
  record: CaseRecord | null;
  /** why the case was excluded, when record is null */
  skipped?: string;
}

/* ---------- parsing ---------- */

export function parseCase(detail: OyezCaseDetail): ParseOutcome {
  const decision = detail.decisions?.find((d) => d.votes && d.votes.length > 0);
  if (!decision || !decision.votes) return { record: null, skipped: "no recorded votes" };

  const decidedTs = detail.timeline
    ?.find((t) => t.event === "Decided")
    ?.dates?.slice(-1)[0];
  if (!decidedTs) return { record: null, skipped: "no decided date" };
  const decided = new Date(decidedTs * 1000).toISOString().slice(0, 10);
  if (decided < NATURAL_COURT_START)
    return { record: null, skipped: `decided ${decided}, before current bench` };

  const votes: Record<string, Side> = {};
  for (const v of decision.votes) {
    const id = resolveJustice(v.member);
    if (!id) return { record: null, skipped: `non-current justice voted: ${v.member.name}` };
    votes[id] =
      v.vote === "majority" ? "M" : v.vote === "minority" ? "D" : "A";
  }

  // Guard against half-entered Oyez vote matrices (e.g. a "majority" smaller
  // than the dissent, or fewer participants than a quorum).
  const majCount = Object.values(votes).filter((s) => s === "M").length;
  const disCount = Object.values(votes).filter((s) => s === "D").length;
  if (majCount <= disCount)
    return { record: null, skipped: `no clear majority (${majCount}–${disCount})` };
  if (majCount + disCount < 6)
    return { record: null, skipped: `incomplete votes (${majCount}–${disCount})` };

  // Opinions: a justice with an opinion_type wrote one; joiners are justices
  // whose `joining` array includes the author.
  const opinions: OpinionInfo[] = [];
  for (const v of decision.votes) {
    const author = resolveJustice(v.member);
    if (!author || !v.opinion_type || v.opinion_type === "none") continue;
    const joinedBy = decision.votes
      .filter((w) => w.joining?.some((j) => resolveJustice(j) === author))
      .map((w) => resolveJustice(w.member)!)
      .filter((id) => id && id !== author);
    opinions.push({ type: v.opinion_type, author, joinedBy });
  }

  const record: CaseRecord = {
    term: detail.term,
    docket: detail.docket_number,
    name: detail.name,
    decided,
    question: stripHtml(detail.question),
    holding: stripHtml(detail.description),
    winningParty: decision.winning_party ?? "",
    decisionType: decision.decision_type ?? "",
    lineupKey: encodeLineup(votes),
    majority: Object.values(votes).filter((s) => s === "M").length,
    minority: Object.values(votes).filter((s) => s === "D").length,
    votes,
    opinions,
    oyezUrl: `https://www.oyez.org/cases/${detail.term}/${detail.docket_number}`,
    justiaUrl: detail.justia_url,
  };
  return { record };
}

/* ---------- bingo (opinion-authorship) parsing ---------- */

// UTC month index → SCOTUS argument sitting. Sittings run Oct–Apr; anything
// else (rare summer reargument, etc.) maps to null and is dropped from the card.
const SITTING_BY_MONTH: (string | null)[] = [
  "January", "February", "March", "April", null, null,
  null, null, null, "October", "November", "December",
];

function sittingOf(iso: string | null): string | null {
  if (!iso) return null;
  return SITTING_BY_MONTH[new Date(`${iso}T00:00:00Z`).getUTCMonth()] ?? null;
}

function timelineDate(detail: OyezCaseDetail, event: string): string | null {
  const ts = detail.timeline?.find((t) => t.event === event)?.dates?.slice(-1)[0];
  return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null;
}

/** The author of the Court's controlling opinion (majority, else plurality). */
function majorityAuthorOf(detail: OyezCaseDetail): string | null {
  const decision = detail.decisions?.find((d) => d.votes && d.votes.length > 0);
  if (!decision?.votes) return null;
  for (const want of ["majority", "plurality"]) {
    const v = decision.votes.find(
      (vote) => vote.opinion_type === want && resolveJustice(vote.member)
    );
    if (v) return resolveJustice(v.member);
  }
  return null;
}

/**
 * Reduce an Oyez case to its bingo-card row. Only argued merits cases qualify
 * (they have an "Argued" timeline event); cert-stage entries return null. A case
 * with no "Decided" date is still pending — that's how Trump v. Cook et al. show
 * up as open cells.
 *
 * We do NOT emit granted-but-unargued cases here: Oyez under-lists (and mis-lists)
 * an upcoming term's grants and files some next-term grants under the current
 * term, so the granted pool is instead sourced from the Court's Granted/Noted
 * list via scripts/build-granted.ts.
 */
export function parseBingoCase(detail: OyezCaseDetail): BingoCase | null {
  // Use the latest sitting the case was heard in: a case set for reargument
  // (often a prior-term holdover) belongs to its reargument sitting, not the
  // original one — e.g. Louisiana v. Callais, argued Mar 2025, reargued Oct 2025.
  const heard = [timelineDate(detail, "Argued"), timelineDate(detail, "Reargued")]
    .filter((d): d is string => !!d)
    .sort();
  const argued = heard.length ? heard[heard.length - 1] : null;
  if (!argued) return null;
  const decided = timelineDate(detail, "Decided");
  return {
    term: detail.term,
    docket: detail.docket_number.trim(),
    name: detail.name,
    argued,
    granted: timelineDate(detail, "Granted"),
    sitting: sittingOf(argued),
    decided,
    majorityAuthor: decided ? majorityAuthorOf(detail) : null,
    oyezUrl: `https://www.oyez.org/cases/${detail.term}/${detail.docket_number}`,
  };
}

/* ---------- scraping ---------- */

export interface TermScrape {
  term: number;
  cases: CaseRecord[];
  skipped: { name: string; reason: string }[];
  /** every argued merits case (decided or pending), for the bingo card */
  bingo: BingoCase[];
}

export async function scrapeTerm(
  term: number,
  log: (msg: string) => void = () => {}
): Promise<TermScrape> {
  const list = await getJson<OyezCaseSummary[]>(
    `${API}/cases?per_page=1000&filter=term:${term}`
  );
  log(`term ${term}: ${list.length} cases listed`);
  const cases: CaseRecord[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const bingo: BingoCase[] = [];
  for (const summary of list) {
    await sleep(FETCH_DELAY_MS);
    try {
      const detail = await getJson<OyezCaseDetail>(summary.href);
      const { record, skipped: reason } = parseCase(detail);
      if (record) cases.push(record);
      else skipped.push({ name: summary.name, reason: reason ?? "?" });
      const bc = parseBingoCase(detail);
      if (bc) bingo.push(bc);
    } catch (e) {
      skipped.push({ name: summary.name, reason: `fetch error: ${e}` });
    }
  }
  log(
    `term ${term}: parsed ${cases.length}, skipped ${skipped.length}, bingo ${bingo.length}`
  );
  return { term, cases, skipped, bingo };
}

/** The term currently in progress (terms start the first Monday of October). */
export function currentTerm(now: Date = new Date()): number {
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 9 ? y : y - 1;
}
