/**
 * Mark the notable subset of the pool and attach fame (Wikipedia pageviews).
 * 1. Scrape per-Court "List of United States Supreme Court cases by the X
 *    Court" pages (tolerant HTML host) → (article title, U.S. cite) pairs.
 * 2. Join to data/pool.json on normalized usCite.
 * 3. Fetch ~60-day pageviews per matched title (REST host; marathon backoff,
 *    redirect resolution, disk cache).
 * Non-notable cases get fame 0 (→ max points). Writes pool.json in place.
 *
 * Usage (from project root): npx tsx scripts/notable-fame.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PoolCase } from "./build-pool";

const UA = {
  headers: { "User-Agent": "scotusgami.grannis.xyz (fame scoring; personal project)" },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// U.S. Reports volumes spanning the modern pool (329 = OT1946 … 606 = OT2024).
const VOL_MIN = 329;
const VOL_MAX = 606;

const normCite = (s: string): string | null => {
  const m = s.match(/(\d+)\s*U\.?\s*S\.?\s*(\d+)/);
  return m ? `${m[1]} U.S. ${m[2]}` : null;
};

async function getText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt) await sleep(Math.min(180000, 10000 * 2 ** (attempt - 1)) + Math.random() * 4000);
    try {
      const res = await fetch(url, UA);
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
      console.log(`  [${res.status}] attempt ${attempt + 1} ${url.slice(0, 70)}…`);
    } catch (e) {
      console.log(`  [neterr] ${e}`);
    }
  }
  throw new Error(`fetch failed: ${url}`);
}

async function getJson<T>(url: string): Promise<T | null> {
  const t = await getText(url);
  return t ? (JSON.parse(t) as T) : null;
}

/** Strip tags + decode the few entities these tables use → plain text. */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#32;|&#160;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** (usCite → title) from a court-list HTML page, parsed row by row. */
function parseCourtPage(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of html.split("<tr")) {
    // the case article is the first /wiki/ link whose text contains " v. "
    const link = row.match(/href="\/wiki\/([^"#?:]+)"[^>]*title="([^"]*\sv\.\s[^"]*)"/);
    if (!link) continue;
    const title = decodeURIComponent(link[1]).replace(/_/g, " ");
    if (!title.includes(" v. ") || title.startsWith("List of")) continue;
    const cite = normCite(plain(row));
    if (cite && !out.has(cite)) out.set(cite, title);
  }
  return out;
}

