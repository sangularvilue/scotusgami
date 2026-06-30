import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { sendNewGamiEmail, type NewGami } from "@/lib/email";
import { fetchFame } from "@/lib/fame";
import { splitLabel } from "@/lib/grid";
import { currentTerm, scrapeTerm } from "@/lib/oyez";
import { fetchDecided, reconcileDecided } from "@/lib/scotusgov";
import {
  loadAllCases,
  loadMeta,
  loadTerm,
  saveBingo,
  saveMeta,
  saveTerm,
} from "@/lib/redis";
import type { CaseRecord } from "@/lib/types";

export const maxDuration = 300; // Oyez scrape is sequential and polite
export const dynamic = "force-dynamic";

/**
 * Daily cron (11:00 EST / 16:00 UTC, see vercel.json): re-scrape the current
 * term from Oyez, upsert it into Redis, refresh the bingo card, and email when
 * a never-before-seen alignment lights up.
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

  // Reconcile the bingo cases against the Court's slip-opinion list so the card
  // reflects same-day hand-downs even while Oyez lags. Degrade to Oyez-only if
  // the fetch fails (e.g. the site blocks the request).
  let bingoCases = bingo;
  try {
    bingoCases = reconcileDecided(bingo, await fetchDecided(term));
  } catch {
    /* keep Oyez-only bingo */
  }
  await saveBingo(term, bingoCases);

  // NOTE: the upcoming term's granted pool (scotusgami:bingo:{term+1}) is NOT
  // refreshed here. Oyez badly under-lists a not-yet-argued term, so that pool
  // is sourced from the Court's authoritative Granted & Noted list via
  // `scripts/build-granted.ts` (run it when the Court grants more cases). The
  // cron deliberately leaves that key alone so it isn't clobbered with Oyez's
  // partial list.

  // Brand-new alignments contributed by this term (one entry per lineup key).
  const newByKey = new Map<string, CaseRecord>();
  for (const c of cases) {
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

  const all = await loadAllCases();
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
    bingo: bingo.length,
    totalCases: all.length,
    newGamis: newGamis.length,
    email,
  });
}
