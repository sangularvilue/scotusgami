/**
 * Bulk fame enrichment that dodges api.php rate limits: ONE search-API call
 * per term (links of the "{term} term opinions of the Supreme Court of the
 * United States" page) to learn article titles, then pageviews from the
 * wikimedia.org REST host (separate, generous limits). Unmatched cases → 0.
 * Usage (from project root): npx tsx scripts/fame-bulk.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseRecord } from "../lib/types";

const UA = {
  headers: { "User-Agent": "scotusgami.grannis.xyz (fame scoring; personal project)" },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

async function getJson<T>(url: string): Promise<T | null> {
  // marathon mode: the office IP shares Wikimedia's anonymous rate budget,
  // so be prepared to wait out multi-minute penalty windows.
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(240000, 15000 * 2 ** (attempt - 1));
      await sleep(backoff + Math.random() * 5000);
    }
    try {
      const res = await fetch(url, UA);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
      console.log(`  [${res.status}] attempt ${attempt + 1} ${url.slice(0, 80)}…`);
    } catch (e) {
      console.log(`  [neterr] ${e}`);
    }
  }
  throw new Error(`fetch failed: ${url}`);
}

/**
 * Case-article links on the per-term opinions page, scraped from the plain
 * HTML (edge-cached, separate rate bucket from the heavily-throttled api.php).
 */
async function termArticleTitles(term: string): Promise<string[]> {
  const page = `${term}_term_opinions_of_the_Supreme_Court_of_the_United_States`;
  const url = `https://en.wikipedia.org/wiki/${page}`;
  for (const backoff of [0, 10000, 30000]) {
    if (backoff) await sleep(backoff);
    const res = await fetch(url, UA);
    if (!res.ok) {
      console.log(`  [${res.status}] ${url}`);
      continue;
    }
    const html = await res.text();
    const titles = new Set<string>();
    for (const m of html.matchAll(/href="\/wiki\/([^"#?]+)"/g)) {
      const title = decodeURIComponent(m[1]).replace(/_/g, " ");
      if (title.includes(" v. ") && !title.includes(":")) titles.add(title);
    }
    return [...titles];
  }
  throw new Error(`could not fetch ${url}`);
}

/**
 * All plausible article titles for a case (both parties' lead tokens must
 * appear in our case name). Multiple candidates happen when the term page
 * links a redirect title — fame is the MAX views across candidates, since
 * redirect pages get ~zero direct views while the canonical article gets all.
 */
function matchTitles(ourName: string, titles: string[]): string[] {
  const ours = ourName.toLowerCase();
  return titles.filter((t) => {
    const [a, b] = t.split(" v. ");
    if (!a || !b) return false;
    const a0 = a.toLowerCase().split(" ")[0];
    const b0 = b.toLowerCase().replace(/\s*\(.*\)$/, "").split(" ")[0];
    return ours.includes(a0) && ours.includes(b0);
  });
}

/**
 * Resolve a (possible) redirect to its canonical article title by reading
 * the HTML page's rel=canonical link — avoids the throttled api.php.
 */
async function canonicalTitle(title: string): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      UA
    );
    if (!res.ok) return title;
    const html = await res.text();
    const m = html.match(
      /<link rel="canonical" href="https:\/\/en\.wikipedia\.org\/wiki\/([^"]+)"/
    );
    return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : title;
  } catch {
    return title;
  }
}

async function pageviews(title: string): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 86400000);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const data = await getJson<{ items?: { views: number }[] }>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/daily/${yyyymmdd(start)}/${yyyymmdd(end)}`
  );
  return (data?.items ?? []).reduce((s, i) => s + i.views, 0);
}

async function main() {
  const dir = join(process.cwd(), "data");
  const files = readdirSync(dir).filter((f) =>
    /^(cases|supplement)-\d{4}\.json$/.test(f)
  );
  const terms = [...new Set(files.map((f) => f.match(/\d{4}/)![0]))].sort();

  const titlesByTerm = new Map<string, string[]>();
  for (const term of terms) {
    const titles = await termArticleTitles(term);
    titlesByTerm.set(term, titles);
    console.log(`term ${term}: ${titles.length} case articles on Wikipedia`);
    await sleep(2000);
  }

  // title → views cache persisted to disk so interrupted runs resume cheaply
  const cachePath = join(dir, ".fame-cache.json");
  let viewsCache = new Map<string, number>();
  try {
    viewsCache = new Map(Object.entries(JSON.parse(readFileSync(cachePath, "utf8"))));
    // low-view entries may be unresolved redirects — re-check them
    for (const [t, v] of viewsCache) if (v < 500) viewsCache.delete(t);
  } catch {
    /* first run */
  }
  const saveCache = () =>
    writeFileSync(cachePath, JSON.stringify(Object.fromEntries(viewsCache)));

  for (const f of files) {
    const cases = JSON.parse(readFileSync(join(dir, f), "utf8")) as (CaseRecord & {
      viewCount?: number;
    })[];
    let matched = 0;
    for (const c of cases) {
      delete c.viewCount;
      const titles = matchTitles(c.name, titlesByTerm.get(c.term) ?? []);
      if (titles.length === 0) {
        c.fame = 0;
        continue;
      }
      let best = 0;
      for (const title of titles) {
        if (!viewsCache.has(title)) {
          let views = await pageviews(title);
          if (views < 500) {
            // low views often mean the term page linked a redirect
            const canon = await canonicalTitle(title);
            if (canon !== title) views = Math.max(views, await pageviews(canon));
          }
          viewsCache.set(title, views);
          saveCache();
          await sleep(3000);
        }
        best = Math.max(best, viewsCache.get(title)!);
      }
      c.fame = best;
      matched++;
    }
    writeFileSync(join(dir, f), JSON.stringify(cases, null, 1));
    const top = [...cases].sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0))[0];
    console.log(
      `${f}: ${matched}/${cases.length} matched · top: ${top?.name.slice(0, 50)} (${top?.fame})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
