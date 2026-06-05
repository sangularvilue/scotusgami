/**
 * Fill the OT2024 gap: Oyez hasn't entered vote lineups for most of that term,
 * so pull justice-level votes from the Supreme Court Database (SCDB 2025_01,
 * justice-centered, organized by docket) and pair them with Oyez's case text
 * (name, QP, holding, dates). Records are tagged source:"scdb"; loadAllCases
 * prefers Oyez per docket, so these fade out as Oyez catches up.
 *
 * Usage (from project root): npx tsx scripts/supplement-scdb.ts [term]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { encodeLineup } from "../lib/grid";
import { getJson, stripHtml } from "../lib/oyez";
import type { CaseRecord, OpinionInfo, Side } from "../lib/types";

const SCDB_URL =
  "https://scdb.la.psu.edu/?jet_download=f63edb5d812a973b488eb48e42935b673c8987b3";

/** SCDB justiceName → our Oyez identifiers */
const SCDB_JUSTICES: Record<string, string> = {
  JGRoberts: "john_g_roberts_jr",
  CThomas: "clarence_thomas",
  SAAlito: "samuel_a_alito_jr",
  SSotomayor: "sonia_sotomayor",
  EKagan: "elena_kagan",
  NMGorsuch: "neil_gorsuch",
  BMKavanaugh: "brett_m_kavanaugh",
  ACBarrett: "amy_coney_barrett",
  KBJackson: "ketanji_brown_jackson",
};

