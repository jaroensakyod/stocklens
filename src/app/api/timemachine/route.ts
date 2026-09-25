import { NextRequest, NextResponse } from "next/server";
import { chatOnce, hasAI } from "@/lib/ai";
import { computeActual, gradeOf, HIST_EVENTS, radarPredict, scorePrediction, type Direction } from "@/lib/timemachine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AiPrediction {
  symbol: string;
  direction: Direction;
  magnitude: "weak" | "medium" | "strong";
  confidence: number;
  reason: string;
}

// POST /api/timemachine { includeAI?: boolean }
// ย้อนเวลาทำนายทุกเหตุการณ์ → เทียบผลจริงจากกราฟราคา → คะแนน+เกรด
export async function POST(req: NextRequest) {
  const { includeAI } = (await req.json().catch(() => ({}))) as { includeAI?: boolean };
  const useAI = !!includeAI && hasAI();

  const events = [];
  let radarPoints = 0, radarTotal = 0, aiPoints = 0, aiTotal = 0;

  for (const ev of HIST_EVENTS) {
    // 1) ทำนายด้วย Radar บริสุทธิ์
    const radar = await radarPredict(ev);
    // 2) ทำนายด้วย AI (ยืนอยู่ ณ วันนั้น — ไม่บอกผลลัพธ์ แต่ LLM อาจจำประวัติศาสตร์ได้ = โปร่งใสเรื่องนี้)
    let ai: AiPrediction[] = [];
    if (useAI) {
      try {
        const raw = await Promise.race([
          chatOnce(
            [
              {
                role: "system",
                content:
                  'คุณถูกจำลองให้ยืนอยู่ในวันเกิดเหตุการณ์จริง (ไม่มีข้อมูลอนาคต) ทำนายทิศทางราคาหลังเหตุการณ์ ตามกรอบวิเคราะห์เชิงเหตุผลเท่านั้น ตอบเป็น JSON เท่านั้น: {"predictions":[{"symbol":"CL=F","direction":"up|down|flat","magnitude":"weak|medium|strong","confidence":0-100,"reason":"สั้นๆ ไทย"}]} — flat = เคลื่อนไหว <3%',
              },
              { role: "user", content: `วันที่ ${ev.date}: ${ev.context}\n\nทำนายราคา ${ev.horizonDays} วันข้างหน้า สำหรับ: ${ev.instruments.map((i) => i.symbol).join(", ")}` },
            ],
            0.3
          ),
          new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 45_000)),
        ]);
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { predictions?: AiPrediction[] };
        ai = (parsed.predictions ?? []).filter((p) => p && p.symbol && ["up", "down", "flat"].includes(p.direction));
      } catch {
        ai = [];
      }
    }

    // 3) เทียบผลจริง
    const rows = [];
    for (const inst of ev.instruments) {
      const actual = await computeActual(inst.symbol, ev.date, ev.horizonDays);
      const rPred = radar.get(inst.symbol) ?? null;
      const rScore = actual && rPred ? scorePrediction(rPred, actual) : null;
      if (rScore !== null) {
        radarPoints += rScore;
        radarTotal += 1;
      }
      const aPred = ai.find((p) => p.symbol.toUpperCase() === inst.symbol.toUpperCase()) ?? null;
      const aScore = actual && aPred ? scorePrediction(aPred, actual) : null;
      if (aScore !== null) {
        aiPoints += aScore;
        aiTotal += 1;
      }
      rows.push({
        symbol: inst.symbol,
        name: inst.name,
        radar: rPred,
        radarScore: rScore,
        ai: aPred,
        aiScore: aScore,
        actual: actual ? { pct: Math.round(actual.pct * 10) / 10, direction: actual.direction } : null,
      });
    }
    events.push({ id: ev.id, date: ev.date, title: ev.title, horizonDays: ev.horizonDays, rows });
  }

  const radarAcc = radarTotal ? (radarPoints / radarTotal) * 100 : 0;
  const aiAcc = aiTotal ? (aiPoints / aiTotal) * 100 : 0;
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    includeAI: useAI,
    summary: {
      radar: { accuracy: Math.round(radarAcc), predicted: radarTotal, totalInstruments: HIST_EVENTS.reduce((a, e) => a + e.instruments.length, 0), ...gradeOf(radarAcc) },
      ai: useAI ? { accuracy: Math.round(aiAcc), predicted: aiTotal, ...gradeOf(aiAcc) } : null,
    },
    events,
  });
}
