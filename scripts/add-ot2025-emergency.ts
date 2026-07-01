/**
 * Add OT2025 emergency-docket ("A") orders as manual overrides, per Will's rule:
 * where the full vote is known, record it; where only dissents (etc.) are named,
 * named dissenters get D, justices known to be in the majority get M, and anyone
 * whose vote isn't stated gets A (0 / unknown). Lineups hand-read from the orders.
 * (Trump v. Cook, 25A312, was a full signed 5-4 opinion — added separately.)
 *
 * Usage: npx tsx scripts/add-ot2025-emergency.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
try { for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
import { encodeLineup } from "../lib/grid";
import { SENIORITY_IDS } from "../lib/justices";
import type { CaseRecord, Side } from "../lib/types";

// docket, name, decided, lineup (seniority order R,T,A,So,Ka,Go,Kv,Ba,Ja)
const CASES: [string, string, string, string][] = [
  // Stay granted per curiam; Sotomayor/Kagan/Jackson dissenting → other 6 granted (6-3, full lineup known)
  ["25A1314", "Allen v. Milligan", "2026-06-02", "MMMDDMMMD"],
  // Granted in part/denied in part. Barrett w/ Roberts & Kavanaugh concurring → M. Sotomayor would
  // deny in full → D. Thomas/Alito would grant in full (concur-in-part/dissent-in-part) → 0. Kagan/
  // Gorsuch/Jackson unstated → 0.
  ["25A810", "Mirabelli v. Bonta", "2026-03-02", "MAADAAMMA"],
];

(async () => {
  const { upsertManual, loadManual } = await import("../lib/redis");
  for (const [docket, name, decided, key] of CASES) {
    const votes: Record<string, Side> = {};
    SENIORITY_IDS.forEach((id, i) => (votes[id] = key[i] as Side));
    const maj = key.split("").filter((c) => c === "M").length;
    const min = key.split("").filter((c) => c === "D").length;
    const rec: CaseRecord = {
      term: "2025", docket, name, decided,
      question: "", holding: "", winningParty: "",
      decisionType: "per curiam (emergency docket)", lineupKey: encodeLineup(votes),
      majority: maj, minority: min, votes, opinions: [],
      oyezUrl: `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${docket}.html`,
      justiaUrl: null, source: "manual",
    };
    await upsertManual(rec);
    console.log(`+ ${docket.padEnd(8)} ${maj}-${min}  ${encodeLineup(votes)}  ${name}`);
  }
  console.log(`\nmanual store now holds ${(await loadManual()).length} records`);
})();
