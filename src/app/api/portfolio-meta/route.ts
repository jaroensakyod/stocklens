import { NextResponse } from "next/server";
import { findTvRow } from "@/lib/tvscanner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Meta {
  sector?: string; industry?: string; mcap?: number | null; beta?: number | null;
  roe?: number | null; netMargin?: number | null; de?: number | null; quality?: number;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// GET /api/portfolio-meta?s=NVDA,PTT.BK,... — sector/mcap/beta/คุณภาพอย่างคร่าวของหุ้นในพอร์ต (ใช้ตอนคำนวณ Balance Score)
export async function GET(req: Request) {
  try {
    const s = (new URL(req.url).searchParams.get("s") ?? "").trim();
    if (!s) return NextResponse.json({ error: "กรอก ?s=SYMBOL,SYMBOL" }, { status: 400 });
    const symbols = [...new Set(s.split(",").map((x) => x.trim().toUpperCase()).filter((x) => x && x.length <= 12))].slice(0, 60);

    const meta: Record<string, Meta> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const hit = await findTvRow(sym);
          if (!hit) {
            meta[sym] = {};
            return;
          }
          const r = hit.row;
          // คุณภาพอย่างคร่าว 0-100 จาก ROE/margin/หนี้ (ไม่ใช่ factor เต็ม แต่เพียงพอต่อการให้คะแนนพอร์ต)
          let q = 50;
          if (typeof r.roe === "number") q += clamp01((r.roe - 5) / 25) * 20 - 5;
          if (typeof r.netMargin === "number") q += clamp01(r.netMargin / 20) * 15 - 5;
          if (typeof r.de === "number") q += clamp01((1.2 - r.de) / 1.2) * 15 - 5;
          const out: Meta = { sector: r.sector || undefined, industry: r.industry || undefined, mcap: r.mcap, beta: r.beta };
          if (typeof r.roe === "number" || typeof r.netMargin === "number" || typeof r.de === "number") out.quality = Math.round(Math.min(95, Math.max(5, q)));
          meta[sym] = out;
        } catch {
          meta[sym] = {};
        }
      })
    );
    return NextResponse.json({ meta });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 150) }, { status: 500 });
  }
}
