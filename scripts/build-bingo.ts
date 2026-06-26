/**
 * Scrape the current term's argued cases (decided + pending) into
 * data/bingo-{term}.json and push them to Redis under scotusgami:bingo:{term}.
 *
 * Usage (from project root): npx tsx scripts/build-bingo.ts [term]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    /* fall through to existing env */
  }

  const { currentTerm, scrapeTerm } = await import("../lib/oyez");
  const { buildBingoGrid } = await import("../lib/bingo");
  const { fetchDecided, reconcileDecided } = await import("../lib/scotusgov");

  const term = Number(process.argv[2] ?? currentTerm());
  const { bingo: raw } = await scrapeTerm(term, console.log);

  // Layer the Court's authoritative slip-opinion list over Oyez so recent
  // hand-downs aren't mislabeled as pending.
  let bingo = raw;
  try {
    const decided = await fetchDecided(term);
    bingo = reconcileDecided(raw, decided);
    console.log(`slip opinions: ${decided.size} decided this term`);
  } catch (e) {
    console.log(`slip-opinion fetch failed (${e}); using Oyez only`);
  }

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, `bingo-${term}.json`),
    JSON.stringify(bingo, null, 1)
  );

  // summarize what we found, sitting by sitting
  const grid = buildBingoGrid(term, bingo);
  console.log(`\nOctober Term ${term}: ${grid.decidedCount} decided, ${grid.pendingCount} pending`);
  for (const s of grid.sittings) {
    const pend = s.pending.map((c) => c.name).join("; ");
    console.log(
      `  ${s.sitting.padEnd(9)} writ:${s.authored.length} owed:${s.owed.length}` +
        (pend ? `  still out → ${pend}` : "")
    );
  }

  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { saveBingo } = await import("../lib/redis");
    await saveBingo(term, bingo);
    console.log(`\npushed ${bingo.length} cases to Redis (scotusgami:bingo:${term})`);
  } else {
    console.log("\n(no Redis env — wrote file only)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
