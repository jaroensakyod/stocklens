// ===== Options Paper Cron (ยิงวันละครั้ง) — AI จำลองเทรด option จริง =====
// 1. Mark-to-market ไม้เปิด (ยิง chain จริง)
// 2. Hard exit: TP ≥+60% / SL ≤-40% / หมดอายุ ≤2 วัน
// 3. AI exit: ไม้สวนทาง → Gemini ประเมินถือ/ออก
// 4. เปิดไม้ใหม่ถ้า < 3 เปิด: สแกน Daily Picks → analyze → เปิดเมื่อ confidence ≥ 65
// ตั้งเวลา: pinger (cron-job.org) ยิงวันละ 1 ครั้ง ~เที่ยงไทย (ตลาด US ปิด = ข้อมูลนิ่งเทียบง่าย)
import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, hasDB } from "@/lib/storage";
import { getChain, findContract } from "@/lib/optionChain";
import { chatOnce, hasAI } from "@/lib/ai";
import { getPicks } from "@/lib/picks";
import type { PaperTrade } from "../../options/paper/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KEY = "optpaper:ai";
const MAX_OPEN = 3;
const TP_PCT = 0.60;   // +60% ของ premium
const SL_PCT = -0.40;  // -40% ของ premium
const OPEN_CONFIDENCE = 65;

