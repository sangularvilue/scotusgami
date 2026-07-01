/**
 * Add the OT2025 signed merits opinions that Oyez hasn't posted vote lineups
 * for yet, as manual overrides (highest merge precedence, survive the daily
 * re-scrape). Every lineup below was hand-read from the opinion's syllabus
 * alignment paragraph on supremecourt.gov (seniority order:
 * Roberts, Thomas, Alito, Sotomayor, Kagan, Gorsuch, Kavanaugh, Barrett, Jackson).
 *
 * Per-curiam / emergency-docket orders are intentionally excluded — SCDB and the
 * SCOTUSblog StatPack exclude them from merits analysis, so including them here
 * would skew the (already provisional) term. When SCDB releases OT2025 these
 * manual entries should be removed so SCDB becomes authoritative.
 *
 * Usage: npx tsx scripts/add-ot2025-missing.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
try { for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
import { encodeLineup } from "../lib/grid";
import { SENIORITY_IDS } from "../lib/justices";
import type { CaseRecord, Side } from "../lib/types";

// docket, name, decided, majorityAuthor id, lineup (seniority order)
const CASES: [string, string, string, string, string][] = [
  ["24-43",  "West Virginia v. B. P. J.",                                 "2026-06-30", "brett_m_kavanaugh",   "MMMDDMMMD"], // Kavanaugh; Soto/Kagan/Jackson concur in judgment in part & dissent in part → dissent side (6-3)
  ["24-621", "National Republican Senatorial Committee v. FEC",           "2026-06-30", "brett_m_kavanaugh",   "MMMDDMMMD"], // Kagan dissent w/ Soto, Jackson (6-3)
  ["25-365", "Trump v. Barbara",                                          "2026-06-30", "john_g_roberts_jr",   "MDDMMDMMM"], // Roberts; Kavanaugh concurs in judgment (M); Thomas/Alito/Gorsuch dissent (6-3)
  ["24-1260","Watson v. Republican National Committee",                   "2026-06-29", "amy_coney_barrett",   "MDDMMDDMM"], // Barrett; Alito dissent w/ Thomas,Gorsuch, & Kavanaugh (all but 2 parts) → 5-4
  ["25-112", "Chatrie v. United States",                                  "2026-06-29", "elena_kagan",         "MDDMMMMDM"], // Kagan; Gorsuch concurs in judgment (M); Alito/Thomas/Barrett dissent (6-3)
  ["25A312", "Trump v. Cook",                                             "2026-06-29", "john_g_roberts_jr",   "MDDMMDMDM"], // Roberts (stay denied); Thomas/Alito/Gorsuch/Barrett dissent (5-4)
  ["25-332", "Trump v. Slaughter",                                        "2026-06-29", "john_g_roberts_jr",   "MMMDDMMMD"], // Roberts (Thomas joins all but III-B → M); Soto/Kagan/Jackson dissent (6-3)
  ["24-1068","Monsanto Co. v. Durnell",                                   "2026-06-25", "brett_m_kavanaugh",   "MMMMMDMMD"], // Kavanaugh; Jackson dissent w/ Gorsuch (7-2)
  ["25-1083","Mullin v. Doe",                                             "2026-06-25", "samuel_a_alito_jr",   "MMMDDMMMD"], // Alito (judgment; III-A plurality); Kagan dissent w/ Soto,Jackson (6-3)
  ["25-5",   "Mullin v. Al Otro Lado",                                    "2026-06-25", "samuel_a_alito_jr",   "MMMDDMMMD"], // Alito; Soto dissent w/ Kagan,Jackson (6-3)
  ["24-1046","Wolford v. Lopez",                                          "2026-06-25", "samuel_a_alito_jr",   "MMMDDMMMD"], // Alito; Kagan dissent; Jackson dissent w/ Soto (6-3)
  ["24-856", "Cisco Systems, Inc. v. Doe",                                "2026-06-23", "amy_coney_barrett",   "MMMDDMMMD"], // Barrett; Soto dissent + Jackson concur-in-part/dissent-in-part + Kagan → dissent (6-3)
  ["24-699", "Exxon Mobil Corp. v. Corporación Cimex, S. A.",             "2026-06-23", "brett_m_kavanaugh",   "MMMDDMMMD"], // Kavanaugh; Kagan dissent w/ Soto,Jackson (6-3)
  ["25-95",  "Pung v. Isabella County",                                   "2026-06-23", "samuel_a_alito_jr",   "MMMMMMMMM"], // Alito; unanimous (Thomas concurs in part & in judgment) 9-0
  ["25-429", "Blanche v. Lau",                                            "2026-06-23", "clarence_thomas",     "MMMDDMMMD"], // Thomas; Jackson dissent w/ Soto,Kagan (6-3)
  ["24-983", "Havana Docks Corp. v. Royal Caribbean Cruises, Ltd.",       "2026-05-21", "clarence_thomas",     "MMMMDMMMM"], // Thomas; Kagan dissent alone (8-1)
  ["25-83",  "Jules v. Andre Balazs Properties",                          "2026-05-14", "sonia_sotomayor",     "MMMMMMMMM"], // Sotomayor for a unanimous Court (9-0)
];

(async () => {
  const { upsertManual, loadManual } = await import("../lib/redis");
  for (const [docket, name, decided, author, key] of CASES) {
    if (key.length !== 9) throw new Error(`${docket} bad lineup ${key}`);
    const votes: Record<string, Side> = {};
    SENIORITY_IDS.forEach((id, i) => (votes[id] = key[i] as Side));
    if (votes[author] !== "M") throw new Error(`${docket}: author ${author} not in majority`);
    const maj = key.split("").filter((c) => c === "M").length;
    const min = key.split("").filter((c) => c === "D").length;
    const rec: CaseRecord = {
      term: "2025", docket, name, decided,
      question: "", holding: "", winningParty: "",
      decisionType: "", lineupKey: encodeLineup(votes), majority: maj, minority: min, votes,
      opinions: [{ type: "majority", author, joinedBy: SENIORITY_IDS.filter((id) => id !== author && votes[id] === "M") }],
      oyezUrl: `https://www.oyez.org/cases/2025/${docket}`, justiaUrl: null, source: "manual",
    };
    await upsertManual(rec);
    console.log(`+ ${docket.padEnd(7)} ${maj}-${min}  ${encodeLineup(votes)}  ${name}`);
  }
  console.log(`\nmanual store now holds ${(await loadManual()).length} records`);
})();
