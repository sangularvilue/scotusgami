/**
 * Build a term's bingo cases from the Court's authoritative Granted & Noted list
 * (supremecourt.gov/orders/{yy}grantednotedlist.pdf) and push them to Redis
 * under scotusgami:bingo:{term} (+ data/bingo-{term}.json). Calendared cases
 * carry their argument date and slot into sittings; the rest sit in the granted
 * pool. The daily cron does the same (merged with Oyez) — this is the manual /
 * local-dev path, e.g. right after the Court grants or calendars cases.
 *
 * Usage (from project root): npx tsx scripts/build-granted.ts [term]
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

  const { fetchGranted } = await import("../lib/granted");
  const term = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const cases = await fetchGranted(term, console.log);
  if (!cases) throw new Error(`no Granted & Noted list published for OT${term} yet`);

  cases.forEach((c) =>
    console.log(
      `  ${c.docket}  ${c.name}  (granted ${c.granted}${c.argued ? `, argued ${c.argued}` : ""})`
    )
  );

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