async function run(): Promise<NextResponse> {
  if (!hasDB()) {
    return NextResponse.json({ ok: true, skipped: "ยังไม่ต่อ Redis — paper engine ปิดอยู่" });
  }
  let trades = (await kvGet<PaperTrade[]>(KEY)) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const actions: string[] = [];

  // ===== 1+2) Mark-to-market + hard exit =====
  for (const t of trades.filter((x) => x.status === "open")) {
    try {
      const chain = await getChain(t.symbol, t.expiry);
      const c = chain ? findContract(chain, t.type, t.strike) : null;
      const price = c?.mid ?? 0;

      if (price <= 0) {
        // หา chain ไม่ได้ (หมดอายุแล้ว?) → ตรวจวันหมดอายุ
        const daysLeft = Math.ceil((Date.parse(t.expiry) - Date.now()) / 864e5);
        if (daysLeft <= 0) {
          // หมดอายุ: ITM = intrinsic / OTM = 0 (ต้องดูราคา underlying)
          const chainAny = await getChain(t.symbol, t.expiry).catch(() => null);
          const S = chainAny?.underlyingPrice ?? 0;
          const intrinsic = t.type === "call" ? Math.max(0, S - t.strike) : Math.max(0, t.strike - S);
          const exitP = intrinsic;
          const pnl = (exitP - t.entryPrice) * t.qty * 100;
          t.status = "closed";
          t.exitPrice = exitP;
          t.exitDate = today;
          t.exitReason = intrinsic > 0 ? `หมดอายุ ITM (intrinsic $${intrinsic.toFixed(2)})` : "หมดอายุ OTM (premium = 0)";
          t.pnlUsd = pnl;
          t.pnlPct = ((exitP - t.entryPrice) / t.entryPrice) * 100;
          actions.push(`ปิด ${t.symbol} ${t.type.toUpperCase()} ${t.strike}: ${t.exitReason} → ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}`);
        }
        continue;
      }

      const pnlPct = (price - t.entryPrice) / t.entryPrice;

      // เช็ควันหมดอายุ
      const daysLeft = Math.ceil((Date.parse(t.expiry) - Date.now()) / 864e5);

      if (pnlPct >= TP_PCT) {
        const pnl = (price - t.entryPrice) * t.qty * 100;
        t.status = "closed";
        t.exitPrice = price;
        t.exitDate = today;
        t.exitReason = `TP ถึงเป้า +${Math.round(pnlPct * 100)}%`;
        t.pnlUsd = pnl;
        t.pnlPct = pnlPct * 100;
        actions.push(`🎯 TP ${t.symbol} ${t.type.toUpperCase()} ${t.strike}: +${Math.round(pnlPct * 100)}% → +$${pnl.toFixed(0)}`);
      } else if (pnlPct <= SL_PCT) {
        const pnl = (price - t.entryPrice) * t.qty * 100;
        t.status = "closed";
        t.exitPrice = price;
        t.exitDate = today;
        t.exitReason = `SL ตัดขาดทุน ${Math.round(pnlPct * 100)}%`;
        t.pnlUsd = pnl;
        t.pnlPct = pnlPct * 100;
        actions.push(`🛑 SL ${t.symbol} ${t.type.toUpperCase()} ${t.strike}: ${Math.round(pnlPct * 100)}% → $${pnl.toFixed(0)}`);
      } else if (daysLeft <= 2) {
        // ใกล้หมดอายุ: ปิดที่ราคาปัจจุบัน (หลีกเลี่ยง theta death)
        const pnl = (price - t.entryPrice) * t.qty * 100;
        t.status = "closed";
        t.exitPrice = price;
        t.exitDate = today;
        t.exitReason = `ปิดก่อนหมดอายุ ${daysLeft} วัน (${pnl >= 0 ? "+" : ""}${Math.round(pnlPct * 100)}%)`;
        t.pnlUsd = pnl;
        t.pnlPct = pnlPct * 100;
        actions.push(`⏰ ปิดก่อนหมดอายุ ${t.symbol}: ${Math.round(pnlPct * 100)}%`);
      } else {
        // ===== 3) AI exit evaluation (เฉพาะไม้ขาดทุน > 20% แต่ยังไม่โดน SL) =====
        if (pnlPct <= -0.20 && hasAI()) {
          const aiText = await chatOnce(
            [
              {
                role: "system",
                content: "คุณคือผู้จัดการความเสี่ยง options พอร์ตจำลอง — ตอบ JSON: {\"action\":\"hold|close\",\"reason\":\"เหตุผลสั้นภาษาไทย\"}",
              },
              {
                role: "user",
                content: `ไม้: ${t.type.toUpperCase()} ${t.symbol} strike ${t.strike} หมดอายุ ${t.expiry} (เหลือ ${daysLeft} วัน)
เข้าที่ $${t.entryPrice.toFixed(2)} ปัจจุบัน $${price.toFixed(2)} (${(pnlPct * 100).toFixed(0)}%)
เหตุผลเข้าเดิม: ${t.thesis}
theta รายวัน: -$${(c?.thetaDay ?? 0).toFixed(0)}
ควรถือต่อหรือตัดออก? พิจารณา: theta bleed, โอกาสกลับตัว, เงินทุนติดค้าง`,
              },
            ],
            0.2
          ).catch(() => "");
          const m = aiText.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const ai = JSON.parse(m[0]) as { action: string; reason: string };
              if (ai.action === "close") {
                const pnl = (price - t.entryPrice) * t.qty * 100;
                t.status = "closed";
                t.exitPrice = price;
                t.exitDate = today;
                t.exitReason = `AI ตัดออก (${Math.round(pnlPct * 100)}%)`;
                t.exitNote = ai.reason;
                t.pnlUsd = pnl;
                t.pnlPct = pnlPct * 100;
                actions.push(`🤖 AI ตัด ${t.symbol}: ${ai.reason}`);
              } else {
                t.checks.push({ date: today, optPrice: price, note: `AI: ถือต่อ — ${ai.reason}` });
              }
            } catch {}
          }
        } else {
          t.checks.push({ date: today, optPrice: price, note: `ราคา $${price.toFixed(2)} (${(pnlPct * 100).toFixed(0)}%)` });
        }
      }
      // จำกัด checks ยาวสุด 30 รายการ
      t.checks = t.checks.slice(-30);
    } catch {
      // ไม้นี้ยิง chain ไม่ได้วันนี้ — ข้าม
    }
  }

  // ===== 4) เปิดไม้ใหม่ =====
  const openCount = trades.filter((t) => t.status === "open").length;
  let opened = 0;
  if (openCount < MAX_OPEN) {
    const picks = await getPicks().catch(() => ({ picks: [] as { ticker: string; score: number; tag: string; reason: string }[] }));
    const candidates = picks.picks
      .filter((p) => !p.ticker.includes(".") && p.score >= 55)
      .slice(0, 5);
    for (const p of candidates) {
      if (trades.filter((t) => t.status === "open").length >= MAX_OPEN) break;
      if (trades.some((t) => t.status === "open" && t.symbol === p.ticker)) continue; // ไม่ซ้ำหุ้น

      try {
        const res = await fetch(`http://localhost:3000/api/options/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: p.ticker }),
        }).catch(() => null);
        if (!res || !res.ok) continue;
        const play = (await res.json()) as {
          play: string; optionType: string; strike: number; expiry: string;
          entryEst: number; confidence: number; reasons: string[]; delta: number;
          atmIv: number | null; jevVerdict?: string;
        };
        if (play.play === "no_play" || play.confidence < OPEN_CONFIDENCE) continue;

        const t: PaperTrade = {
          id: "OPT" + Date.now().toString(36) + Math.random().toString(36).slice(0, 3),
          symbol: p.ticker,
          type: play.optionType === "put" ? "put" : "call",
          strike: play.strike,
          expiry: play.expiry,
          qty: 1,
          entryPrice: play.entryEst,
          entryDate: today,
          entryIv: play.atmIv ?? 0,
          status: "open",
          thesis: play.reasons.join(" · "),
          reasons: play.reasons,
          checks: [],
          jevVerdict: play.jevVerdict,
        };
        trades = [t, ...trades].slice(0, 100);
        opened++;
        actions.push(`🆕 เปิด ${t.type.toUpperCase()} ${p.ticker} ${t.strike} @ $${t.entryPrice.toFixed(2)} (confidence ${play.confidence}%)`);
      } catch {}
    }
  }

  await kvSet(KEY, trades);

  return NextResponse.json({
    ok: true,
    open: trades.filter((t) => t.status === "open").length,
    closed: trades.filter((t) => t.status === "closed").length,
    opened,
    actions: actions.slice(0, 10),
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const passed = auth === `Bearer ${secret}` || (secret && url.searchParams.get("secret") === secret);
  if (secret && !passed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  return GET(req);
}
