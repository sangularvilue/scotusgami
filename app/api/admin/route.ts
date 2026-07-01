import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { encodeLineup } from "@/lib/grid";
import { JUSTICE_BY_ID, SENIORITY_IDS } from "@/lib/justices";
import { deleteManual, loadAllCases, upsertManual } from "@/lib/redis";
import type { CaseRecord, OpinionInfo, Side } from "@/lib/types";

export const dynamic = "force-dynamic";

const SIDES: Side[] = ["M", "D", "A", "T"];

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/** Fetch one merged case (for the modify form to prefill). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const term = req.nextUrl.searchParams.get("term")?.trim();
  const docket = req.nextUrl.searchParams.get("docket")?.trim();
  if (!term || !docket) return NextResponse.json({ error: "term and docket required" }, { status: 400 });
  const all = await loadAllCases();
  const found = all.find((c) => c.term === term && c.docket === docket) ?? null;
  return NextResponse.json({ case: found });
}

interface AdminPayload {
  term?: string;
  docket?: string;
  name?: string;
  decided?: string;
  winningParty?: string;
  question?: string;
  holding?: string;
  votes?: Record<string, string>;
  majorityAuthor?: string;
}

/** Add or modify a case (stored as a manual override, highest precedence). */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: AdminPayload;
  try {
    body = (await req.json()) as AdminPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const term = body.term?.trim();
  const docket = body.docket?.trim();
  const name = body.name?.trim();
  const decided = body.decided?.trim();
  if (!term || !/^\d{4}$/.test(term)) return NextResponse.json({ error: "term must be 4 digits (e.g. 2024)" }, { status: 400 });
  if (!docket) return NextResponse.json({ error: "docket required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!decided || !/^\d{4}-\d{2}-\d{2}$/.test(decided))
    return NextResponse.json({ error: "decided must be YYYY-MM-DD" }, { status: 400 });

  // Validate votes for all nine justices.
  const votes: Record<string, Side> = {};
  for (const id of SENIORITY_IDS) {
    const v = body.votes?.[id];
    if (!v || !SIDES.includes(v as Side))
      return NextResponse.json({ error: `vote for ${JUSTICE_BY_ID[id].lastName} must be one of M/D/A/T` }, { status: 400 });
    votes[id] = v as Side;
  }

  const vals = Object.values(votes);
  const tied = vals.filter((s) => s === "T").length;
  const maj = tied ? tied / 2 : vals.filter((s) => s === "M").length;
  const min = tied ? tied / 2 : vals.filter((s) => s === "D").length;
  if (!tied && maj <= min)
    return NextResponse.json({ error: `no majority side (${maj}–${min}); check the votes` }, { status: 400 });

  // Build a minimal opinions list: the named majority author writes the Court's
  // opinion, joined by the rest of the majority.
  const opinions: OpinionInfo[] = [];
  const author = body.majorityAuthor?.trim();
  if (author && votes[author] === "M") {
    opinions.push({
      type: "majority",
      author,
      joinedBy: SENIORITY_IDS.filter((id) => id !== author && votes[id] === "M"),
    });
  }

  const rec: CaseRecord = {
    term,
    docket,
    name,
    decided,
    question: body.question?.trim() ?? "",
    holding: body.holding?.trim() ?? "",
    winningParty: body.winningParty?.trim() ?? "",
    decisionType: tied ? "equally divided" : "",
    lineupKey: encodeLineup(votes),
    majority: maj,
    minority: min,
    votes,
    opinions,
    oyezUrl: "",
    justiaUrl: null,
    source: "manual",
  };

  await upsertManual(rec);
  revalidatePath("/");
  revalidatePath("/stats");
  return NextResponse.json({ ok: true, case: rec });
}

/** Remove a manual override. */
export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const term = req.nextUrl.searchParams.get("term")?.trim();
  const docket = req.nextUrl.searchParams.get("docket")?.trim();
  if (!term || !docket) return NextResponse.json({ error: "term and docket required" }, { status: 400 });
  const removed = await deleteManual(term, docket);
  revalidatePath("/");
  revalidatePath("/stats");
  return NextResponse.json({ ok: removed });
}
