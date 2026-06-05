import { NextRequest, NextResponse } from "next/server";
import { currentTerm, scrapeTerm } from "@/lib/oyez";
import { loadMeta, saveMeta, saveTerm } from "@/lib/redis";

export const maxDuration = 300; // Oyez scrape is sequential and polite
export const dynamic = "force-dynamic";

/**
 * Daily cron (11:15 EST / 16:15 UTC, see vercel.json): re-scrape the current
 * term from Oyez and upsert it into Redis.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const term = currentTerm();
  const { cases, skipped } = await scrapeTerm(term);
  await saveTerm(term, cases);

  const meta = await loadMeta();
  const terms = [...new Set([...(meta?.terms ?? []), term])].sort();
  // caseCount tracks the latest full picture; recompute cheaply from meta + this term
  const { loadAllCases } = await import("@/lib/redis");
  const all = await loadAllCases();
  await saveMeta({
    lastRefresh: new Date().toISOString(),
    caseCount: all.length,
    terms,
  });

  return NextResponse.json({
    term,
    parsed: cases.length,
    skipped: skipped.length,
    totalCases: all.length,
  });
}
