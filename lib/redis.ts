import { Redis } from "@upstash/redis";
import { mergeTerm } from "./merge";
import type { CaseRecord, Meta } from "./types";

let client: Redis | null = null;
function redis(): Redis {
  client ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

const termKey = (term: number | string) => `scotusgami:term:${term}`;
const supplementKey = (term: number | string) => `scotusgami:supplement:${term}`;
const META_KEY = "scotusgami:meta";
const TERMS_KEY = "scotusgami:terms";

export async function saveTerm(term: number, cases: CaseRecord[]): Promise<void> {
  await redis().set(termKey(term), JSON.stringify(cases));
  await redis().sadd(TERMS_KEY, term);
}

/** SCDB-sourced records used only when Oyez lacks votes for a docket. */
export async function saveSupplement(term: number, cases: CaseRecord[]): Promise<void> {
  await redis().set(supplementKey(term), JSON.stringify(cases));
  await redis().sadd(TERMS_KEY, term);
}

function parseBlob(blob: string | CaseRecord[] | null): CaseRecord[] {
  if (!blob) return [];
  return typeof blob === "string" ? (JSON.parse(blob) as CaseRecord[]) : blob;
}

/** One term's Oyez-sourced records (no supplement merge). */
export async function loadTerm(term: number): Promise<CaseRecord[]> {
  return parseBlob(await redis().get<string | CaseRecord[] | null>(termKey(term)));
}

export async function loadAllCases(): Promise<CaseRecord[]> {
  const terms = ((await redis().smembers(TERMS_KEY)) as (string | number)[])
    .map(Number)
    .sort();
  if (terms.length === 0) return [];
  const blobs = await redis().mget<(string | CaseRecord[] | null)[]>(
    ...terms.flatMap((t) => [termKey(t), supplementKey(t)])
  );
  const all: CaseRecord[] = [];
  for (let i = 0; i < terms.length; i++) {
    all.push(...mergeTerm(parseBlob(blobs[2 * i]), parseBlob(blobs[2 * i + 1])));
  }
  all.sort((a, b) => a.decided.localeCompare(b.decided) || a.docket.localeCompare(b.docket));
  return all;
}

export async function saveMeta(meta: Meta): Promise<void> {
  await redis().set(META_KEY, JSON.stringify(meta));
}

export async function loadMeta(): Promise<Meta | null> {
  const raw = await redis().get<string | Meta | null>(META_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Meta) : raw;
}
