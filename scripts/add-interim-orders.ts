/**
 * Add interim-docket ("A") applications decided by the current bench as manual
 * overrides — OT2022 through OT2025.
 *
 * Where these come from: the Court publishes two lists per term. Applications
 * resolved by a full opinion of the Court land on the slip-opinion list, and
 * those are already in the data (Ohio v. EPA, Trump v. CASA, Trump v. Cook,
 * Allen v. Milligan, Mirabelli, and the two August 2026 per curiams). The rest
 * — a one-paragraph order plus whatever separate writings it drew — land on
 * "Opinions Relating to Orders", and none of those were in the data at all.
 * This script adds them.
 *
 * Coding follows Will's rule, applied to the order text itself: a justice who
 * dissented, or who is recorded as "would grant"/"would deny" against the
 * Court's disposition, gets D; a justice who wrote or joined on the Court's
 * side (or who is unrecorded, which for an order of the Court means silent
 * assent) gets M; a justice recorded as taking no part gets A. So a bare order
 * naming three dissenters is a 6-3, exactly as it is for a per curiam.
 *
 * Two orders are deliberately left out because no clean lineup exists:
 *   25A103  NIH v. American Public Health Assn. (8/21/25) — granted in part,
 *           five separate writings, every one of them concurring in part and
 *           dissenting in part. There is no majority/dissent to record.
 *   24A78   Department of Education v. Louisiana (8/16/24) — Sotomayor, Kagan,
 *           Gorsuch and Jackson dissented *in part*, so the four are neither
 *           with the Court nor against it on the disposition as a whole.
 *
 * Caveat worth remembering when reading the wall: this source only surfaces
 * applications that drew a published writing. An emergency application granted
 * without recorded dissent leaves no paper trail here, so what these records
 * add is skewed toward divided outcomes — they move the frequency counts more
 * than they should relative to quiet unanimous orders.
 *
 * Usage: npx tsx scripts/add-interim-orders.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
try { for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
import { encodeLineup } from "../lib/grid";
import { SENIORITY_IDS } from "../lib/justices";
import type { CaseRecord, Side } from "../lib/types";

// term, docket, name, decided, lineup in seniority order (R,T,A,So,Ka,Go,Kv,Ba,Ja)
const CASES: [number, string, string, string, string][] = [
  /* ---------------- OT2022 ---------------- */
  // Stay of execution denied. Sotomayor & Jackson would grant; Jackson dissent w/ Sotomayor.
  [2022, "22A463", "Johnson v. Missouri", "2022-11-30", "MMMDMMMMD"],
  // Title 42 stay granted. Sotomayor & Kagan would deny; Gorsuch dissent w/ Jackson.
  [2022, "22A544", "Arizona v. Mayorkas", "2022-12-27", "MMMDDDMMD"],
  // Application to vacate stay denied; Alito statement w/ Thomas *respecting* the denial.
  [2022, "22A557", "Antonyuk v. Nigrelli", "2023-01-11", "MMMMMMMMM"],
  // Application to vacate injunction denied. Alito dissent w/ Thomas.
  [2022, "22A800", "West Virginia v. B. P. J. (application to vacate injunction)", "2023-04-06", "MDDMMMMMM"],
  // Mifepristone stays granted. Thomas would deny; Alito dissent.
  [2022, "22A901", "Danco Laboratories, LLC v. Alliance for Hippocratic Medicine", "2023-04-21", "MDDMMMMMM"],
  // Stay of execution denied. Sotomayor dissent w/ Kagan and Jackson.
  [2022, "23A51", "Barber v. Ivey", "2023-07-21", "MMMDDMMMD"],
  [2022, "23A90", "Johnson v. Vandergriff", "2023-08-01", "MMMDDMMMD"],
  // Stay of the mandate denied; Kavanaugh statement w/ Alito respecting the denial.
  [2022, "23A73", "City of Tulsa v. Hooper", "2023-08-04", "MMMMMMMMM"],

  /* ---------------- OT2023 ---------------- */
  // Applications for stay denied; Jackson concurring in the denial.
  [2023, "23A281", "Robinson v. Ardoin", "2023-10-19", "MMMMMMMMM"],
  // Stay granted. Alito dissent w/ Thomas and Gorsuch.
  [2023, "23A243", "Murthy v. Missouri (application for stay)", "2023-10-20", "MDDMMDMMM"],
  // Stay denied. Thomas would grant; Gorsuch statement w/ Alito respecting the denial.
  [2023, "23A296", "Missouri v. United States", "2023-10-20", "MDMMMMMMM"],
  // Stay denied; Kavanaugh statement respecting the denial.
  [2023, "23A315", "West Flagler Associates, Ltd. v. Haaland", "2023-10-25", "MMMMMMMMM"],
  // Stay denied. Thomas, Alito and Gorsuch would grant; Kavanaugh statement w/ Barrett.
  [2023, "23A366", "Griffin v. HM Florida-Orl, LLC", "2023-11-16", "MDDMMDMMM"],
  // Applications to vacate stay denied. Kagan dissent w/ Sotomayor and Jackson.
  [2023, "23A521", "Petteway v. Galveston County", "2023-12-12", "MMMDDMMMD"],
  // Stay of execution and cert denied. Sotomayor dissent; Kagan dissent w/ Jackson.
  [2023, "23A688", "Smith v. Hamm", "2024-01-25", "MMMDDMMMD"],
  // Applications to vacate stay denied. Barrett concurrence w/ Kavanaugh;
  // Sotomayor dissent w/ Jackson; Kagan dissent.
  [2023, "23A814", "United States v. Texas (application to vacate stay)", "2024-03-19", "MMMDDMMMD"],
  // Stay granted. Kagan would deny; Jackson dissent w/ Sotomayor.
  [2023, "23A763", "Labrador v. Poe", "2024-04-15", "MMMDDMMMD"],
  // Stay granted. Sotomayor & Kagan would deny; Jackson dissent.
  [2023, "23A994", "Robinson v. Callais", "2024-05-15", "MMMDDMMMD"],

  /* ---------------- OT2024 ---------------- */
  // Stays denied. Thomas would grant; Alito took no part.
  [2024, "24A95", "West Virginia v. Environmental Protection Agency", "2024-10-16", "MDAMMMMMM"],
  // Stay of execution and cert denied; Sotomayor statement respecting the denial.
  [2024, "24A349", "Roberson v. Texas", "2024-10-17", "MMMMMMMMM"],
  // Stay of the mandate granted. Jackson dissent.
  [2024, "24A287", "Horseracing Integrity and Safety Authority, Inc. v. National Horsemen's Benevolent and Protective Assn.", "2024-10-28", "MMMMMMMMD"],
  // Stay denied; Alito statement w/ Thomas and Gorsuch respecting the denial.
  [2024, "24A408", "Republican National Committee v. Genser", "2024-11-01", "MMMMMMMMM"],
  // Corporate Transparency Act stay granted; Gorsuch concurring. Jackson dissent.
  [2024, "24A653", "McHenry v. Texas Top Cop Shop, Inc.", "2025-01-23", "MMMMMMMMD"],
  // Application held in abeyance. Sotomayor & Jackson would deny; Gorsuch dissent w/ Alito.
  // (The four recorded against the disposition split two ways — Sotomayor and
  // Jackson would have denied outright, Gorsuch and Alito would have granted —
  // so read this 5-4 as "against the Court's disposition", not as one bloc.)
  [2024, "24A790", "Bessent v. Dellinger", "2025-02-21", "MMDDMDMMD"],
  // Application to vacate denied. Alito dissent w/ Thomas, Gorsuch and Kavanaugh.
  [2024, "24A831", "Department of State v. AIDS Vaccine Advocacy Coalition (application to vacate)", "2025-03-05", "MDDMMDDMM"],
  // Stay of execution denied. Sotomayor, Kagan and Jackson would grant; Gorsuch dissent.
  [2024, "24A893", "Hoffman v. Westcott", "2025-03-18", "MMMDDDMMD"],
  // Teacher-grant stay granted. Roberts would deny; Kagan dissent; Jackson dissent w/ Sotomayor.
  [2024, "24A910", "Department of Education v. California", "2025-04-04", "DMMDDMMMD"],
  // Alien Enemies Act TROs vacated; Kavanaugh concurring. Sotomayor dissent w/ Kagan and
  // Jackson, Barrett joining Parts II and III-B.
  [2024, "24A931", "Trump v. J. G. G.", "2025-04-07", "MMMDDMMDD"],
  // Application granted in part; Sotomayor statement w/ Kagan and Jackson respecting the
  // Court's disposition — no dissent.
  [2024, "24A949", "Noem v. Abrego Garcia", "2025-04-10", "MMMMMMMMM"],
  // Injunction pending further proceedings granted. Alito dissent w/ Thomas.
  [2024, "24A1007(04-19-25)", "A.A.R.P. v. Trump (injunction pending proceedings)", "2025-04-19", "MDDMMMMMM"],
  // Per curiam continuing the injunction; Kavanaugh concurring. Alito dissent w/ Thomas.
  [2024, "24A1007", "A.A.R.P. v. Trump", "2025-05-16", "MDDMMMMMM"],
  // Injunction pending appeal granted. Sotomayor would deny; Jackson dissent.
  [2024, "24A1051", "Libby v. Fecteau", "2025-05-20", "MMMDMMMMD"],
  // NLRB/MSPB removals stayed. Kagan dissent w/ Sotomayor and Jackson.
  [2024, "24A966", "Trump v. Wilcox", "2025-05-22", "MMMDDMMMD"],
  // Parole-termination stay granted. Jackson dissent w/ Sotomayor.
  [2024, "24A1079", "Noem v. Doe", "2025-05-30", "MMMDMMMMD"],
  // Stay denied; Alito statement w/ Thomas respecting the denial.
  [2024, "24A982", "Doe v. Seattle Police Dept.", "2025-06-04", "MMMMMMMMM"],
  // DOGE records stay granted. Kagan would deny; Jackson dissent w/ Sotomayor.
  [2024, "24A1063", "Social Security Administration v. AFSCME", "2025-06-06", "MMMDDMMMD"],
  // Third-country removal injunction stayed. Sotomayor dissent w/ Kagan and Jackson.
  [2024, "24A1153(06-23-25)", "Department of Homeland Security v. D. V. D. (application for stay)", "2025-06-23", "MMMDDMMMD"],
  // Motion for clarification granted; Kagan concurring. Sotomayor dissent w/ Jackson.
  [2024, "24A1153", "Department of Homeland Security v. D. V. D. (motion for clarification)", "2025-07-03", "MMMDMMMMD"],
  // Reorganization EO stay granted; Sotomayor concurring. Jackson dissent.
  [2024, "24A1174", "Trump v. American Federation of Government Employees", "2025-07-08", "MMMMMMMMD"],
  // Education Dept. RIF stay granted. Sotomayor dissent w/ Kagan and Jackson.
  [2024, "24A1203", "McMahon v. New York", "2025-07-14", "MMMDDMMMD"],
  // CPSC removals stayed; Kavanaugh concurring. Kagan dissent w/ Sotomayor and Jackson.
  [2024, "25A11", "Trump v. Boyle", "2025-07-23", "MMMDDMMMD"],
  // Application to vacate stay denied; Kavanaugh concurring in the denial.
  [2024, "25A97", "NetChoice, LLC v. Fitch", "2025-08-14", "MMMMMMMMM"],
  // Roving-patrol injunction stayed; Kavanaugh concurring. Sotomayor dissent w/ Kagan and Jackson.
  [2024, "25A169", "Noem v. Vasquez Perdomo", "2025-09-08", "MMMDDMMMD"],
  // FTC removal stayed and cert before judgment granted. Kagan dissent w/ Sotomayor and Jackson.
  [2024, "25A264", "Trump v. Slaughter (application for stay)", "2025-09-22", "MMMDDMMMD"],
  // Foreign-aid obligation injunction stayed. Kagan dissent w/ Sotomayor and Jackson.
  [2024, "25A269", "Department of State v. AIDS Vaccine Advocacy Coalition (application for stay)", "2025-09-26", "MMMDDMMMD"],
  // TPS judgment stayed. Sotomayor & Kagan would deny; Jackson dissent.
  [2024, "25A326", "Noem v. National TPS Alliance", "2025-10-03", "MMMDDMMMD"],

  /* ---------------- OT2025 ---------------- */
  // Stay of execution and cert denied. Sotomayor dissent w/ Kagan and Jackson.
  [2025, "25A378", "Crawford v. Mississippi", "2025-10-15", "MMMDDMMMD"],
  [2025, "25A457", "Boyd v. Hamm", "2025-10-23", "MMMDDMMMD"],
  // Passport sex-marker injunction stayed. Jackson dissent w/ Sotomayor and Kagan.
  [2025, "25A319", "Trump v. Orr", "2025-11-06", "MMMDDMMMD"],
  // Texas map injunction stayed; Alito concurrence w/ Thomas and Gorsuch.
  // Kagan dissent w/ Sotomayor and Jackson.
  [2025, "25A608", "Abbott v. League of United Latin American Citizens", "2025-12-04", "MMMDDMMMD"],
  // National Guard stay denied; Kavanaugh concurring. Alito dissent w/ Thomas; Gorsuch dissent.
  [2025, "25A443", "Trump v. Illinois", "2025-12-23", "MDDMMDMMM"],
  // Stay of execution and cert denied; Sotomayor statement respecting the denial.
  [2025, "25A926", "Trotter v. Florida", "2026-02-24", "MMMMMMMMM"],
  // NY election-litigation stay granted; Alito concurring. Sotomayor dissent w/ Kagan and Jackson.
  [2025, "25A914", "Malliotakis v. Williams", "2026-03-02", "MMMDDMMMD"],
  // Judgment issued forthwith; Alito concurrence w/ Thomas and Gorsuch. Jackson dissent.
  [2025, "25A1197", "Callais v. Louisiana (application to issue the judgment forthwith)", "2026-05-04", "MMMMMMMMD"],
  // Mifepristone stays granted. Thomas dissent; Alito dissent.
  [2025, "25A1207", "Danco Laboratories, LLC v. Louisiana", "2026-05-14", "MDDMMMMMM"],
  // Stay of execution vacated. Kagan would deny; Jackson dissent w/ Sotomayor.
  [2025, "25A1235", "Guerrero v. Busby", "2026-05-14", "MMMDDMMMD"],
];

