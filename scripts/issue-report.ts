import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const Q = String.fromCharCode(34);
function parseRow(line: string): string[] {
  const o: string[] = [];
  let f = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === Q) {
        if (line[i + 1] === Q) {
          f += Q;
          i++;
        } else q = false;
      } else f += c;
    } else if (c === Q) q = true;
    else if (c === ",") {
      o.push(f);
      f = "";
    } else f += c;
  }
  o.push(f);
  return o;
}

const SCDB =
  "https://scdb.la.psu.edu/?jet_download=f63edb5d812a973b488eb48e42935b673c8987b3";

const AREAS: Record<number, string> = {
  1: "Criminal Procedure",
  2: "Civil Rights",
  3: "First Amendment",
  4: "Due Process",
  5: "Privacy",
  6: "Attorneys",
  7: "Unions",
  8: "Economic Activity",
  9: "Judicial Power",
  10: "Federalism",
  11: "Interstate Relations",
  12: "Federal Taxation",
  13: "Miscellaneous",
  14: "Private Action",
};

// candidate granular topic categories: label -> issue codes
const TOPICS: [string, number[]][] = [
  ["Death penalty", [10130, 10250, 10340]],
  ["Search & seizure", [10050, 10060, 10070]],
  ["Self-incrimination / Miranda", [10090, 10100, 10110]],
  ["Right to counsel", [10120]],
  ["Habeas corpus", [10020]],
  ["Double jeopardy", [10170]],
  ["Abortion & contraception", [50020]],
  ["Affirmative action", [20070]],
  ["Voting rights", [20010, 20020, 20030, 20090]],
  ["School desegregation", [20050]],
  ["Sex discrimination", [20130, 20140]],
  ["Indian law", [20150, 20160]],
  ["Immigration & naturalization", [20110, 20120, 20260, 20270, 20280, 20290, 20300, 20310, 10480]],
  ["Establishment Clause", [30170, 30180]],
  ["Free exercise of religion", [30160]],
  ["Obscenity", [30190, 30200]],
  ["Takings clause", [40070]],
  ["Antitrust & mergers", [80010, 80020]],
  ["Bankruptcy", [80030]],
  ["Patents/copyright/trademark", [80180, 80190, 80200, 80210]],
  ["Securities regulation", [80120]],
  ["Environmental", [80130, 100090]],
  ["Federal preemption", [100020, 100030]],
];

async function main() {
  const buf = new Uint8Array(await (await fetch(SCDB)).arrayBuffer());
  const ff = unzipSync(buf);
  const csv = Buffer.from(
    ff[Object.keys(ff).find((n) => n.endsWith(".csv"))!]
  ).toString("latin1");
  const rows = csv.split(/\r?\n/);
  const H = parseRow(rows[0]).map((s) => s.replace(/^﻿/, ""));
  const cId = H.indexOf("caseId"),
    cI = H.indexOf("issue"),
    cA = H.indexOf("issueArea");
  const issueOf = new Map<string, number>();
  const areaOf = new Map<string, number>();
  for (const line of rows.slice(1)) {
    if (!line) continue;
    const c = parseRow(line);
    if (!issueOf.has(c[cId])) {
      issueOf.set(c[cId], Number(c[cI]));
      areaOf.set(c[cId], Number(c[cA]));
    }
  }

  const pool = JSON.parse(readFileSync("data/pool.json", "utf8")) as {
    id: string;
    notable?: boolean;
  }[];

  // issueArea totals
  const areaTot: Record<number, { t: number; n: number }> = {};
  for (const p of pool) {
    const a = areaOf.get(p.id);
    if (a == null) continue;
    (areaTot[a] ??= { t: 0, n: 0 }).t++;
    if (p.notable) areaTot[a].n++;
  }
  console.log("=== issueArea buckets (total / notable) ===");
  for (const a of Object.keys(AREAS).map(Number))
    console.log(
      `  ${String(a).padStart(2)} ${AREAS[a].padEnd(22)} ${areaTot[a]?.t ?? 0} / ${areaTot[a]?.n ?? 0}`
    );

  console.log("\n=== candidate granular topics (total / notable) ===");
  for (const [label, codes] of TOPICS) {
    const set = new Set(codes);
    let t = 0,
      n = 0;
    for (const p of pool) {
      if (set.has(issueOf.get(p.id)!)) {
        t++;
        if (p.notable) n++;
      }
    }
    console.log(`  ${label.padEnd(30)} ${t} / ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
