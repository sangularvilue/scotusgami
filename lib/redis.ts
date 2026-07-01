import { Redis } from "@upstash/redis";
import { mergeTerm } from "./merge";
import type { BingoCase, CaseRecord, Meta } from "./types";

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
const bingoKey = (term: number | string) => `scotusgami:bingo:${term}`;
const META_KEY = "scotusgami:meta";
const TERMS_KEY = "scotusgami:terms";
const MANUAL_KEY = "scotusgami:manual";

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
  // Manual overrides (from /admin) win over — or add to — everything else.
  const manual = await loadManual();
  if (manual.length) {
    const byKey = new Map(all.map((c) => [`${c.term}:${c.docket}`, c]));
    for (const m of manual) byKey.set(`${m.term}:${m.docket}`, m);
    all.length = 0;
    all.push(...byKey.values());
  }
  all.sort((a, b) => a.decided.localeCompare(b.decided) || a.docket.localeCompare(b.docket));
  return all;
}

/** Hand-entered / hand-edited cases from the /admin route, keyed term:docket. */
export async function loadManual(): Promise<CaseRecord[]> {
  const blob = await redis().get<string | CaseRecord[] | null>(MANUAL_KEY);
  if (!blob) return [];
  return typeof blob === "string" ? (JSON.parse(blob) as CaseRecord[]) : blob;
}

export async function saveManual(records: CaseRecord[]): Promise<void> {
  await redis().set(MANUAL_KEY, JSON.stringify(records));
}

/** Insert or replace one manual case (matched on term:docket). */
export async function upsertManual(rec: CaseRecord): Promise<CaseRecord[]> {
  const all = await loadManual();
  const i = all.findIndex((c) => c.term === rec.term && c.docket === rec.docket);
  if (i >= 0) all[i] = rec;
  else all.push(rec);
  await saveManual(all);
  return all;
}

/** Remove one manual case; returns true if something was deleted. */
export async function deleteManual(term: string, docket: string): Promise<boolean> {
  const all = await loadManual();
  const next = all.filter((c) => !(c.term === term && c.docket === docket));
  if (next.length === all.length) return false;
  await saveManual(next);
  return true;
}

/** Argued merits cases (decided + pending) for the bingo card. */
export async function saveBingo(term: number, cases: BingoCase[]): Promise<void> {
  await redis().set(bingoKey(term), JSON.stringify(cases));
}

export async function loadBingo(term: number): Promise<BingoCase[]> {
  const blob = await redis().get<string | BingoCase[] | null>(bingoKey(term));
  if (!blob) return [];
  return typeof blob === "string" ? (JSON.parse(blob) as BingoCase[]) : blob;
}

export async function saveMeta(meta: Meta): Promise<void> {
  await redis().set(META_KEY, JSON.stringify(meta));
}

export async function loadMeta(): Promise<Meta | null> {
  const raw = await redis().get<string | Meta | null>(META_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as Meta) : raw;
}
