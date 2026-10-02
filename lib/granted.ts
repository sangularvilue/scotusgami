import type { BingoCase } from "./types";

/**
 * The Court's Granted & Noted list (supremecourt.gov/orders/{yy}grantednotedlist.pdf)
 * is the authoritative record of a term's merits docket: every case granted for
 * argument, and — once the Court calendars it — its argument date. Oyez badly
 * under-lists a not-yet-argued term (it had 9 of OT2026's 21 grants and even
 * disagreed on which) and only records a case as argued after the fact, so this
 * list is what lays out the sittings ahead of time. Oyez data is layered over it
 * by `mergeBingo` as cases are argued and decided.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const KEEP_UPPER = new Set([
  "LLC", "L.L.C.", "USA", "U.S.", "U.S.A.", "GA", "SEC", "RNC", "FCC", "EPA",
  "NLRB", "IRS", "TVA", "WBI", "CSX", "II", "III", "FBI", "DHS", "DOJ", "VA",
]);

/** Lower an ALL-CAPS official caption to readable title case (best effort). */
function titleCase(s: string): string {
  return s
    .replace(/[’]/g, "'")
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[^A-Za-z.]/g, "").toUpperCase();
      if (w.toUpperCase() === "V.") return "v.";
      if (KEEP_UPPER.has(bare)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

function toIso(mdy: string): string | null {
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

interface OyezSummary {
  docket_number: string;
  name: string;
}

/**
 * Every case on the term's Granted & Noted list as a BingoCase: `argued` is the
 * calendared argument date (null until the Court sets one), decided/author are
 * null. Returns null if the Court hasn't published a list for this term yet.
 */
export async function fetchGranted(
  term: number,
  log: (msg: string) => void = () => {}
): Promise<BingoCase[] | null> {
  const url = `https://www.supremecourt.gov/orders/${term % 100}grantednotedlist.pdf`;
  log(`fetching ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`granted/noted list ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Loaded lazily so a broken PDF toolchain fails this fetch (callers fall back
  // to the stored card) instead of the whole module graph. pdf-parse/worker's
  // CanvasFactory supplies the DOMMatrix/canvas polyfills pdfjs needs on
  // serverless Node, where they don't exist natively.
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const { text } = await new PDFParse({ data: buf, CanvasFactory }).getText();
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // Each case starts "{docket} {3-letter code} {NAME}" (name may wrap to the
  // next line), followed by "Granted: m/d/yy" and — once the Court calendars it
  // — an "Argument Date: m/d/yy". We scan a small window after each case line
  // for both. The argument date is what slots the case into a sitting; until it
  // appears the case stays in the granted pool.
  const caseLine = /^(\d{2}-\d{1,5})\*?\s+([CAQ][SFTMO][XYH])\s+(.+)$/;
  const parsed: {
    docket: string;
    name: string;
    granted: string | null;
    argued: string | null;
  }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(caseLine);
    if (!m) continue;
    // window = this line through the line before the next case (or +4 lines)
    let end = i + 1;
    while (end < lines.length && end < i + 5 && !lines[end].match(caseLine)) end++;
    const window = lines.slice(i, end).join(" ");
    const granted = window.match(/Granted:\s*(\d{1,2}\/\d{1,2}\/\d{2})/)?.[1] ?? null;
    const argued = window.match(/Argument Date:\s*(\d{1,2}\/\d{1,2}\/\d{2})/)?.[1] ?? null;
    parsed.push({
      docket: m[1],
      name: m[3],
      granted: granted ? toIso(granted) : null,
      argued: argued ? toIso(argued) : null,
    });
  }
  log(
    `granted/noted list: ${parsed.length} cases for argument ` +
      `(${parsed.filter((c) => c.argued).length} calendared)`
  );

  // Oyez names where available (nicer casing than the all-caps official list).
  const oyezByDocket = new Map<string, string>();
  try {
    const list = (await (
      await fetch(`https://api.oyez.org/cases?per_page=1000&filter=term:${term}`, {
        headers: { "User-Agent": "scotusgami.grannis.xyz (personal project)" },
      })
    ).json()) as OyezSummary[];
    for (const c of list) oyezByDocket.set(c.docket_number.trim(), c.name);
  } catch {
    log("(Oyez name lookup failed; using official captions)");
  }

  return parsed.map((c) => {
    const oyezName = oyezByDocket.get(c.docket);
    return {
      term: String(term),
      docket: c.docket,
      name: oyezName ?? titleCase(c.name),
      argued: c.argued,
      granted: c.granted,
      // sitting label is recomputed from the argument date by buildBingoGrid's
      // session clustering; store it too for reference.
      sitting: c.argued ? MONTH[new Date(`${c.argued}T00:00:00Z`).getUTCMonth()] : null,
      decided: null,
      majorityAuthor: null,
      oyezUrl: oyezName
        ? `https://www.oyez.org/cases/${term}/${c.docket}`
        : `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${c.docket}.html`,
    };
  });
}

/**
 * Layer Oyez's argued/decided cases over the Court's calendar. Per docket, the
 * Oyez record wins (it has the actual argument date, decision and author);
 * calendared cases Oyez hasn't reached yet keep their scheduled date, and Oyez
 * cases missing from the list (e.g. a holdover set for reargument) are kept.
 */
export function mergeBingo(calendar: BingoCase[], oyez: BingoCase[]): BingoCase[] {
  const byDocket = new Map(calendar.map((c) => [c.docket.trim(), c] as const));
  for (const o of oyez) {
    const base = byDocket.get(o.docket.trim());
    byDocket.set(o.docket.trim(), base ? { ...o, granted: o.granted ?? base.granted } : o);
  }
  return [...byDocket.values()];
}
