// ===== Options Paper Portfolio (AI จำลอง — สาธารณะดูได้ = สร้างความเชื่อใจ) =====
// GET /api/options/paper → พอร์ต + journal + สถิติ
// PUT /api/options/paper { action: "open" | "close", ... } — เปิด/ปิดไม้ (สมาชิก Starter+ ใช้บันทึกไม้ตัวเองได้)
import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, hasDB } from "@/lib/storage";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface PaperTrade {
  id: string;
  symbol: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  qty: number;
  entryPrice: number;   // premium ต่อสัญญา ตอนเข้า
  entryDate: string;
  entryIv: number;
  status: "open" | "closed";
  exitPrice?: number;
  exitDate?: string;
  exitReason?: string;  // "TP ถึงเป้า +85%" / "SL ตัดขาดทุน -42%" / "หมดอายุ ITM" / "AI ประเมินถือไม่คุ้ม"
  exitNote?: string;    // AI เขียนอธิบายเพิ่ม
  pnlUsd?: number;
  pnlPct?: number;
  thesis: string;       // เหตุผลเข้า (จาก analyze)
  reasons: string[];
  checks: { date: string; optPrice: number; note: string }[];
  jevVerdict?: string;
}

interface PaperSummary {
  initialCapital: number;
  realizedPnl: number;
  openCount: number;
  closedCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  totalPremiumSpent: number;
  lossReasons: Record<string, number>; // ขาดทุนเพราะอะไรบ่อยสุด
}

const KEY = "optpaper:ai";
const INITIAL_CAPITAL = 10_000;

// GET — พอร์ต + journal + สถิติ (สาธารณะ)
export async function GET() {
  if (!hasDB()) {
    return NextResponse.json({
      trades: [], summary: null, hint: "Paper portfolio ใช้ได้หลังต่อ Redis (ดู SETUP-EXTERNALS.md) — ขณะนี้ยังไม่มีข้อมูลจำลอง",
    });
  }
  const trades = (await kvGet<PaperTrade[]>(KEY)) ?? [];
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const wins = closed.filter((t) => (t.pnlUsd ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnlUsd ?? 0) <= 0);

  const lossReasons: Record<string, number> = {};
  for (const l of losses) {
    const cat = l.exitReason?.includes("SL") ? "ทิศผิด (SL)" :
      l.exitReason?.includes("หมดอายุ") ? "หมดอายุ (theta/time)" :
      l.exitReason?.includes("AI") ? "AI ตัดออกก่อน" : "อื่นๆ";
    lossReasons[cat] = (lossReasons[cat] ?? 0) + 1;
  }

  const summary: PaperSummary = {
    initialCapital: INITIAL_CAPITAL,
    realizedPnl: closed.reduce((a, t) => a + (t.pnlUsd ?? 0), 0),
    openCount: open.length,
    closedCount: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : null,
    avgWin: wins.length ? wins.reduce((a, t) => a + (t.pnlUsd ?? 0), 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((a, t) => a + (t.pnlUsd ?? 0), 0) / losses.length : null,
    totalPremiumSpent: trades.reduce((a, t) => a + t.entryPrice * t.qty * 100, 0),
    lossReasons,
  };

  return NextResponse.json({ trades, summary });
}

// PUT — สมาชิกเพิ่มไม้ตัวเองเข้า paper (หรือปิด)
export async function PUT(req: NextRequest) {
  const m = requireMember(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ error: "ยังไม่ได้ต่อ Redis" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "open" | "close";
    symbol?: string; type?: string; strike?: number; expiry?: string;
    qty?: number; entryPrice?: number; thesis?: string; reasons?: string[];
    tradeId?: string; exitPrice?: number; exitReason?: string;
  };

  const trades = (await kvGet<PaperTrade[]>(KEY)) ?? [];

  if (body.action === "open") {
    const t: PaperTrade = {
      id: "OPT" + Date.now().toString(36),
      symbol: (body.symbol ?? "").toUpperCase(),
      type: body.type === "put" ? "put" : "call",
      strike: Number(body.strike) || 0,
      expiry: body.expiry ?? "",
      qty: Math.max(1, Number(body.qty) || 1),
      entryPrice: Number(body.entryPrice) || 0,
      entryDate: new Date().toISOString().slice(0, 10),
      entryIv: 0,
      status: "open",
      thesis: body.thesis ?? "",
      reasons: body.reasons ?? [],
      checks: [],
    };
    if (!t.symbol || !t.strike || !t.expiry || t.entryPrice <= 0) {
      return NextResponse.json({ error: "กรอก symbol, strike, expiry, entryPrice ให้ครบ" }, { status: 400 });
    }
    await kvSet(KEY, [t, ...trades].slice(0, 100));
    return NextResponse.json({ ok: true, trade: t });
  }

  if (body.action === "close" && body.tradeId) {
    const t = trades.find((x) => x.id === body.tradeId);
    if (!t) return NextResponse.json({ error: "ไม่พบไม้" }, { status: 404 });
    const exitPrice = Number(body.exitPrice) || 0;
    t.status = "closed";
    t.exitPrice = exitPrice;
    t.exitDate = new Date().toISOString().slice(0, 10);
    t.exitReason = body.exitReason ?? "ปิดเอง";
    t.pnlUsd = (exitPrice - t.entryPrice) * t.qty * 100;
    t.pnlPct = ((exitPrice - t.entryPrice) / t.entryPrice) * 100;
    await kvSet(KEY, trades.map((x) => (x.id === t.id ? t : x)));
    return NextResponse.json({ ok: true, trade: t });
  }

  return NextResponse.json({ error: "action ต้องเป็น open หรือ close" }, { status: 400 });
}
