import { NextRequest, NextResponse } from "next/server";
import { getPuzzle } from "@/lib/pool-data";
import { localDateString } from "@/lib/game";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || localDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  const { client } = await getPuzzle(date);
  return NextResponse.json(client);
}
