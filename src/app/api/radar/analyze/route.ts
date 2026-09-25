import { NextRequest, NextResponse } from "next/server";
import { chatOnce, hasAI, SYSTEM_EVENT } from "@/lib/ai";
import { buildChainsForNodeIds, keywordAnalyze } from "@/lib/radar";
import { getQuotes } from "@/lib/yahoo";
import { getTierFromRequest } from "@/lib/auth";
import type { ChainResult, EventAnalysis } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/radar/analyze { text } — วิเคราะห์เหตุการณ์ → ห่วงโซ่ผลกระทบ (AI ถ้ามี key, ไม่งั้นคีย์เวิร์ด)
export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || text.trim().length < 4) {
    return NextResponse.json({ error: "กรุณาพิมพ์เหตุการณ์อย่างน้อย 4 ตัวอักษร" }, { status: 400 });
  }

  // 1) ฐานจากระบบคีย์เวิร์ดเสมอ (การันตีว่ามี chain ต่อให้ AI พลาด)
  const base = await keywordAnalyze(text);

  // 2) ถ้ามี AI — ให้ LLM วิเคราะห์ทับ + เขียนบทวิเคราะห์
  if (hasAI() && getTierFromRequest(req) !== "free") { // free ใช้โหมดคีย์เวิร์ด — AI เป็นสิทธิ์สมาชิก
    try {
      const raw = await chatOnce(
        [
          { role: "system", content: SYSTEM_EVENT },
          { role: "user", content: `เหตุการณ์: ${text}\n\nห่วงโซ่ที่ระบบคีย์เวิร์ดเจอ (ใช้ประกอบ/ตรวจสอบ ไม่ต้องตามทั้งหมด): ${base.chains.map((c) => c.name).join(", ") || "ไม่พบ"}` },
        ],
        0.3
      );
      const jsonText = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonText) as {
        headline?: string;
        narrative?: string;
        chains?: { nodeId?: string; name: string; direction?: string; reason?: string; stocks?: { ticker: string; market?: string; direction?: string; strength?: string; reason?: string }[] }[];
      };
      // รวม stocks จาก AI + เติมราคาสดจาก chain ที่มี nodeId ตรง
      const aiNodeIds = (parsed.chains ?? []).map((c) => c.nodeId).filter(Boolean) as string[];
      const liveChains = await buildChainsForNodeIds(aiNodeIds);
      const merged = (parsed.chains ?? []).map((c) => {
        const live = liveChains.find((l) => l.eventId === c.nodeId);
        if (live) {
          return {
            eventId: c.nodeId ?? c.name,
            name: c.name,
            yahoo: live.yahoo,
            reason: c.reason || live.reason,
            stocks: (c.stocks ?? []).map((s) => ({
              ticker: s.ticker,
              market: (s.market as ChainResult["stocks"][number]["market"]) ?? "US",
              direction: (s.direction === "negative" ? "negative" : "positive") as ChainResult["stocks"][number]["direction"],
              strength: (s.strength as ChainResult["stocks"][number]["strength"]) ?? "medium",
              reason: s.reason ?? "",
              quote: live.stocks.find((l) => l.ticker === s.ticker)?.quote,
            })),
          };
        }
        return {
          eventId: c.nodeId ?? c.name,
          name: c.name,
          reason: c.reason ?? "",
          stocks: (c.stocks ?? []).map((s) => ({
            ticker: s.ticker,
            market: (s.market as ChainResult["stocks"][number]["market"]) ?? "US",
            direction: (s.direction === "negative" ? "negative" : "positive") as ChainResult["stocks"][number]["direction"],
            strength: (s.strength as ChainResult["stocks"][number]["strength"]) ?? "medium",
            reason: s.reason ?? "",
            quote: undefined as ChainResult["stocks"][number]["quote"],
          })),
        };
      });
      // เติมราคาสดให้ครบทุกตัว — batch + รอบสองลอง .BK สำหรับหุ้นไทยที่ AI พิมพ์ไม่มี suffix
      const finalChains = merged.length ? merged : base.chains;
      const attach = async (suffix: string) => {
        const need = [...new Set(finalChains.flatMap((c) => c.stocks.filter((s) => !s.quote && (suffix === '' ? true : !s.ticker.includes('.'))).map((s) => s.ticker + suffix)))].slice(0, 30);
        if (!need.length) return;
        const qmap = await getQuotes(need).catch(() => ({}) as Record<string, never>);
        for (const c of finalChains) {
          for (const s of c.stocks) {
            if (s.quote) continue;
            const q = (qmap as Record<string, ChainResult["stocks"][number]["quote"]>)[s.ticker + suffix];
            if (q && isFinite(q.price)) {
              s.quote = q;
              s.ticker = q.symbol; // แก้เป็น symbol จริง (DELTA → DELTA.BK) ให้ลิงก์หน้าหุ้นใช้ได้
            }
          }
        }
      };
      await attach('');
      await attach('.BK');
      return NextResponse.json({
        input: text,
        engine: "ai",
        headline: parsed.headline || base.headline,
        narrative: parsed.narrative || "",
        chains: finalChains,
        note: "วิเคราะห์โดย AI บนฐานความรู้ StockLens + ราคาสดจาก Yahoo — เป็นกรอบวิเคราะห์ ไม่ใช่คำแนะนำการลงทุน",
      });
    } catch {
      // AI พลาด → ใช้ผลคีย์เวิร์ด
    }
  }

  return NextResponse.json(base);
}
