import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/pool-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  return NextResponse.json(search(q));
}
