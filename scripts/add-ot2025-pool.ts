/**
 * Add the current term (OT2025) to the game pool.
 *
 * The pool that the Immaculate Bench game plays over comes from the Supreme
 * Court Database, whose latest release stops at OT2024 — so until SCDB
 * publishes again, nothing decided in OT2025 is guessable, and clues like
 * "Overturned a prior precedent" have no modern answers (Trump v. Slaughter
 * being the obvious one). This script fills that gap from the records the
 * board already uses: `loadAllCases()` (Oyez scrape + /admin manual
 * corrections), re-shaped into SCDB-style PoolCase rows.
 *
 * What comes from the data, and what does not:
 *   votes / margin / author / era   — from the records; exact.
 *   fame + notable                  — Wikipedia article match + pageviews,
 *                                     the same criterion notable-fame.ts uses.
 *   issueArea / issue / parties     — hand-coded below from each case's
 *                                     question presented, using code values
 *                                     calibrated against close SCDB analogues
 *                                     already in the pool (e.g. Geders → 1 /
 *                                     10120 for Villarreal). Left null where
 *                                     the subject matter isn't clear; null
 *                                     simply means the case never answers that
 *                                     clue, so a gap is harmless, a guess isn't.
 *   disposition                     — derived from Oyez's winning party
 *                                     (petitioner won → reversed, respondent
 *                                     won → affirmed), or hand-coded.
 *   direction                       — always null. SCDB's liberal/conservative
 *                                     coding has rules that cut against
 *                                     intuition (a First Amendment win is
 *                                     "liberal" even for a conservative
 *                                     litigant), so guessing it would put
 *                                     wrong answers behind the two Direction
 *                                     clues. OT2025 sits those out.
 *
 * Idempotent: replaces any rows it wrote before (id prefix `ot2025-`) and
 * leaves every SCDB row untouched.
 *
 * Usage (from project root): npx tsx --env-file=.env.local scripts/add-ot2025-pool.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAllCases } from "../lib/redis";
import type { CaseRecord } from "../lib/types";
import type { PoolCase, Side } from "../lib/game-types";

const TERM = 2025;
const ID_PREFIX = "ot2025-";
/** SCDB naturalCourt for the Roberts–Jackson bench (matches OT2022–24 rows). */
const NATURAL_COURT = 1710;

/** Oyez member identifier → SCDB justiceName (the pool's vote keys). */
const SCDB_NAME: Record<string, string> = {
  john_g_roberts_jr: "JGRoberts",
  clarence_thomas: "CThomas",
  samuel_a_alito_jr: "SAAlito",
  sonia_sotomayor: "SSotomayor",
  elena_kagan: "EKagan",
  neil_gorsuch: "NMGorsuch",
  brett_m_kavanaugh: "BMKavanaugh",
  amy_coney_barrett: "ACBarrett",
  ketanji_brown_jackson: "KBJackson",
};

interface Meta {
  area?: number; // SCDB issueArea
  issue?: number; // SCDB granular issue
  pet?: number; // SCDB petitioner code (27 = United States, 28 = State)
  resp?: number; // SCDB respondent code
  disp?: number; // SCDB caseDisposition, when the winner heuristic can't say
  prec?: boolean; // this decision overruled an earlier one
}

/**
 * Hand-coded SCDB-style metadata, keyed by docket. Subject matter is from each
 * case's question presented; code values follow the closest analogue already in
 * the pool. `prec` is from Wikipedia's list of overruled decisions, which
 * records exactly two for OT2025: Slaughter (Humphrey's Executor) and NRSC
 * (FEC v. Colorado Republican).
 */
