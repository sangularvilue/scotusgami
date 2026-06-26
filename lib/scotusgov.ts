import type { BingoCase } from "./types";

/**
 * supremecourt.gov's slip-opinion list is the authoritative, same-day record of
 * which OT cases have come down and who wrote them — Oyez can trail it by weeks
 * at the end of a term. We layer it over the Oyez-derived bingo cases so that
 * recently-handed-down opinions stop showing as "pending."
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// The slip table's "J." column → our Oyez justice ids. "PC" (per curiam) and any
// unrecognized code resolve to null (decided, but no single assigned author).
const AUTHOR_CODE: Record<string, string> = {
  R: "john_g_roberts_jr",
  T: "clarence_thomas",
  A: "samuel_a_alito_jr",
  SS: "sonia_sotomayor",
  EK: "elena_kagan",
  NG: "neil_gorsuch",
  BK: "brett_m_kavanaugh",
  AB: "amy_coney_barrett",
  KJ: "ketanji_brown_jackson",
};

export interface DecidedOpinion {
  author: string | null;
  decided: string; // ISO
}

function toIso(mdy: string): string | null {
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** docket → {author, decided} for every slip opinion issued this term. */
export async function fetchDecided(term: number): Promise<Map<string, DecidedOpinion>> {
  const url = `https://www.supremecourt.gov/opinions/slipopinion/${term % 100}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`slip opinions ${res.status}`);
  const html = await res.text();

  const out = new Map<string, DecidedOpinion>();
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (cells.length < 5 || cells[0] === "R-") continue; // header / non-data row
    const decided = toIso(cells[1]);
    const docket = cells[2];
    const code = cells[4];
    if (!docket || !decided) continue;
    out.set(docket, { author: AUTHOR_CODE[code] ?? null, decided });
  }
  return out;
}

/**
 * Fold the authoritative decided list into the Oyez-derived cases: anything the
 * Court has handed down is marked decided (with its author) even if Oyez hasn't
 * caught up. Cases absent from the slip list stay pending.
 */
export function reconcileDecided(
  cases: BingoCase[],
  decided: Map<string, DecidedOpinion>
): BingoCase[] {
  return cases.map((c) => {
    if (c.decided && c.majorityAuthor) return c; // Oyez already has it
    const d = decided.get(c.docket.trim());
    if (!d) return c; // genuinely still out
    return {
      ...c,
      decided: c.decided ?? d.decided,
      majorityAuthor: c.majorityAuthor ?? d.author,
    };
  });
}
