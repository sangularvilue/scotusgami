import { NextRequest, NextResponse } from "next/server";
import { checkGuess } from "@/lib/pool-data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.date !== "string" || typeof body.cell !== "number" || typeof body.caseId !== "string")
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const result = await checkGuess(body.date, body.cell, body.caseId);
  return NextResponse.json(result);
}