const META: Record<string, Meta> = {
  // ---- argued merits cases ----
  "24-5438": { area: 1, issue: 10020, resp: 27 }, // Bowe — successive §2255
  "24-568": { area: 9 }, // Bost — Article III standing
  "24-5774": { area: 1, resp: 27 }, // Barrett — §924(c)/(j) multiplicity
  "24-624": { area: 1, issue: 10050, resp: 28 }, // Case v. Montana — warrantless entry
  "24-440": { area: 9, issue: 90110 }, // Berk v. Choy — Erie / FRCP
  "24-482": { area: 1, resp: 27 }, // Ellingburg — ex post facto restitution
  "24-808": { area: 9 }, // Coney Island — Rule 60(c)(1)
  "24-1287": { area: 8 }, // Learning Resources — IEEPA tariffs
  "24-351": { area: 8, issue: 80060, disp: 3 }, // USPS v. Konan — FTCA postal exception
  "24-724": { area: 9 }, // Hain Celestial — diversity jurisdiction
  "24-557": { area: 1, issue: 10120, resp: 28 }, // Villarreal — Geders / counsel at recess
  "24-758": { area: 9 }, // GEO Group — collateral-order doctrine
  "24-1021": { area: 8, issue: 80060 }, // Galette — interstate sovereign immunity
  "24-777": { area: 2, issue: 20310 }, // Urias-Orellana — asylum "persecution"
  "24-993": { area: 2, issue: 20400 }, // Olivier — Heck v. Humphrey / §1983
  "24-1056": { area: 1, issue: 10560, resp: 27 }, // Rico — supervised release
  "24-171": { area: 8, issue: 80190 }, // Cox v. Sony — copyright
  "24-539": { area: 3, issue: 30010 }, // Chiles — free speech
  "24-813": { area: 9 }, // Chevron v. Plaquemines — federal officer removal
  "24-783": { area: 9 }, // Enbridge — §1446(b)(1) removal deadline
  "24-924": { area: 8, issue: 80060 }, // Hencely — Boyle contractor defense
  "24-109": { area: 2, issue: 20010, pet: 28 }, // Louisiana v. Callais — racial gerrymandering
  "24-781": { area: 9 }, // First Choice — ripeness of a federal challenge
  "24-1238": { area: 8 }, // Montgomery — FAAAA preemption
  "25-83": { area: 9 }, // Jules — post-arbitration FAA jurisdiction
  "23-1209": { area: 8, issue: 80090 }, // M & K — ERISA withdrawal liability
  "24-872": { area: 1, disp: 9 }, // Hamm v. Smith — Atkins; DIG'd
  "24-983": { area: 8 }, // Havana Docks — Helms-Burton Title III
  "24-556": { area: 1, issue: 10560, resp: 27 }, // Fernandez — §3582 vs §2255
  "24-7351": { area: 1, issue: 10020 }, // Pitchford — Batson on AEDPA habeas
  "24-820": { area: 1, issue: 10560, resp: 27 }, // Rutherford — compassionate release
  "24-935": { area: 7, issue: 70010 }, // Flowers Foods — FAA §1 exemption
  "24-889": { area: 8, issue: 80180 }, // Hikma — induced patent infringement
  "25-406": { area: 8, issue: 80120 }, // FCC v. AT&T — agency forfeitures, 7th Am.
  "25-466": { area: 8, issue: 80120 }, // Sripetch — SEC disgorgement
  "24-345": { area: 8 }, // FS Credit — implied right of action, ICA §47(b)
  "25-5146": { area: 1, resp: 27 }, // Abouammo — criminal venue
  "25-6": { area: 9 }, // Keathley — judicial estoppel
  "24-1063": { area: 1, resp: 27 }, // Hunter — appeal waivers
  "24-1234": { area: 1, issue: 10600, pet: 27 }, // Hemani — §922(g)(3), 2nd Am.
  "25-197": { area: 9 }, // T. M. — Rooker-Feldman
  "23-1197": { area: 3, issue: 30160 }, // Landor — RLUIPA damages
  "24-699": { area: 9 }, // Exxon v. Cimex — FSIA / Helms-Burton
  "24-856": { area: 9, issue: 90230 }, // Cisco v. Doe — Alien Tort Statute
  "25-429": { area: 2, issue: 20310 }, // Blanche v. Lau — INA admission
  "25-95": { area: 4, issue: 40070 }, // Pung — takings, tax-foreclosure surplus
  "24-1046": { area: 1, issue: 10600 }, // Wolford v. Lopez — 2nd Am. carry
  "24-1068": { area: 8 }, // Monsanto — FIFRA preemption
  "25-1083": { area: 2, issue: 20310 }, // Mullin v. Doe — TPS review bar
  "25-5": { area: 2, issue: 20310 }, // Al Otro Lado — "arrives in the United States"
  "24-1260": { area: 2, issue: 20010 }, // Watson v. RNC — late-arriving ballots
  "25-112": { area: 1, issue: 10050, resp: 27 }, // Chatrie — geofence warrants
  "25-332": { area: 13, issue: 130015, prec: true }, // Trump v. Slaughter — FTC removal
  "25A312": { area: 13, issue: 130015 }, // Trump v. Cook — Fed removal (emergency)
  "24-43": { area: 2, issue: 20140, pet: 28 }, // West Virginia v. B. P. J.
  "24-621": { area: 3, issue: 30140, prec: true }, // NRSC v. FEC — coordinated spending
  "25-365": { area: 2 }, // Trump v. Barbara — birthright citizenship
  "25A1314": { area: 2, issue: 20010 }, // Allen v. Milligan — VRA §2 (emergency)
  // Stay grants (disposition 1) resolved on standing, like Bost:
  "26A124": { area: 9, resp: 28, disp: 1 }, // Trump v. California — States' standing
  "26A203": { area: 9, disp: 1 }, // NPS v. National Trust — East Wing, Article III

  // ---- per curiams (subject matter from the Court's opinions) ----
  "24-1159": { area: 1, resp: 28, disp: 3 }, // Pitts — Confrontation Clause
  "25-52": { area: 1, issue: 10020, disp: 3 }, // Clark v. Sweeney — party presentation
  "25-180": { area: 10, disp: 3 }, // Doe v. Dynamic PT — state immunity, federal claim
  "25-51": { area: 1, issue: 10020, disp: 3 }, // Klein v. Martin — Brady on AEDPA habeas
  "25A810": { area: 3, issue: 30160 }, // Mirabelli v. Bonta — free exercise (emergency)
  "25-297": { area: 2, disp: 3 }, // Zorn v. Linton — qualified immunity
  "25-248": { area: 1, issue: 10050, disp: 3 }, // D. C. v. R. W. — reasonable suspicion
  "25-767": { area: 9, disp: 3 }, // Margolin v. NAIJ — party presentation
  "25-580": { area: 1, issue: 10020, disp: 5 }, // Whitton v. Dixon — harmless error
  "25-748": { area: 1, issue: 10020, disp: 3 }, // McCarthy v. Hernandez — AEDPA
};

