/**
 * Build the modern-era game pool from SCDB (1946–present, justice-centered by
 * docket). One record per case with justice sides + the metadata categories
 * are built from. Writes data/pool.json and prints the justice roster.
 *
 * Usage (from project root): npx tsx scripts/build-pool.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { PoolCase, Side } from "../lib/game-types";

const SCDB_URL =
  "https://scdb.la.psu.edu/?jet_download=f63edb5d812a973b488eb48e42935b673c8987b3";

export type { PoolCase, Side };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
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

const mdyToIso = (s: string): string => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
};

async function main() {
  console.log("downloading SCDB modern…");
  const res = await fetch(SCDB_URL);
  if (!res.ok) throw new Error(`SCDB download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let csvBytes: Uint8Array;
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    csvBytes = files[Object.keys(files).find((f) => f.endsWith(".csv"))!];
  } else csvBytes = buf;
  const text = Buffer.from(csvBytes).toString("latin1");
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.replace(/^﻿/, "").replace(/^"|"$/g, ""));
  const col = (n: string) => {
    const i = header.indexOf(n);
    if (i === -1) throw new Error(`missing column ${n}`);
    return i;
  };
  const C = {
    caseId: col("caseId"),
    dateDecision: col("dateDecision"),
    usCite: col("usCite"),
    term: col("term"),
    naturalCourt: col("naturalCourt"),
    chief: col("chief"),
    caseName: col("caseName"),
    petitioner: col("petitioner"),
    respondent: col("respondent"),
    caseDisposition: col("caseDisposition"),
    issueArea: col("issueArea"),
    issue: col("issue"),
    decisionDirection: col("decisionDirection"),
    precedentAlteration: col("precedentAlteration"),
    majOpinWriter: col("majOpinWriter"),
    majVotes: col("majVotes"),
    minVotes: col("minVotes"),
    justice: col("justice"),
    justiceName: col("justiceName"),
    vote: col("vote"),
    majority: col("majority"),
  };

  const codeToName = new Map<string, string>();
  const cases = new Map<string, PoolCase>();
  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  for (const r of rows.slice(1)) {
    const justiceCode = r[C.justice].trim();
    const justiceName = r[C.justiceName].trim();
    if (justiceCode && justiceName) codeToName.set(justiceCode, justiceName);

    const id = r[C.caseId].trim();
    if (!id) continue;
    let c = cases.get(id);
    if (!c) {
      c = {
        id,
        name: r[C.caseName].trim(),
        term: Number(r[C.term]),
        decided: mdyToIso(r[C.dateDecision].trim()),
        usCite: r[C.usCite].trim(),
        naturalCourt: Number(r[C.naturalCourt]) || 0,
        chief: r[C.chief].trim(),
        votes: {},
        maj: num(r[C.majVotes]) ?? 0,
        min: num(r[C.minVotes]) ?? 0,
        majWriter: null,
        issueArea: num(r[C.issueArea]),
        issue: num(r[C.issue]),
        direction: num(r[C.decisionDirection]),
        disposition: num(r[C.caseDisposition]),
        petitioner: num(r[C.petitioner]),
        respondent: num(r[C.respondent]),
        overruledPrecedent: r[C.precedentAlteration].trim() === "1",
        // remember the writer code; resolve to name after the full pass
        majWriterCode: r[C.majOpinWriter].trim() || null,
      } as PoolCase & { majWriterCode: string | null };
      cases.set(id, c);
    }
    if (!justiceName) continue;
    const vote = r[C.vote].trim();
    const majority = r[C.majority].trim();
    let side: Side;
    if (vote === "8") side = "T";
    else if (majority === "2") side = "M";
    else if (majority === "1") side = "D";
    else side = "A";
    c.votes[justiceName] = side;
  }

  // resolve majority-opinion-writer codes to justiceNames
  for (const c of cases.values()) {
    const code = (c as PoolCase & { majWriterCode: string | null }).majWriterCode;
    c.majWriter = code ? (codeToName.get(code) ?? null) : null;
    delete (c as PoolCase & { majWriterCode?: string | null }).majWriterCode;
  }

  const pool = [...cases.values()].sort((a, b) =>
    a.decided.localeCompare(b.decided)
  );
  writeFileSync(join(process.cwd(), "data", "pool.json"), JSON.stringify(pool));

  // roster report
  const counts = new Map<string, number>();
  for (const c of pool)
    for (const [jn, s] of Object.entries(c.votes))
      if (s !== "A") counts.set(jn, (counts.get(jn) ?? 0) + 1);
  const roster = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`pool: ${pool.length} cases, ${roster.length} justices`);
  console.log("justices by participation:");
  for (const [jn, n] of roster) console.log(`  ${jn}\t${n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
