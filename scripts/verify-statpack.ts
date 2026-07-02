/**
 * One-off: verify the site's OT2025 case data against the SCOTUSblog
 * Final Stat Pack for the 2025-26 term (June 30, 2026).
 *
 *   npx tsx scripts/verify-statpack.ts
 *
 * Ground truth below is the Voting Alignments table (Stat Pack pp. 20-22):
 * 66 opinions of the Court = 56 signed + 10 per curiam.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

import { loadTerm, loadManual } from "../lib/redis";
import type { CaseRecord } from "../lib/types";

// [abbrev, name substrings to match (lowercased, any-of), decided, "maj-min", author last name or PC]
const STATPACK: [string, string[], string, string, string][] = [
  ["Clark", ["clark"], "2025-11-24", "9-0", "PC"],
  ["Pitts", ["pitts"], "2025-11-24", "9-0", "PC"],
  ["DynamicPT", ["dynamic"], "2025-12-08", "9-0", "PC"],
  ["Bowe", ["bowe"], "2026-01-09", "5-4", "sotomayor"],
  ["Barrett", ["barrett v"], "2026-01-14", "9-0", "jackson"],
  ["Bost", ["bost"], "2026-01-14", "7-2", "roberts"],
  ["Case", ["case v"], "2026-01-14", "9-0", "kagan"],
  ["Berk", ["berk"], "2026-01-20", "9-0", "barrett"],
  ["ConeyIslandAuto", ["coney"], "2026-01-20", "9-0", "alito"],
  ["Ellingburg", ["ellingburg"], "2026-01-20", "9-0", "kavanaugh"],
  ["Klein", ["klein"], "2026-01-26", "8-1", "PC"],
  ["LearningResources", ["learning"], "2026-02-20", "6-3", "roberts"],
  ["HainCelestial", ["hain"], "2026-02-24", "9-0", "sotomayor"],
  ["USPS", ["konan", "usps", "postal"], "2026-02-24", "5-4", "thomas"],
  ["GEOGroup", ["geo group", "menocal"], "2026-02-25", "9-0", "kagan"],
  ["Villarreal", ["villarreal"], "2026-02-25", "9-0", "jackson"],
  ["Galette", ["galette"], "2026-03-04", "9-0", "sotomayor"],
  ["Urias-Orellana", ["urias"], "2026-03-04", "9-0", "jackson"],
  ["Olivier", ["olivier"], "2026-03-20", "9-0", "kagan"],
  ["Zorn", ["zorn"], "2026-03-23", "6-3", "PC"],
  ["Cox", ["cox"], "2026-03-25", "9-0", "thomas"],
  ["Rico", ["rico v"], "2026-03-25", "8-1", "gorsuch"],
  ["Chiles", ["chiles"], "2026-03-31", "8-1", "gorsuch"],
  ["PlaqueminesParish", ["plaquemines"], "2026-04-17", "8-0", "thomas"],
  ["R.W.", ["r.w.", "r. w."], "2026-04-20", "7-2", "PC"],
  ["Enbridge", ["enbridge"], "2026-04-22", "9-0", "sotomayor"],
  ["Hencely", ["hencely"], "2026-04-22", "6-3", "thomas"],
  ["FirstChoice", ["first choice"], "2026-04-29", "9-0", "gorsuch"],
  ["Callais", ["callais"], "2026-04-29", "6-3", "alito"],
  ["Jules", ["jules"], "2026-05-14", "9-0", "sotomayor"],
  ["Montgomery", ["montgomery"], "2026-05-14", "9-0", "barrett"],
  ["HavanaDocks", ["havana"], "2026-05-21", "8-1", "thomas"],
  ["IAMPensionFund", ["employee solutions", "iam national"], "2026-05-21", "9-0", "jackson"],
  ["Hamm", ["hamm"], "2026-05-21", "5-4", "PC"],
  ["Margolin", ["margolin"], "2026-05-26", "9-0", "PC"],
  ["FlowersFoods", ["flowers"], "2026-05-28", "9-0", "gorsuch"],
  ["Pitchford", ["pitchford"], "2026-05-28", "5-4", "kavanaugh"],
  ["Fernandez", ["fernandez"], "2026-05-28", "8-1", "barrett"],
  ["Rutherford", ["rutherford"], "2026-05-28", "6-3", "barrett"],
  ["Whitton", ["whitton"], "2026-06-01", "7-2", "PC"],
  ["AT&T", ["at&t", "at & t"], "2026-06-04", "8-1", "roberts"],
  ["Sripetch", ["sripetch"], "2026-06-04", "9-0", "gorsuch"],
  ["Hikma", ["hikma"], "2026-06-04", "9-0", "jackson"],
  ["Abouammo", ["abouammo"], "2026-06-11", "9-0", "kagan"],
  ["FSCredit", ["fs credit"], "2026-06-11", "6-3", "barrett"],
  ["Keathley", ["keathley"], "2026-06-11", "9-0", "jackson"],
  ["Hemani", ["hemani"], "2026-06-18", "9-0", "gorsuch"],
  ["Hunter", ["hunter"], "2026-06-18", "8-1", "kagan"],
  ["UMDMedical", ["t.m.", "maryland medical", "md medical"], "2026-06-18", "5-4", "sotomayor"],
  ["McCarthy", ["mccarthy"], "2026-06-22", "6-3", "PC"],
  ["Cisco", ["cisco"], "2026-06-23", "6-3", "barrett"],
  ["Exxon", ["exxon"], "2026-06-23", "6-3", "kavanaugh"],
  ["Landor", ["landor"], "2026-06-23", "6-3", "gorsuch"],
  ["Pung", ["pung"], "2026-06-23", "9-0", "alito"],
  ["Lau", ["v. lau", "blanche"], "2026-06-23", "6-3", "thomas"],
  ["Monsanto", ["monsanto"], "2026-06-25", "7-2", "kavanaugh"],
  ["Wolford", ["wolford"], "2026-06-25", "6-3", "alito"],
  ["AlOtroLado", ["al otro"], "2026-06-25", "6-3", "alito"],
  ["Mullin.v.Doe", ["mullin v. doe", "doe"], "2026-06-25", "6-3", "alito"],
  ["Watson", ["watson"], "2026-06-29", "5-4", "barrett"],
  ["Chatrie", ["chatrie"], "2026-06-29", "6-3", "kagan"],
  ["Cook", ["cook"], "2026-06-29", "5-4", "roberts"],
  ["Slaughter", ["slaughter"], "2026-06-29", "6-3", "roberts"],
  ["B.P.J.", ["b.p.j.", "b. p. j.", "hecox"], "2026-06-30", "6-3", "kavanaugh"],
  ["NRSC", ["nrsc", "republican senatorial"], "2026-06-30", "6-3", "kavanaugh"],
  ["Barbara", ["barbara"], "2026-06-30", "6-3", "roberts"],
];

function majorityAuthor(c: CaseRecord): string {
  const op = c.opinions.find((o) => /majority|plurality/i.test(o.type));
  return (op?.author ?? "").toLowerCase();
}

async function main() {
  const [oyez, manual] = await Promise.all([loadTerm(2025), loadManual()]);
  const byKey = new Map(oyez.map((c) => [`${c.term}:${c.docket}`, c]));
  for (const m of manual) if (m.term === "2025") byKey.set(`${m.term}:${m.docket}`, m);
  const cases = [...byKey.values()].sort((a, b) => a.decided.localeCompare(b.decided));

  console.log(`site OT2025 cases: ${cases.length}\n`);

  const matched = new Set<CaseRecord>();
  let problems = 0;
  for (const [abbrev, subs, decided, vote, author] of STATPACK) {
    const cands = cases.filter((c) => {
      const n = c.name.toLowerCase();
      return subs.some((s) => n.includes(s)) && !matched.has(c);
    });
    // prefer same decided date if multiple name hits
    const hit = cands.find((c) => c.decided === decided) ?? cands[0];
    if (!hit) {
      console.log(`MISSING   ${abbrev}  (${decided} ${vote} ${author})`);
      problems++;
      continue;
    }
    matched.add(hit);
    const issues: string[] = [];
    if (hit.decided !== decided) issues.push(`decided ${hit.decided} != ${decided}`);
    const siteVote = `${hit.majority}-${hit.minority}`;
    if (siteVote !== vote) issues.push(`vote ${siteVote} != ${vote}`);
    const siteAuthor = majorityAuthor(hit);
    const authorOk =
      author === "PC"
        ? /curiam/.test(siteAuthor) || /per curiam/i.test(hit.decisionType)
        : siteAuthor.includes(author);
    if (!authorOk) issues.push(`author "${siteAuthor}"/"${hit.decisionType}" != ${author}`);
    if (issues.length) {
      console.log(`MISMATCH  ${abbrev}  [${hit.docket}] ${hit.name}`);
      for (const i of issues) console.log(`          - ${i}`);
      problems++;
    }
  }

  const extras = cases.filter((c) => !matched.has(c));
  if (extras.length) {
    console.log(`\nsite-only cases (not in Stat Pack's 66) — expected for emergency orders:`);
    for (const c of extras)
      console.log(
        `  [${c.docket}] ${c.name}  ${c.decided}  ${c.majority}-${c.minority}  src=${c.source ?? "oyez"}`
      );
  }

  const unan = cases.filter((c) => c.minority === 0).length;
  console.log(`\nsummary: ${STATPACK.length} statpack cases, ${problems} problems`);
  console.log(
    `site unanimity (all ${cases.length} cases incl. extras): ${unan}/${cases.length} = ${((100 * unan) / cases.length).toFixed(1)}%`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
