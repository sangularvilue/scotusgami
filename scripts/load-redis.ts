/**
 * Load data/cases-{term}.json files (from scripts/backfill.ts) into Upstash Redis.
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env.local.
 *
 * Usage (from project root): npx tsx scripts/load-redis.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  // load .env.local manually (no next runtime here)
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=["']?([^"']*)["']?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* fall through to existing env */
  }

  const { saveTerm, saveSupplement, saveMeta, loadAllCases } = await import("../lib/redis");
  const dataDir = join(process.cwd(), "data");
  const files = readdirSync(dataDir);
  const terms = new Set<number>();
  for (const f of files.sort()) {
    const m = f.match(/^(cases|supplement)-(\d{4})\.json$/);
    if (!m) continue;
    const term = Number(m[2]);
    const cases = JSON.parse(readFileSync(join(dataDir, f), "utf8"));
    if (m[1] === "cases") await saveTerm(term, cases);
    else await saveSupplement(term, cases);
    terms.add(term);
    console.log(`loaded ${m[1]} ${term}: ${cases.length} records`);
  }
  const all = await loadAllCases();
  await saveMeta({
    lastRefresh: new Date().toISOString(),
    caseCount: all.length,
    terms: [...terms].sort(),
  });
  console.log(`done: ${all.length} merged cases across ${terms.size} terms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
