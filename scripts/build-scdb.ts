/**
 * Build an authoritative, canonical case set for a COMPLETED term from the
 * Supreme Court Database (SCDB) — the academic gold standard SCOTUSblog's
 * StatPack aligns with. Oyez's vote matrices are incomplete/miscoded for past
 * terms, so for finished terms we prefer SCDB (see lib/merge.ts).
 *
 * One record per SCDB caseId (so consolidated companions collapse to a single
 * decision), votes from SCDB, decision date from SCDB, and case text (name / QP
 * / holding) from Oyez where the docket matches (SCDB caseName otherwise).
 *
 * Usage (from project root): npx tsx scripts/build-scdb.ts <term> [--redis]
 * Writes data/supplement-<term>.json; with --redis also pushes to Upstash.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { encodeLineup } from "../lib/grid";
import { getJson, stripHtml } from "../lib/oyez";
import type { CaseRecord, OpinionInfo, Side } from "../lib/types";

const SCDB_URL =
  "https://scdb.la.psu.edu/?jet_download=f63edb5d812a973b488eb48e42935b673c8987b3";

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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const normDocket = (d: string) => d.trim().replace(/[‐-―]/g, "-");

interface OyezSummary { docket_number: string; name: string; href: string }

async function main() {
  const term = Number(process.argv[2]);
  if (!Number.isFinite(term)) throw new Error("usage: build-scdb.ts <term> [--redis]");
  const toRedis = process.argv.includes("--redis");

  if (toRedis) {
    try {
      for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
        const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch { /* ignore */ }
  }

  console.log("downloading SCDB…");
  const res = await fetch(SCDB_URL);
  if (!res.ok) throw new Error(`SCDB download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let csvBytes = buf;
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    csvBytes = files[Object.keys(files).find((f) => f.endsWith(".csv"))!];
  }
  const rows = parseCsv(Buffer.from(csvBytes).toString("latin1"));
  const h = rows[0].map((x) => x.replace(/^﻿/, ""));
  const ci = (n: string) => { const i = h.indexOf(n); if (i < 0) throw new Error(`no SCDB col ${n}`); return i; };
  const C = {
    term: ci("term"), caseId: ci("caseId"), docket: ci("docket"),
    dateDecision: ci("dateDecision"), caseName: ci("caseName"),
    justiceName: ci("justiceName"), justice: ci("justice"), vote: ci("vote"),
    majority: ci("majority"), opinion: ci("opinion"), majWriter: ci("majOpinWriter"),
  };

  // group this term's rows by caseId (one decision), keeping first row per justice
  const byCase = new Map<string, string[][]>();
  for (const r of rows.slice(1)) {
    if (Number(r[C.term]) !== term) continue;
    (byCase.get(r[C.caseId]) ?? byCase.set(r[C.caseId], []).get(r[C.caseId])!).push(r);
  }
  console.log(`SCDB term ${term}: ${byCase.size} caseIds`);

  // Oyez name/href by docket for nicer text
  const oyezList = await getJson<OyezSummary[]>(
    `https://api.oyez.org/cases?per_page=1000&filter=term:${term}`
  );
  const oyezByDocket = new Map(oyezList.map((c) => [normDocket(c.docket_number), c]));

  const out: CaseRecord[] = [];
  const skipped: string[] = [];
  for (const [caseId, jrows] of byCase) {
    // one vote per justice
    const seen = new Set<string>();
    const votes: Record<string, Side> = {};
    const opinions: OpinionInfo[] = [];
    const majWriterCode = jrows[0][C.majWriter].trim();
    let majWriterId: string | null = null;
    let tie = false;
    let bad = false;
    for (const r of jrows) {
      const id = SCDB_JUSTICES[r[C.justiceName].trim()];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const vote = r[C.vote].trim();
      const majority = r[C.majority].trim();
      if (vote === "") { votes[id] = "A"; continue; }
      if (vote === "8") { tie = true; votes[id] = "T"; continue; }
      if (majority === "") { votes[id] = "A"; continue; }
      votes[id] = majority === "2" ? "M" : "D";
      if (r[C.justice].trim() === majWriterCode) majWriterId = id;
      const wrote = r[C.opinion].trim();
      if (wrote === "2" || wrote === "3") opinions.push({ type: "", author: id, joinedBy: [] });
    }
    if (Object.keys(votes).length < 6) { skipped.push(`${caseId}: too few justices`); continue; }

    const tCount = Object.values(votes).filter((s) => s === "T").length;
    const maj = tie ? tCount / 2 : Object.values(votes).filter((s) => s === "M").length;
    const dis = tie ? tCount / 2 : Object.values(votes).filter((s) => s === "D").length;
    if (!tie && (maj === 0 || maj <= dis)) { skipped.push(`${caseId}: no majority (${maj}-${dis})`); continue; }

    for (const op of opinions)
      op.type = op.author === majWriterId ? "majority" : votes[op.author] === "M" ? "concurrence" : "dissent";
    const ord = { majority: 0, concurrence: 1, dissent: 2 } as Record<string, number>;
    opinions.sort((a, b) => (ord[a.type] ?? 9) - (ord[b.type] ?? 9));

    const docket = normDocket(jrows[0][C.docket]);
    const oyez = oyezByDocket.get(docket);
    let question = "", holding = "", justiaUrl: string | null = null;
    let name = oyez?.name ?? jrows[0][C.caseName].trim();
    if (oyez) {
      try {
        await new Promise((r) => setTimeout(r, 120));
        const d = await getJson<{ question: string | null; description: string | null; justia_url: string | null }>(oyez.href);
        question = stripHtml(d.question);
        holding = stripHtml(d.description);
        justiaUrl = d.justia_url;
      } catch { /* leave text empty */ }
    }

    out.push({
      term: String(term), docket, name,
      decided: jrows[0][C.dateDecision].trim() || `${term + 1}-06-30`,
      question, holding, winningParty: "",
      decisionType: tie ? "equally divided" : "",
      lineupKey: encodeLineup(votes), majority: maj, minority: dis, votes, opinions,
      oyezUrl: oyez ? `https://www.oyez.org/cases/${term}/${docket}` : "",
      justiaUrl, source: "scdb",
    });
  }

  out.sort((a, b) => a.decided.localeCompare(b.decided) || a.docket.localeCompare(b.docket));
  const unan = out.filter((c) => c.minority === 0 && c.decisionType !== "equally divided").length;
  console.log(`built ${out.length} records | unanimous(no dissent) ${unan} = ${(100 * unan / out.length).toFixed(0)}%`);
  if (skipped.length) console.log(`skipped ${skipped.length} (cert-stage / no-majority)`);

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(join(process.cwd(), "data", `supplement-${term}.json`), JSON.stringify(out, null, 1));
  if (toRedis && process.env.UPSTASH_REDIS_REST_URL) {
    const { saveSupplement } = await import("../lib/redis");
    await saveSupplement(term, out);
    console.log(`pushed to Redis (scotusgami:supplement:${term})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
