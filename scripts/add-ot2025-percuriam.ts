/**
 * Add OT2025's ten per curiam opinions of the Court as manual overrides.
 *
 * The final SCOTUSblog Stat Pack (June 30, 2026) counts 66 opinions of the
 * Court: 56 signed + 10 per curiam, and includes the per curiams in its
 * unanimity and vote-split figures — as does SCDB (see e.g. TikTok and
 * Hamm v. Smith in supplement-2024.json). The earlier assumption that they
 * belonged out of the merits set (add-ot2025-missing.ts header) was wrong.
 *
 * Lineups below are from the Stat Pack's Voting Alignments table (pp. 20-22)
 * and its notes; seniority order: Roberts, Thomas, Alito, Sotomayor, Kagan,
 * Gorsuch, Kavanaugh, Barrett, Jackson. Per curiam records carry no majority
 * entry in `opinions` (matching the SCDB supplement shape) — only separate
 * opinions. Remove all OT2025 manual records once SCDB covers the term.
 *
 * Usage: npx tsx scripts/add-ot2025-percuriam.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
try { for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
import { encodeLineup } from "../lib/grid";
import { SENIORITY_IDS } from "../lib/justices";
import type { CaseRecord, OpinionInfo, Side } from "../lib/types";

// docket, name, decided, lineup (seniority order), separate opinions
const CASES: [string, string, string, string, OpinionInfo[]][] = [
  ["25-52",   "Clark v. Sweeney",                    "2025-11-24", "MMMMMMMMM", []],
  ["24-1159", "Pitts v. Mississippi",                "2025-11-24", "MMMMMMMMM", []],
  ["25-180",  "Doe v. Dynamic Physical Therapy, LLC","2025-12-08", "MMMMMMMMM", []],
  // Jackson would deny the petition (no opinion) → 8-1
  ["25-51",   "Klein v. Martin",                     "2026-01-26", "MMMMMMMMD", []],
  // Sotomayor dissent, joined by Kagan and Jackson → 6-3
  ["25-297",  "Zorn v. Linton",                      "2026-03-23", "MMMDDMMMD",
    [{ type: "dissent", author: "sonia_sotomayor", joinedBy: ["elena_kagan", "ketanji_brown_jackson"] }]],
  // Jackson dissent; Sotomayor would deny the petition → 7-2
  ["25-248",  "District of Columbia v. R.W.",        "2026-04-20", "MMMDMMMMD",
    [{ type: "dissent", author: "ketanji_brown_jackson", joinedBy: [] }]],
  // DIG'd 5-4: Alito dissent (Roberts & Gorsuch join Parts I, III, IV), Thomas dissent
  ["24-872",  "Hamm v. Smith",                       "2026-05-21", "DDDMMDMMM",
    [{ type: "dissent", author: "samuel_a_alito_jr", joinedBy: ["john_g_roberts_jr", "neil_gorsuch"] },
     { type: "dissent", author: "clarence_thomas", joinedBy: [] }]],
  // Thomas concurrence → 9-0
  ["25-767",  "Margolin v. NAIJ",                    "2026-05-26", "MMMMMMMMM",
    [{ type: "concurrence", author: "clarence_thomas", joinedBy: [] }]],
  // Thomas dissent, Alito joins except Part III-B → 7-2
  ["25-580",  "Whitton v. Dixon",                    "2026-06-01", "MDDMMMMMM",
    [{ type: "dissent", author: "clarence_thomas", joinedBy: ["samuel_a_alito_jr"] }]],
  // Sotomayor, Kagan, and Jackson would deny the petition (no opinion) → 6-3
  ["25-748",  "McCarthy v. Hernandez",               "2026-06-22", "MMMDDMMMD", []],
];

(async () => {
  const { upsertManual, loadManual } = await import("../lib/redis");
  for (const [docket, name, decided, key, opinions] of CASES) {
    if (key.length !== 9) throw new Error(`${docket} bad lineup ${key}`);
    const votes: Record<string, Side> = {};
    SENIORITY_IDS.forEach((id, i) => (votes[id] = key[i] as Side));
    for (const op of opinions) {
      const side = op.type === "dissent" ? "D" : "M";
      for (const j of [op.author, ...op.joinedBy])
        if (votes[j] !== side && op.type === "dissent")
          throw new Error(`${docket}: ${j} on ${op.type} but voted ${votes[j]}`);
    }
    const maj = key.split("").filter((c) => c === "M").length;
    const min = key.split("").filter((c) => c === "D").length;
    const rec: CaseRecord = {
      term: "2025", docket, name, decided,
      question: "", holding: "", winningParty: "",
      decisionType: "per curiam", lineupKey: encodeLineup(votes), majority: maj, minority: min, votes,
      opinions,
      oyezUrl: `https://www.oyez.org/cases/2025/${docket}`, justiaUrl: null, source: "manual",
    };
    await upsertManual(rec);
    console.log(`+ ${docket.padEnd(8)} ${maj}-${min}  ${encodeLineup(votes)}  ${name}`);
  }
  console.log(`\nmanual store now holds ${(await loadManual()).length} records`);
})();