/* ---------- Wikipedia (notability + fame) ---------- */
// Notability is the same test notable-fame.ts applies to recent terms: does the
// term's opinion list carry a blue link (a real article) for this case? Two page
// fetches instead of 61 search queries — the search API rate-limits anonymous
// callers hard enough that per-case lookups come back empty.

const UA = {
  headers: { "User-Agent": "scotusgami.grannis.xyz (fame scoring; personal project)" },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TERM_PAGES = [
  `https://en.wikipedia.org/wiki/${TERM}_term_opinions_of_the_Supreme_Court_of_the_United_States`,
  `https://en.wikipedia.org/wiki/${TERM}_term_per_curiam_opinions_of_the_Supreme_Court_of_the_United_States`,
];

async function getText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) await sleep(Math.min(60000, 5000 * 2 ** (attempt - 1)));
    const res = await fetch(url, UA);
    if (res.ok) return await res.text();
    if (res.status === 404) return null;
    console.log(`  [${res.status}] retry ${attempt + 1} ${url.slice(0, 72)}…`);
  }
  return null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const t = await getText(url);
  return t ? (JSON.parse(t) as T) : null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * (decided date → article titles) from the term-opinions table. Each row is one
 * decision: a blue link to its article (redlinks — cases with no article — have
 * a query string in the href and so don't match) and the argued/decided dates,
 * the decided date being the last one in the row. Keying on the date rather
 * than the name is what makes the join survive Wikipedia and Oyez disagreeing
 * about a caption ("v. Davenport" vs "v. Platkin", "FCC" vs the full agency
 * name, initials like "B. P. J." that no name heuristic can match).
 */
function parseTermPage(html: string): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  for (const row of html.split("<tr")) {
    const link = row.match(
      /href="(?:https:\/\/en\.wikipedia\.org)?\/wiki\/([^"#?:]+)"[^>]*title="([^"]*\sv\.\s[^"]*)"/
    );
    if (!link) continue;
    const title = decodeURIComponent(link[1]).replace(/_/g, " ");
    if (!title.includes(" v. ") || title.startsWith("List of")) continue;
    const dates = [...row.matchAll(/([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4})/g)];
    const last = dates[dates.length - 1];
    if (!last) continue;
    const month = MONTHS.indexOf(last[1]);
    if (month < 0) continue;
    const iso = `${last[3]}-${String(month + 1).padStart(2, "0")}-${last[2].padStart(2, "0")}`;
    byDate.set(iso, [...(byDate.get(iso) ?? []), title]);
  }
  return byDate;
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

async function pageviews(title: string): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 86400000);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const data = await getJson<{ items?: { views: number }[] }>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/daily/${yyyymmdd(start)}/${yyyymmdd(end)}`
  );
  return (data?.items ?? []).reduce((s, i) => s + i.views, 0);
}

/* ---------- shaping ---------- */

const lead = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ].*$/, "").trim().split(/\s+/)[0] ?? "";

const words = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/**
 * The article for a case decided on `date`. One article that day is the answer;
 * on a busy hand-down day, the one sharing the most words with the caption.
 */
function matchTitle(
  byDate: Map<string, string[]>,
  date: string,
  name: string,
  used: Set<string>
): string | null {
  const mine = new Set(words(name));
  let best: string | null = null;
  let bestScore = 0;
  for (const t of byDate.get(date) ?? []) {
    if (used.has(t)) continue;
    const score = words(t).filter((w) => mine.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (best) used.add(best); // one article per case, even on a busy hand-down day
  return best;
}

/**
 * Reversed (3) / affirmed (2) from who won: a petitioner win means the
 * judgment below came out the other way. Null when the winner string doesn't
 * clearly belong to either side — better a missing clue than a wrong one.
 */
function dispositionFrom(name: string, winner: string): number | null {
  if (!winner) return null;
  const [pet, resp] = name.split(/\s+v\.?\s+/i);
  if (!pet || !resp) return null;
  const w = winner.toLowerCase();
  const petHit = lead(pet).length > 2 && w.includes(lead(pet));
  const respHit = lead(resp).length > 2 && w.includes(lead(resp));
  if (petHit === respHit) return null; // neither, or ambiguous
  return petHit ? 3 : 2;
}

function toPoolCase(rec: CaseRecord, fame: number, notable: boolean): PoolCase {
  const docket = rec.docket.trim();
  const meta = META[docket] ?? {};

  const votes: Record<string, Side> = {};
  for (const j of Object.values(SCDB_NAME)) votes[j] = "A"; // not listed → took no part
  for (const [oyezId, side] of Object.entries(rec.votes)) {
    const name = SCDB_NAME[oyezId];
    if (name) votes[name] = side as Side;
  }
  const sides = Object.values(votes);

  const author = rec.opinions?.find((o) => o.type === "majority")?.author;

  return {
    id: ID_PREFIX + docket,
    name: rec.name.trim(),
    term: TERM,
    decided: rec.decided,
    usCite: "", // U.S. Reports pagination not assigned yet for most of OT2025
    naturalCourt: NATURAL_COURT,
    chief: "Roberts",
    votes,
    maj: sides.filter((s) => s === "M").length,
    min: sides.filter((s) => s === "D").length,
    majWriter: (author && SCDB_NAME[author]) || null, // per curiam → null
    issueArea: meta.area ?? null,
    issue: meta.issue ?? null,
    direction: null, // see header note
    disposition: meta.disp ?? dispositionFrom(rec.name, rec.winningParty ?? ""),
    petitioner: meta.pet ?? null,
    respondent: meta.resp ?? null,
    overruledPrecedent: meta.prec === true,
    overruled: false,
    notable,
    fame,
  };
}

async function main() {
  const records = (await loadAllCases()).filter((c) => Number(c.term) === TERM);
  // one row per docket; prefer the record that carries opinion data
  const byDocket = new Map<string, CaseRecord>();
  for (const r of records) {
    const k = r.docket.trim();
    const prev = byDocket.get(k);
    if (!prev || (prev.opinions?.length ?? 0) < (r.opinions?.length ?? 0)) {
      byDocket.set(k, r);
    }
  }
  console.log(`OT${TERM}: ${byDocket.size} cases from Redis`);

  const byDate = new Map<string, string[]>();
  for (const url of TERM_PAGES) {
    const html = await getText(url);
    if (!html) continue;
    for (const [date, titles] of parseTermPage(html)) {
      byDate.set(date, [...new Set([...(byDate.get(date) ?? []), ...titles])]);
    }
  }
  const articleN = [...byDate.values()].reduce((n, t) => n + t.length, 0);
  console.log(`wikipedia: ${articleN} case articles linked from the term pages`);

  const used = new Set<string>();
  const added: PoolCase[] = [];
  for (const rec of byDocket.values()) {
    const title = matchTitle(byDate, rec.decided, rec.name, used);
    const fame = title ? await pageviews(title) : 0;
    added.push(toPoolCase(rec, fame, title !== null));
    console.log(
      `  ${rec.docket.trim().padEnd(8)} ${rec.name.slice(0, 44).padEnd(44)} ` +
        `${title ? `notable, fame ${fame}` : "no article"}`
    );
    if (title) await sleep(1500);
  }

  const poolPath = join(process.cwd(), "data", "pool.json");
  const pool = JSON.parse(readFileSync(poolPath, "utf8")) as PoolCase[];
  const kept = pool.filter((c) => !c.id.startsWith(ID_PREFIX));
  const next = [...kept, ...added].sort((a, b) => a.decided.localeCompare(b.decided));
  writeFileSync(poolPath, JSON.stringify(next));

  const notableN = added.filter((c) => c.notable).length;
  console.log(
    `pool: ${pool.length} → ${next.length} (replaced ${pool.length - kept.length}, ` +
      `added ${added.length}; ${notableN} notable)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
