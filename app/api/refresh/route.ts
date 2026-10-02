import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { sendNewGamiEmail, type NewGami } from "@/lib/email";
import { fetchFame } from "@/lib/fame";
import { fetchGranted, mergeBingo } from "@/lib/granted";
import { splitLabel } from "@/lib/grid";
import { currentTerm, scrapeTerm } from "@/lib/oyez";
import { fetchDecided, reconcileDecided } from "@/lib/scotusgov";
import {
  loadAllCases,
  loadBingo,
  loadMeta,
  loadTerm,
  saveBingo,
  saveMeta,
  saveTerm,
} from "@/lib/redis";
import type { BingoCase, CaseRecord } from "@/lib/types";

export const maxDuration = 300; // Oyez scrape is sequential and polite
export const dynamic = "force-dynamic";

/**
 * Daily cron (11:00 EST / 16:00 UTC, see vercel.json): re-scrape the current
 * term from Oyez, upsert it into Redis, refresh the bingo card (Oyez layered
 * over the Court's Granted & Noted calendar), and email when a never-before-seen
 * alignment lights up.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const term = currentTerm();

  // Snapshot the alignments that already exist BEFORE we overwrite this term,
  // so we can tell which the new scrape introduces.
  const beforeMeta = await loadMeta();
  const before = await loadAllCases();
  const prevKeys = new Set(before.map((c) => c.lineupKey));

  const { cases, skipped, bingo } = await scrapeTerm(term);

  // keep existing fame scores; fetch fame only for newly-seen dockets
  const prev = await loadTerm(term);
  const fameByDocket = new Map(prev.map((c) => [c.docket, c.fame]));
  for (const c of cases) {
    const known = fameByDocket.get(c.docket);
    if (known !== undefined) c.fame = known;
    else {
      try {
        c.fame = await fetchFame(c.name);
      } catch {
        /* leave undefined; next refresh retries */
      }
    }
  }
  await saveTerm(term, cases);

  // Bingo card, current term and the one ahead. The Court's Granted & Noted list
  // is the skeleton (every granted case, with its calendared argument date), and
  // Oyez's argued/decided cases are layered over it — Oyez alone only knows a
  // case once it has been argued, so replacing the card with Oyez's scrape blanked
  // it every October between the term flip and the first argument. If the list
  // can't be fetched, the previously stored card stands in for it, so a failed
  // fetch never drops cases.
  const bingoCounts: Record<number, number> = {};
  for (const t of [term, term + 1]) {
    let calendar: BingoCase[] | null = null;
    try {
      calendar = await fetchGranted(t);
    } catch {
      /* fall back to the stored card below */
    }
    calendar ??= await loadBingo(t);
    let bingoCases = mergeBingo(calendar, t === term ? bingo : []);
    if (!bingoCases.length) continue;

    // Reconcile against the Court's slip-opinion list so the card reflects
    // same-day hand-downs even while Oyez lags. Degrade to Oyez-only if the
    // fetch fails (e.g. the site blocks the request).
    if (t === term) {
      try {
        bingoCases = reconcileDecided(bingoCases, await fetchDecided(t));
      } catch {
        /* keep Oyez-only decisions */
      }
    }
    await saveBingo(t, bingoCases);
    bingoCounts[t] = bingoCases.length;
  }

  // Brand-new alignments, diffed against the SAME merged view the board shows
  // (`loadAllCases` = SCDB supplement where one exists, plus /admin manual
  // overrides). Diffing the raw Oyez scrape instead re-reported a case every
  // single day whenever Oyez's vote matrix disagreed with the record we
  // actually display — e.g. Oyez omitting a justice, so its 8–0 lineup key
  // never appeared on the board and so never landed in `prevKeys`.
  const all = await loadAllCases();
  const newByKey = new Map<string, CaseRecord>();
  for (const c of all) {
    if (!prevKeys.has(c.lineupKey) && !newByKey.has(c.lineupKey)) {
      newByKey.set(c.lineupKey, c);
    }
  }
  const newGamis: NewGami[] = [...newByKey.values()].map((c) => ({
    lineupKey: c.lineupKey,
    split: splitLabel(c.lineupKey),
    caseName: c.name,
    oyezUrl: c.oyezUrl,
    decided: c.decided,
  }));

  // Only notify once a baseline exists — never blast on the first seed.
  const email =
    beforeMeta && prevKeys.size > 0
      ? await sendNewGamiEmail(newGamis)
      : { sent: false, reason: "no baseline yet" };

  const terms = [...new Set([...(beforeMeta?.terms ?? []), term])].sort();
  await saveMeta({
    lastRefresh: new Date().toISOString(),
    caseCount: all.length,
    terms,
  });

  // Push the new data to the pages immediately rather than waiting for ISR —
  // on the Hobby plan this cron only runs once a day, so the refresh should be
  // reflected the moment it lands.
  revalidatePath("/bingo");
  revalidatePath("/");

  return NextResponse.json({
    term,
    parsed: cases.length,
    skipped: skipped.length,
    bingo: bingoCounts,
    totalCases: all.length,
    newGamis: newGamis.length,
    email,
  });
}
