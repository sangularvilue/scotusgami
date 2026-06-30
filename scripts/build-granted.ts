/**
 * Build the upcoming term's "granted" pool from the Court's authoritative
 * Granted & Noted list (supremecourt.gov/orders/{yy}grantednotedlist.pdf) and
 * push it to Redis under scotusgami:bingo:{term} (+ data/bingo-{term}.json).
 *
 * Oyez badly under-lists an upcoming term (it had 9 of OT2026's 21 grants and
 * even disagreed on which), so for a term whose arguments haven't started we
 * source the granted cases straight from the Court. Each becomes a BingoCase
 * with no argument date yet (argued=null) — it sits in the granted pool until
 * the Court calendars it. Names are taken from Oyez when it has the docket
 * (nicer casing), else title-cased from the all-caps official list.
 *
 * Usage (from project root): npx tsx scripts/build-granted.ts [term]
 *   pdf-parse is a devDependency — this runs as a script, not in the app bundle.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import type { BingoCase } from "../lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const KEEP_UPPER = new Set([
  "LLC", "L.L.C.", "USA", "U.S.", "U.S.A.", "GA", "SEC", "RNC", "FCC", "EPA",
  "NLRB", "IRS", "TVA", "WBI", "CSX", "II", "III", "FBI", "DHS", "DOJ", "VA",
]);

/** Lower an ALL-CAPS official caption to readable title case (best effort). */
function titleCase(s: string): string {
  return s
    .replace(/[’]/g, "'")
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^A-Za-z.]/g, "").toUpperCase();
      if (w.toUpperCase() === "V.") return "v.";
      if (KEEP_UPPER.has(bare)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function toIso(mdy: string): string | null {
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

interface OyezSummary {
  docket_number: string;
  name: string;
}

async function main() {
  // load .env.local manually (no Next runtime here)
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* fall through */
  }

  const term = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const yy = term % 100;
  const url = `https://www.supremecourt.gov/orders/${yy}grantednotedlist.pdf`;
  console.log(`fetching ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`granted/noted list ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const { text } = await new PDFParse({ data: buf }).getText();
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // Each case: "{docket} {3-letter code} {NAME}" then a "... Granted: m/d/yy" line.
  const caseLine = /^(\d{2}-\d{1,5})\s+([CAQ][SFTMO][XYH])\s+(.+)$/;
  const parsed: { docket: string; name: string; granted: string | null }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(caseLine);
    if (!m) continue;
    const granted =
      (lines[i].match(/Granted:\s*([\d/]+)/) ??
        lines[i + 1]?.match(/Granted:\s*([\d/]+)/))?.[1] ?? null;
    parsed.push({ docket: m[1], name: m[3], granted: granted ? toIso(granted) : null });
  }
  console.log(`granted/noted list: ${parsed.length} cases for argument`);

  // Oyez names where available (nicer casing than the all-caps official list).
  const oyezByDocket = new Map<string, string>();
  try {
    const list = (await (
      await fetch(`https://api.oyez.org/cases?per_page=1000&filter=term:${term}`, {
        headers: { "User-Agent": "scotusgami.grannis.xyz (personal project)" },
      })
    ).json()) as OyezSummary[];
    for (const c of list) oyezByDocket.set(c.docket_number.trim(), c.name);
  } catch {
    console.log("(Oyez name lookup failed; using official captions)");
  }

  const cases: BingoCase[] = parsed.map((c) => {
    const oyezName = oyezByDocket.get(c.docket);
    return {
      term: String(term),
      docket: c.docket,
      name: oyezName ?? titleCase(c.name),
      argued: null,
      granted: c.granted,
      sitting: null,
      decided: null,
      majorityAuthor: null,
      oyezUrl: oyezName
        ? `https://www.oyez.org/cases/${term}/${c.docket}`
        : `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${c.docket}.html`,
    };
  });

  cases.forEach((c) => console.log(`  ${c.docket}  ${c.name}  (granted ${c.granted})`));

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `bingo-${term}.json`), JSON.stringify(cases, null, 1));

  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { saveBingo } = await import("../lib/redis");
    await saveBingo(term, cases);
    console.log(`\npushed ${cases.length} cases to Redis (scotusgami:bingo:${term})`);
  } else {
    console.log("\n(no Redis env — wrote file only)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
