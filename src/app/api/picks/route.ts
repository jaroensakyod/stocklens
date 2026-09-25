import { NextResponse } from "next/server";
import { getPicks } from "@/lib/picks";

export const dynamic = "force-dynamic";

// GET /api/picks — Daily Picks (logic อยู่ใน lib เพื่อให้ Daily Brief ใช้ร่วมกันได้)
export async function GET() {
  return NextResponse.json(await getPicks());
}
