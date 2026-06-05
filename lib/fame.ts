/**
 * Fame proxy for game rarity scoring: recent Wikipedia pageviews for the
 * case's article. No article (or no confident match) → 0 → maximally obscure.
 * (Oyez's view_count field exists but is no longer populated, so we can't
 * use it.)
 */

const UA = {
  headers: { "User-Agent": "scotusgami.grannis.xyz (fame scoring; personal project)" },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON with patient backoff on throttling; 404 returns null (known-missing). */
async function fetchJson<T>(url: string): Promise<T | null> {
  const backoffs = [5000, 15000, 45000];
  let lastStatus = 0;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const res = await fetch(url, UA);
      lastStatus = res.status;
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
    } catch {
      lastStatus = -1; // network error
    }
    if (attempt < backoffs.length)
      await sleep(backoffs[attempt] + Math.random() * 2000);
  }
  throw new Error(`wiki fetch failed (status ${lastStatus}): ${url}`);
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Sum of daily en-wiki pageviews for `title` over the last ~60 days. */
async function pageviews(title: string): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 86400000);
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  const data = await fetchJson<{ items?: { views: number }[] }>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${t}/daily/${yyyymmdd(start)}/${yyyymmdd(end)}`
  );
  return (data?.items ?? []).reduce((s, i) => s + i.views, 0);
}

/**
 * Find the case's Wikipedia article and return its recent pageviews.
 * Guards: the top search hit must look like a case article (" v. " in the
 * title) and its first party must appear in the case name — otherwise we
 * conclude no article exists and return 0. Throws on persistent network
 * failure (caller decides; don't conflate failure with obscurity).
 */
export async function fetchFame(caseName: string): Promise<number> {
  const q = encodeURIComponent(caseName);
  const data = await fetchJson<{ query?: { search?: { title: string }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${q}`
  );
  const title = data?.query?.search?.[0]?.title;
  if (!title || !title.includes(" v. ")) return 0;
  const firstPartyWord = title.split(" v. ")[0].split(" ")[0].toLowerCase();
  if (!caseName.toLowerCase().includes(firstPartyWord)) return 0;
  return await pageviews(title);
}