/** Minimal quote-aware CSV parser. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface OyezSummary {
  docket_number: string;
  name: string;
  href: string;
}

async function main() {
  const term = Number(process.argv[2] ?? 2024);

  // 1. Download SCDB justice-centered-by-docket CSV (zipped)
  console.log("downloading SCDB...");
  const res = await fetch(SCDB_URL);
  if (!res.ok) throw new Error(`SCDB download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let csvBytes: Uint8Array;
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    const name = Object.keys(files).find((f) => f.endsWith(".csv"));
    if (!name) throw new Error("no csv in SCDB zip");
    csvBytes = files[name];
  } else {
    csvBytes = buf;
  }
  // SCDB ships windows-1252; latin1 is close enough for the fields we use
  const csv = Buffer.from(csvBytes).toString("latin1");
  const rows = parseCsv(csv);
  const header = rows[0];
  const col = (name: string) => {
    const i = header.findIndex((h) => h.replace(/^﻿/, "") === name);
    if (i === -1) throw new Error(`SCDB column not found: ${name}`);
    return i;
  };
  const cTerm = col("term");
  const cDocket = col("docket");
  const cJusticeName = col("justiceName");
  const cJustice = col("justice");
  const cVote = col("vote");
  const cOpinion = col("opinion");
  const cMajority = col("majority");
  const cMajWriter = col("majOpinWriter");

  // 2. Group the requested term's rows by docket
  const byDocket = new Map<string, string[][]>();
  for (const r of rows.slice(1)) {
    if (Number(r[cTerm]) !== term) continue;
    const docket = r[cDocket].trim();
    if (!docket) continue;
    if (!byDocket.has(docket)) byDocket.set(docket, []);
    byDocket.get(docket)!.push(r);
  }
  console.log(`SCDB term ${term}: ${byDocket.size} dockets`);

  // 3. Which dockets does our Oyez scrape already cover?
  const { readFileSync } = await import("node:fs");
  let covered = new Set<string>();
  try {
    const existing = JSON.parse(
      readFileSync(join(process.cwd(), "data", `cases-${term}.json`), "utf8")
    ) as CaseRecord[];
    covered = new Set(existing.map((c) => c.docket));
  } catch {
    console.log(`note: no data/cases-${term}.json found; supplementing everything`);
  }

  // 4. Oyez case list for text/dates lookup
  const oyezList = await getJson<OyezSummary[]>(
    `https://api.oyez.org/cases?per_page=1000&filter=term:${term}`
  );
  const oyezByDocket = new Map(oyezList.map((c) => [c.docket_number, c]));

  // 5. Build supplement records
  const out: CaseRecord[] = [];
  const misses: string[] = [];
  for (const [docket, jrows] of byDocket) {
    if (covered.has(docket)) continue;
    const oyez = oyezByDocket.get(docket);
    if (!oyez) {
      misses.push(`${docket}: not on Oyez list`);
      continue;
    }

    const votes: Record<string, Side> = {};
    let tie = false;
    let unknownJustice: string | null = null;
    const majWriterCode = jrows[0][cMajWriter].trim();
    let majWriterId: string | null = null;
    const opinions: OpinionInfo[] = [];

    for (const r of jrows) {
      const id = SCDB_JUSTICES[r[cJusticeName].trim()];
      if (!id) {
        unknownJustice = r[cJusticeName];
        break;
      }
      const vote = r[cVote].trim();
      const majority = r[cMajority].trim();
      if (vote === "" || majority === "") {
        votes[id] = "A"; // took no part
        continue;
      }
      if (vote === "8") tie = true; // equally divided
      votes[id] = majority === "2" ? "M" : "D";
      if (r[cJustice].trim() === majWriterCode) majWriterId = id;
      const wrote = r[cOpinion].trim();
      if (wrote === "2" || wrote === "3") {
        opinions.push({
          type: "", // typed below once majWriterId is known
          author: id,
          joinedBy: [],
        });
      }
    }
    if (unknownJustice) {
      misses.push(`${docket}: unknown SCDB justice ${unknownJustice}`);
      continue;
    }
    if (tie) {
      misses.push(`${docket}: equally divided court, no majority side`);
      continue;
    }
    for (const op of opinions) {
      op.type =
        op.author === majWriterId
          ? "majority"
          : votes[op.author] === "M"
            ? "concurrence"
            : "dissent";
    }
    // majority opinion first, then concurrences, then dissents
    const order = { majority: 0, concurrence: 1, dissent: 2 } as Record<string, number>;
    opinions.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));

    // Oyez detail for QP / holding / decided date
    await new Promise((r) => setTimeout(r, 150));
    const detail = await getJson<{
      question: string | null;
      description: string | null;
      justia_url: string | null;
      timeline: { event: string; dates: number[] | null }[] | null;
    }>(oyez.href);
    const decidedTs = detail.timeline
      ?.find((t) => t.event === "Decided")
      ?.dates?.slice(-1)[0];
    const decided = decidedTs
      ? new Date(decidedTs * 1000).toISOString().slice(0, 10)
      : `${term + 1}-06-30`;

    const maj = Object.values(votes).filter((s) => s === "M").length;
    const dis = Object.values(votes).filter((s) => s === "D").length;
    if (maj === 0 || maj <= dis) {
      misses.push(`${docket}: no majority side recorded (${maj}–${dis}, equally divided?)`);
      continue;
    }
    out.push({
      term: String(term),
      docket,
      name: oyez.name,
      decided,
      question: stripHtml(detail.question),
      holding: stripHtml(detail.description),
      winningParty: "",
      decisionType: "",
      lineupKey: encodeLineup(votes),
      majority: maj,
      minority: dis,
      votes,
      opinions,
      oyezUrl: `https://www.oyez.org/cases/${term}/${docket}`,
      justiaUrl: detail.justia_url,
      source: "scdb",
    });
    console.log(`  + ${oyez.name} (${maj}–${dis})`);
  }

  out.sort((a, b) => a.decided.localeCompare(b.decided));
  writeFileSync(
    join(process.cwd(), "data", `supplement-${term}.json`),
    JSON.stringify(out, null, 1)
  );
  console.log(`wrote ${out.length} supplement records for term ${term}`);
  for (const m of misses) console.log(`  [miss] ${m}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
