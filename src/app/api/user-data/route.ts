// ===== ข้อมูลผู้ใช้ซิงก์ข้ามเครื่อง (สมาชิก) — watchlist/แจ้งเตือน/หุ้นโปรด/Radar/ตะกร้าเทียบ =====
// pattern เดียวกับ /api/portfolio: Upstash Redis ถ้ามี / no-op ถ้าไม่มี (local ยังใช้ได้เสมอ)
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE } from "@/lib/auth";
import { kvGet, kvSet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";

const KEYS = ["watchlist", "alerts", "favorites", "radars", "basket"] as const;
type Key = (typeof KEYS)[number];

const LIMITS: Record<Key, number> = { watchlist: 60, alerts: 40, favorites: 60, radars: 20, basket: 4 };

function memberOf(req: NextRequest) {
  return verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
}

/** ทำความสะอาดตามชนิดของ key — กันยัดของแปลกๆ เข้า Redis */
function sanitize(key: Key, value: unknown): unknown | null {
  if (!Array.isArray(value)) return null;
  if (key === "alerts") {
    return value
      .filter((a) => !!a && typeof a === "object")
      .map((a) => ({
        id: String((a as { id?: string }).id ?? "").slice(0, 20),
        ticker: String((a as { ticker?: string }).ticker ?? "").toUpperCase().slice(0, 12),
        direction: (a as { direction?: string }).direction === "below" ? "below" : "above",
        target: Number((a as { target?: number }).target),
        createdAt: Number((a as { createdAt?: number }).createdAt) || Date.now(),
      }))
      .filter((a) => /^[A-Z0-9.\-]+$/.test(a.ticker) && isFinite(a.target) && a.target > 0)
      .slice(0, LIMITS[key]);
  }
  if (key === "radars") {
    // Radar ของ screener: เก็บโครงรูปแบบอิสระ จำกัดขนาดชื่อฟิลด์
    return value.filter((r) => !!r && typeof r === "object").slice(0, LIMITS[key]);
  }
  // string[] (watchlist/favorites/basket)
  return value
    .map((x) => String(x ?? "").toUpperCase().trim().slice(0, 12))
    .filter((x) => /^[A-Z0-9.\-]+$/.test(x))
    .slice(0, LIMITS[key]);
}

// GET — ดึงทุก key ของสมาชิกคนนี้
export async function GET(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ persisted: false, data: {} });
  const data: Record<string, unknown> = {};
  for (const k of KEYS) data[k] = (await kvGet(`ud:${m.id}:${k}`)) ?? [];
  return NextResponse.json({ persisted: true, data });
}

// PUT { key, value } — เซฟ key เดียว (client debounce แล้วส่ง)
export async function PUT(req: NextRequest) {
  const m = memberOf(req);
  if (!m) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDB()) return NextResponse.json({ ok: false, persisted: false });
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
  if (!key || !KEYS.includes(key as Key)) return NextResponse.json({ error: "key ไม่ถูกต้อง" }, { status: 400 });
  const clean = sanitize(key as Key, value);
  if (clean === null) return NextResponse.json({ error: "รูปแบบไม่ถูกต้อง" }, { status: 400 });
  const ok = await kvSet(`ud:${m.id}:${key}`, clean);
  return NextResponse.json({ ok, persisted: ok });
}
