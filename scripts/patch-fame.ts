/**
 * Enrich data/*.json records with `fame` (recent Wikipedia pageviews).
 * Skips records that already have fame unless --force; --zeros also retries
 * records currently at 0 (e.g. after a throttled run). Strips the dead
 * viewCount field from earlier experiments.
 * Usage (from project root): npx tsx scripts/patch-fame.ts [--force|--zeros]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchFame } from "../lib/fame";
import type { CaseRecord } from "../lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const force = process.argv.includes("--force");
  const zeros = process.argv.includes("--zeros");
  const dir = join(process.cwd(), "data");
  const files = readdirSync(dir).filter((f) =>
    /^(cases|supplement)-\d{4}\.json$/.test(f)
  );
  for (const f of files) {
    const cases = JSON.parse(readFileSync(join(dir, f), "utf8")) as (CaseRecord & {
      viewCount?: number;
    })[];
    let patched = 0;
    for (const c of cases) {
      delete c.viewCount;
      const redo = force || c.fame === undefined || (zeros && !c.fame);
      if (!redo) continue;
      try {
        c.fame = await fetchFame(c.name);
        patched++;
      } catch (e) {
        console.log(`  [fail] ${c.name}: ${e}`);
      }
      await sleep(1500);
    }
    writeFileSync(join(dir, f), JSON.stringify(cases, null, 1));
    const top = [...cases].sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0))[0];
    console.log(
      `${f}: patched ${patched}/${cases.length} · most famous: ${top?.name} (${top?.fame})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
