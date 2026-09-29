// ===== Options Paper ของสมาชิก (แยกจาก AI) — สมาชิก Starter+ หัดเล่นเอง =====
// GET  /api/options/my-paper → พอร์ตของฉัน + สรุป P&L
// POST /api/options/my-paper { action: "open"|"close"|"copy_ai", ... } → เปิด/ปิด/คัดลอกไม้ AI
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

export interface MyPaperTrade {
  id: string;
  symbol: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  qty: number;
  entryPrice: number;
  entryDate: string;
  status: "open" | "closed";
  exitPrice?: number;
  exitDate?: string;
  exitReason?: string;
  pnlUsd?: number;
  pnlPct?: number;
  thesis: string;
  reasons: string[];
  copiedFromAi?: boolean;
}

interface MySummary {
  totalTrades: number;
  openCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  realizedPnl: number;
  totalPremiumSpent: number;
}

const memberOf = (req: NextRequest) => verifyToken(req.cookies.get(AUTH_COOKIE)?.value);

// GET — พอร์ตของฉัน
export async function GET(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ trades: [], summary: null, hint: "ต้องต่อ Redis ก่อน" });

  const key = `optpaper:${m.id}`;
  const trades = (await kvGet<MyPaperTrade[]>(key)) ?? [];
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const wins = closed.filter((t) => (t.pnlUsd ?? 0) > 0);

  const summary: MySummary = {
    totalTrades: trades.length,
    openCount: open.length,
    wins: wins.length,
    losses: closed.length - wins.length,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : null,
    realizedPnl: closed.reduce((a, t) => a + (t.pnlUsd ?? 0), 0),
    totalPremiumSpent: trades.reduce((a, t) => a + t.entryPrice * t.qty * 100, 0),
  };

  return NextResponse.json({ trades, summary });
}

// POST — เปิด/ปิด/คัดลอกไม้ AI
export async function POST(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ error: "ยังไม่ต่อ Redis" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "open" | "close" | "copy_ai";
    symbol?: string; type?: string; strike?: number; expiry?: string;
    qty?: number; entryPrice?: number; thesis?: string; reasons?: string[];
    tradeId?: string; exitPrice?: number; exitReason?: string;
    aiTradeId?: string;
  };

  const key = `optpaper:${m.id}`;
  const trades = (await kvGet<MyPaperTrade[]>(key)) ?? [];

  // ===== คัดลอกไม้ AI =====
  if (body.action === "copy_ai" && body.aiTradeId) {
    const aiTrades = (await kvGet<{ id: string; symbol: string; type: "call" | "put"; strike: number; expiry: string; entryPrice: number; thesis: string; reasons: string[]; status: string }[]>("optpaper:ai")) ?? [];
    const ai = aiTrades.find((t) => t.id === body.aiTradeId && t.status === "open");
    if (!ai) return NextResponse.json({ error: "ไม่พบไม้ AI นี้ หรือปิดไปแล้ว" }, { status: 404 });
    // กันซ้ำ: ถ้ามีไม้ symbol+strike+expiry เดียวกันอยู่แล้ว
    if (trades.some((t) => t.status === "open" && t.symbol === ai.symbol && t.strike === ai.strike && t.expiry === ai.expiry)) {
      return NextResponse.json({ error: "คุณมีไม้นี้อยู่แล้ว" }, { status: 400 });
    }
    const t: MyPaperTrade = {
      id: "MY" + Date.now().toString(36),
      symbol: ai.symbol,
      type: ai.type,
      strike: ai.strike,
      expiry: ai.expiry,
      qty: 1,
      entryPrice: ai.entryPrice,
      entryDate: new Date().toISOString().slice(0, 10),
      status: "open",
      thesis: `[คัดลอกจาก AI] ${ai.thesis}`,
      reasons: ai.reasons,
      copiedFromAi: true,
    };
    await kvSet(key, [t, ...trades].slice(0, 50));
    return NextResponse.json({ ok: true, trade: t });
  }

  // ===== เปิดไม้เอง =====
  if (body.action === "open") {
    const t: MyPaperTrade = {
      id: "MY" + Date.now().toString(36),
      symbol: (body.symbol ?? "").toUpperCase(),
      type: body.type === "put" ? "put" : "call",
      strike: Number(body.strike) || 0,
      expiry: body.expiry ?? "",
      qty: Math.max(1, Number(body.qty) || 1),
      entryPrice: Number(body.entryPrice) || 0,
      entryDate: new Date().toISOString().slice(0, 10),
      status: "open",
      thesis: body.thesis ?? "",
      reasons: body.reasons ?? [],
    };
    if (!t.symbol || !t.strike || !t.expiry || t.entryPrice <= 0) {
      return NextResponse.json({ error: "กรอก symbol, strike, expiry, entryPrice ให้ครบ" }, { status: 400 });
    }
    await kvSet(key, [t, ...trades].slice(0, 50));
    return NextResponse.json({ ok: true, trade: t });
  }

  // ===== ปิดไม้ =====
  if (body.action === "close" && body.tradeId) {
    const t = trades.find((x) => x.id === body.tradeId);
    if (!t) return NextResponse.json({ error: "ไม่พบไม้" }, { status: 404 });
    const exitPrice = Number(body.exitPrice) || 0;
    if (exitPrice <= 0) return NextResponse.json({ error: "กรอกราคาปัจจุบันของ option" }, { status: 400 });
    t.status = "closed";
    t.exitPrice = exitPrice;
    t.exitDate = new Date().toISOString().slice(0, 10);
    t.exitReason = body.exitReason ?? "ปิดเอง";
    t.pnlUsd = (exitPrice - t.entryPrice) * t.qty * 100;
    t.pnlPct = ((exitPrice - t.entryPrice) / t.entryPrice) * 100;
    await kvSet(key, trades.map((x) => (x.id === t.id ? t : x)));
    return NextResponse.json({ ok: true, trade: t });
  }

  return NextResponse.json({ error: "action ต้องเป็น open, close, หรือ copy_ai" }, { status: 400 });
}