async function canonicalTitle(title: string): Promise<string> {
  const html = await getText(
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
  );
  if (!html) return title;
  const m = html.match(
    /<link rel="canonical" href="https:\/\/en\.wikipedia\.org\/wiki\/([^"]+)"/
  );
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : title;
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
async function pageviews(title: string): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 86400000);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const data = await getJson<{ items?: { views: number }[] }>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/daily/${yyyymmdd(start)}/${yyyymmdd(end)}`
  );
  return (data?.items ?? []).reduce((s, i) => s + i.views, 0);
}

/** Case-article titles from a "{term} term opinions…" page (no cite needed). */
function parseTermPage(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="\/wiki\/([^"#?:]+)"[^>]*title="([^"]*\sv\.\s[^"]*)"/g)) {
    const title = decodeURIComponent(m[1]).replace(/_/g, " ");
    if (title.includes(" v. ") && !title.startsWith("List of")) out.add(title);
  }
  return [...out];
}

const lead = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ].*$/, "").trim().split(/\s+/)[0] ?? "";

/** Token-match a Wikipedia case title to a SCDB pool case within one term. */
function nameMatch(title: string, candidates: PoolCase[]): PoolCase | null {
  const [pa, pb] = title.split(" v. ");
  if (!pa || !pb) return null;
  const a = lead(pa);
  const b = lead(pb);
  const hits = candidates.filter((c) => {
    const n = c.name.toLowerCase();
    return a.length > 2 && b.length > 2 && n.includes(a) && n.includes(b);
  });
  return hits.length === 1 ? hits[0] : null;
}

async function main() {
  // 1. collect cite → title from every U.S. Reports volume-list page. Each
  //    lists the volume's cases; blue links (real /wiki/ articles) are notable,
  //    redlinks are skipped by parseCourtPage. Comprehensive across all eras.
  const citeToTitle = new Map<string, string>();
  for (let vol = VOL_MIN; vol <= VOL_MAX; vol++) {
    const html = await getText(
      `https://en.wikipedia.org/wiki/List_of_United_States_Supreme_Court_cases,_volume_${vol}`
    );
    if (!html) {
      console.log(`vol ${vol}: 404`);
      continue;
    }
    const m = parseCourtPage(html);
    for (const [cite, title] of m) if (!citeToTitle.has(cite)) citeToTitle.set(cite, title);
    if (vol % 20 === 0) console.log(`…vol ${vol}, cites so far ${citeToTitle.size}`);
    await sleep(500);
  }
  console.log(`total cited→title: ${citeToTitle.size}`);

  // cases later overruled by a subsequent decision (curated Wikipedia list).
  // First case-link + first cite per row = the overruled precedent.
  const overruledCites = new Set<string>();
  {
    const html = await getText(
      "https://en.wikipedia.org/wiki/List_of_overruled_United_States_Supreme_Court_decisions"
    );
    if (html) {
      for (const row of html.split("<tr")) {
        if (!/href="\/wiki\/[^"]*"[^>]*title="[^"]*\sv\.\s[^"]*"/.test(row)) continue;
        const cite = normCite(plain(row));
        if (cite) overruledCites.add(cite);
      }
      console.log(`overruled list: ${overruledCites.size} cited cases`);
    }
  }

  const poolPath = join(process.cwd(), "data", "pool.json");
  const pool = JSON.parse(readFileSync(poolPath, "utf8")) as PoolCase[];
  const byTerm = new Map<number, PoolCase[]>();
  for (const c of pool) {
    if (!byTerm.has(c.term)) byTerm.set(c.term, []);
    byTerm.get(c.term)!.push(c);
  }

  const titleByCase = new Map<string, string>();
  // 2a. cite-join (court pages)
  for (const c of pool) {
    const cite = c.usCite ? normCite(c.usCite) : null;
    const title = cite ? citeToTitle.get(cite) : undefined;
    if (title) titleByCase.set(c.id, title);
  }
  console.log(`cite-join: ${titleByCase.size}`);

  // 2b. name-join from per-term opinion pages (fills recent terms)
  for (let term = 2000; term <= 2024; term++) {
    const html = await getText(
      `https://en.wikipedia.org/wiki/${term}_term_opinions_of_the_Supreme_Court_of_the_United_States`
    );
    await sleep(1500);
    if (!html) continue;
    const titles = parseTermPage(html);
    const cands = byTerm.get(term) ?? [];
    let n = 0;
    for (const t of titles) {
      const c = nameMatch(t, cands);
      if (c && !titleByCase.has(c.id)) {
        titleByCase.set(c.id, t);
        n++;
      }
    }
    console.log(`term ${term}: ${titles.length} titles, +${n} matched`);
  }

  let matched = 0;
  let overruledN = 0;
  for (const c of pool) {
    if (titleByCase.has(c.id)) {
      c.notable = true;
      matched++;
    } else {
      c.notable = false;
      c.fame = 0;
    }
    const cite = c.usCite ? normCite(c.usCite) : null;
    c.overruled = !!cite && overruledCites.has(cite);
    if (c.overruled) overruledN++;
  }
  console.log(`pool join: ${matched}/${pool.length} notable, ${overruledN} overruled`);

  if (process.argv.includes("--join-only")) {
    writeFileSync(poolPath, JSON.stringify(pool));
    console.log("wrote notable flags (fame deferred)");
    return;
  }

  // 3. fame per title (disk cache)
  const cachePath = join(process.cwd(), "data", ".fame-cache.json");
  let cache = new Map<string, number>();
  try {
    cache = new Map(Object.entries(JSON.parse(readFileSync(cachePath, "utf8"))));
  } catch {
    /* first run */
  }
  const save = () =>
    writeFileSync(cachePath, JSON.stringify(Object.fromEntries(cache)));

  if (process.argv.includes("--cache-only")) {
    // apply already-fetched fames; no live fetching. Notable cases not yet
    // measured stay at fame 0 (treated as obscure) until a later pass fills them.
    let applied = 0;
    for (const c of pool) {
      const title = titleByCase.get(c.id);
      if (title && cache.has(title)) {
        c.fame = cache.get(title)!;
        applied++;
      } else if (c.notable) c.fame = 0;
    }
    writeFileSync(poolPath, JSON.stringify(pool));
    console.log(`cache-only: applied ${applied} fames of ${matched} notable`);
    return;
  }

  let done = 0;
  for (const c of pool) {
    const title = titleByCase.get(c.id);
    if (!title) continue;
    if (!cache.has(title)) {
      let v = await pageviews(title);
      if (v < 500) {
        const canon = await canonicalTitle(title);
        if (canon !== title) v = Math.max(v, await pageviews(canon));
      }
      cache.set(title, v);
      save();
      await sleep(2500);
    }
    c.fame = cache.get(title)!;
    if (++done % 100 === 0) {
      writeFileSync(poolPath, JSON.stringify(pool));
      console.log(`  fame ${done}/${matched}`);
    }
  }

  writeFileSync(poolPath, JSON.stringify(pool));
  const notable = pool.filter((c) => (c.fame ?? 0) > 0);
  const top = [...notable].sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0)).slice(0, 8);
  console.log(`done: ${notable.length} notable with fame`);
  for (const c of top) console.log(`  ${c.fame}\t${c.name.slice(0, 55)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
