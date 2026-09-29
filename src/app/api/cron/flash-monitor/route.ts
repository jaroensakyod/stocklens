// ===== Flash Monitor อัตโนมัติ — สแกนข่าว→จับคู่ธีม→Jev ให้คะแนน→LINE หาแอดมิน =====
// ระบบนี้ "แจ้งเตือนแอดมิน" ว่ามีเหตุการณ์ที่ควรพิจารณาออก Flash Report — ไม่ได้ส่งหาสมาชิกโดยตรง
// ตั้งเวลา: cron-job.org ยิงทุก 30 นาที (GET ?secret=CRON_SECRET)
// ต้องมี env: LINE_CHANNEL_ACCESS_TOKEN + CRON_SECRET + UPSTASH_REDIS (dedupe)
import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/yahoo";
import { THEMES, getNode } from "@/lib/radar";
import { scoreNewsMany, type NewsScore } from "@/lib/typesafe";
import { readMembers } from "@/lib/admin";
import { kvGet, kvSet, hasDB } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMPACT_THRESHOLD = 1.5; // Jev impact ≥ 1.5 = catalyst-level event
const QUIET_MS = 2 * 3600_000; // dedupe: ไม่แจ้งซ้ำภายใน 2 ชม.
const LINE_ADMIN_KEY = "flashmonitor:last-admin-alert";

// จับคู่ข่าว→ธีม (reuse จาก flash-scan)
function matchHeadline(text: string): { themes: string[]; nodes: string[] } {
  const lower = " " + text.toLowerCase() + " ";
  const themesHit: string[] = [];
  const nodeIds = new Set<string>();
  for (const t of THEMES) {
    let hits = 0;
    for (const k of t.keys) if (lower.includes(k.toLowerCase())) hits += 1;
    for (const id of t.impactIds) {
      const node = getNode(id);
      if (!node) continue;
      const names = [node.name];
      for (const alias of node.name.split("/")) names.push(alias.trim());
      if (names.some((n) => n.length >= 3 && lower.includes(n.toLowerCase()))) hits += 1.5;
    }
    if (hits >= 1) {
      themesHit.push(t.emoji + " " + t.name);
      for (const id of t.impactIds) nodeIds.add(id);
    }
  }
  return { themes: themesHit, nodes: [...nodeIds] };
}

async function linePush(token: string, to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function run(): Promise<NextResponse> {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!lineToken) {
    return NextResponse.json({ ok: true, skipped: "ยังไม่ตั้ง LINE_CHANNEL_ACCESS_TOKEN — Flash Monitor ปิดอยู่" });
  }

  // Dedupe: เช็คว่าเพิ่งแจ้งไปเมื่อไหร่
  if (hasDB()) {
    const last = await kvGet<number>(LINE_ADMIN_KEY);
    if (last && Date.now() - last < QUIET_MS) {
      const minsLeft = Math.ceil((QUIET_MS - (Date.now() - last)) / 60_000);
      return NextResponse.json({ ok: true, skipped: `เพิ่งแจ้งไปแล้ว — เงียบอีก ${minsLeft} นาที` });
    }
  }

  // 1) สแกนข่าว (หลายหมวด + ภาษาไทย)
  const queries = ["stock market", "oil price", "gold", "federal reserve interest rate", "war", "tariff", "หุ้น", "เศรษฐกิจ"];
  const seen = new Set<string>();
  const candidates: { title: string; publisher: string; themes: string[]; nodes: string[] }[] = [];

  await Promise.all(
    queries.map(async (q) => {
      try {
        const news = await getNews(q, 8);
        for (const n of news) {
          const key = n.title.slice(0, 55);
          if (seen.has(key)) continue;
          seen.add(key);
          const match = matchHeadline(n.title);
          if (match.themes.length > 0) {
            candidates.push({ title: n.title, publisher: n.publisher ?? q, themes: match.themes, nodes: match.nodes });
          }
        }
      } catch {}
    })
  );

  if (!candidates.length) {
    return NextResponse.json({ ok: true, matched: 0, message: "ไม่มีข่าวที่จับคู่ธีมได้ในรอบนี้" });
  }

  // 2) Jev ให้คะแนน impact (เฉพาะที่จับคู่ธีมได้ — ประหยัด)
  let scores = new Map<string, NewsScore>();
  try {
    scores = await scoreNewsMany(candidates.map((c) => c.title));
  } catch {}

  // 3) กรองเฉพาะข่าว impact ≥ threshold + substantive + ไม่ใช่ข่าวปั่น
  const alerts = candidates
    .map((c) => ({ ...c, score: scores.get(c.title) ?? null }))
    .filter((c) => {
      if (!c.score) return false;
      return c.score.impact >= IMPACT_THRESHOLD && c.score.substantive !== false && !c.score.suspicious;
    })
    .sort((a, b) => (b.score?.impact ?? 0) - (a.score?.impact ?? 0));

  if (!alerts.length) {
    return NextResponse.json({ ok: true, matched: candidates.length, alerted: 0, message: `จับคู่ธีมได้ ${candidates.length} ชิ้น แต่ไม่มีชิ้นไหนถึงเกณฑ์ Flash (impact ≥ ${IMPACT_THRESHOLD})` });
  }

  // 4) ส่ง LINE หาแอดมิน (หา lineUserId จาก members ที่เป็น isAdmin หรือแอดมินคนแรก)
  const members = await readMembers();
  const admin = members.find((m) => m.isAdmin) ?? members.find((m) => m.tier === "pro" && m.lineUserId);
  if (!admin?.lineUserId) {
    return NextResponse.json({ ok: true, matched: candidates.length, alerted: 0, error: "ไม่พบ lineUserId ของแอดมิน — เพิ่มใน /admin ก่อน" });
  }

  const top = alerts.slice(0, 3);
  const msg = [
    `⚡ Flash Monitor — พบเหตุการณ์ที่ควรพิจารณาออก Flash Report`,
    ``,
    ...top.flatMap((a, i) => [
      `${i + 1}. ${a.title.slice(0, 80)}`,
      `   ธีม: ${a.themes.slice(0, 2).join(", ")}`,
      `   Impact: ${(a.score?.impact ?? 0).toFixed(1)}/2 · ${a.score?.sentiment === "bullish" ? "🟢 บวก" : a.score?.sentiment === "bearish" ? "🔴 ลบ" : "⚪ กลาง"}`,
    ]),
    ``,
    `→ เข้า /admin → กด📡 Flash Monitor → ออกรายงานส่งกลุ่ม Pro`,
  ].join("\n");

  const sent = await linePush(lineToken, admin.lineUserId, msg.slice(0, 1800));

  // Dedupe
  if (hasDB()) await kvSet(LINE_ADMIN_KEY, Date.now());

  return NextResponse.json({
    ok: sent,
    matched: candidates.length,
    alerted: top.length,
    titles: top.map((a) => a.title.slice(0, 60)),
    lineSent: sent,
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
