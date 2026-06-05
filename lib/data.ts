import type { CaseRecord, Meta } from "./types";

/**
 * Load all cases: from Upstash Redis in production, falling back to the local
 * data/*.json files (backfill + supplement script output) when no Redis env
 * is configured (local dev before credentials are set).
 */
export async function loadData(): Promise<{ cases: CaseRecord[]; meta: Meta | null }> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { loadAllCases, loadMeta } = await import("./redis");
    const [cases, meta] = await Promise.all([loadAllCases(), loadMeta()]);
    return { cases, meta };
  }

  // local fallback: data/cases-{term}.json + data/supplement-{term}.json
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { mergeTerm } = await import("./merge");
  const dir = join(process.cwd(), "data");
  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    return { cases: [], meta: null };
  }
  const read = (f: string) =>
    JSON.parse(readFileSync(join(dir, f), "utf8")) as CaseRecord[];
  const terms = [
    ...new Set(
      files
        .map((f) => f.match(/^(?:cases|supplement)-(\d{4})\.json$/)?.[1])
        .filter(Boolean) as string[]
    ),
  ].sort();
  const cases: CaseRecord[] = [];
  for (const term of terms) {
    const oyez = files.includes(`cases-${term}.json`) ? read(`cases-${term}.json`) : [];
    const supp = files.includes(`supplement-${term}.json`)
      ? read(`supplement-${term}.json`)
      : [];
    cases.push(...mergeTerm(oyez, supp));
  }
  cases.sort((a, b) => a.decided.localeCompare(b.decided) || a.docket.localeCompare(b.docket));
  return {
    cases,
    meta: { lastRefresh: "", caseCount: cases.length, terms: terms.map(Number) },
  };
}