(async () => {
  const { upsertManual, loadManual } = await import("../lib/redis");
  const lit = new Map<string, number>();
  for (const [term, docket, name, decided, key] of CASES) {
    if (key.length !== 9 || /[^MDA]/.test(key)) throw new Error(`${docket}: bad lineup ${key}`);
    const votes: Record<string, Side> = {};
    SENIORITY_IDS.forEach((id, i) => (votes[id] = key[i] as Side));
    const maj = [...key].filter((c) => c === "M").length;
    const min = [...key].filter((c) => c === "D").length;
    if (maj <= min) throw new Error(`${docket}: no majority (${maj}-${min})`);
    const rec: CaseRecord = {
      term: String(term),
      docket,
      name,
      decided,
      question: "",
      holding: "",
      winningParty: "",
      decisionType: "order (interim docket)",
      lineupKey: encodeLineup(votes),
      majority: maj,
      minority: min,
      votes,
      opinions: [],
      oyezUrl: `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${docket.replace(/\(.*\)/, "")}.html`,
      justiaUrl: null,
      source: "manual",
    };
    await upsertManual(rec);
    lit.set(rec.lineupKey, (lit.get(rec.lineupKey) ?? 0) + 1);
    console.log(`+ ${String(term)} ${docket.padEnd(18)} ${maj}-${min}  ${rec.lineupKey}  ${name.slice(0, 52)}`);
  }
  console.log(`\n${CASES.length} orders; ${lit.size} distinct alignments:`);
  for (const [k, n] of [...lit].sort((a, b) => b[1] - a[1])) console.log(`   ${k}  ×${n}`);
  console.log(`manual store now holds ${(await loadManual()).length} records`);
})();
