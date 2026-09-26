// ===== AI Chat แบบ Grounded — "Truth Packet" ข้อมูลจริงเข้าก่อน LLM เดาไม่ได้ =====
// Intent routing + packet assembly ทั้งหมดอยู่ที่ src/lib/chatIntents.ts (12 intent)
import { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { assembleGrounding, type ChatHolding } from "@/lib/chatIntents";
import { chatStream, hasAI, SYSTEM_ANALYST, friendlyAIError } from "@/lib/ai";
import { kvGet, kvSet } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// กติกาโหมด "รอบด้าน": คำถามทั่วไป/ศัพท์/แนวคิด/การใช้เว็บตอบได้จากความรู้ AI
// แต่ตัวเลข/ราคา/คะแนน/มุมมองหุ้น ต้องมาจาก [ข้อมูลจริง ...] เท่านั้น — ไม่มี = บอกตรงๆ ห้ามเดา
const CHAT_RULES = `

คุณกำลังเป็น "ผู้ช่วยแชท" ของ StockLens พูดคุยแบบสั้นกระชับเหมือนคนเก่งตอบแชท (ไม่ต้องครบทุกหัวข้อเหมือนรายงาน ยกเว้นผู้ใช้ขอละเอียด)
กติกาสำคัญ:
1. ถ้ามี [ข้อมูลจริง ...] แนบมา ให้อ้างตัวเลขจากนั้นเป็นหลัก — ห้ามเดาเลขหุ้น/ราคา/คะแนนที่ไม่มีให้เด็ดขาด
2. คำถามทั่วไปที่ไม่ต้องใช้ข้อมูลสด (คำศัพท์การลงทุน แนวคิด วิธีอ่านงบ กูรูเป็นใคร วิธีใช้เว็บ) ตอบจากความรู้ของคุณได้ตามปกติ
3. ถ้าถามเรื่องที่ควรมีข้อมูลสดแต่ไม่มี packet แนบมา (เช่น ราคาหุ้นตอนนี้ ที่คุณหา ticker ไม่เจอ) — บอกตรงๆ ว่าไม่มีข้อมูลตอนนี้ + ชี้หน้าที่เกี่ยวข้อง (/stock/ชื่อหุ้น, /screener, /radar)
4. เทียบหลายหุ้น: ใช้ตาราง markdown ได้ (คอลัมน์สั้นๆ 2-4 คอลัมน์) — นี่คือข้อยกเว้นเดียวของกติกา "ห้ามตาราง" ในบทวิเคราะห์ยาว
5. ถามว่าควรซื้อไหม/ควรขายไหม → ชี้ว่าอะไรหนุน อะไรกดดัน จากข้อมูล + เตือนความเสี่ยง ไม่ตัดสินใจแทน (ห้ามใช้คำ "ควรซื้อ/ควรขาย")
6. รู้จักบริบทผู้ใช้: ถ้ามี [พอร์ตผู้ใช้ ...] หรือ [Watchlist ผู้ใช้ ...] ให้ตอบโดยอิงของที่เขาถือจริง`;

// POST /api/chat { messages, portfolio?, watchlist? } → stream คำตอบภาษาไทย
export async function POST(req: NextRequest) {
  // 🔒 AI = สิทธิ์สมาชิก Starter ขึ้นไป (free ใช้ไม่ได้) — Pro ได้ "โหมดเจาะลึก" ตอบยาว+จำบริบทมากกว่า
  const guard = requireMember(req);
  if (!guard.ok) return Response.json({ error: "🔒 การใช้ AI เป็นสิทธิ์สมาชิก Starter ขึ้นไป — เข้าสู่ระบบด้วยรหัสสมาชิกที่หน้า /login" }, { status: 401 });
  const isPro = guard.tier === "pro";

  const body = (await req.json().catch(() => ({}))) as {
    messages?: ChatMsg[];
    portfolio?: ChatHolding[];
    watchlist?: string[];
  };
  if (!body.messages?.length) return new Response("missing messages", { status: 400 });

  // จำกล่องล่าสุด: Pro 24 ข้อความ / Starter 16 (ตัดข้อความยาวเกิน 1,500 อักษรประหยัด context)
  const history = body.messages.slice(-(isPro ? 24 : 16)).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  const { packet, demoReply, tickers, intents } = await assembleGrounding(lastUser, body.portfolio, body.watchlist);
  const enc = new TextEncoder();

  if (!hasAI()) {
    const text =
      demoReply ||
      "สอบถามได้เลยครับ เช่น:\n- **NVDA ตอนนี้เป็นยังไง** หรือพิมพ์ **ปตท.** ก็ได้ (รู้จักชื่อบริษัทไทย)\n- **วิเคราะห์พอร์ตฉันหน่อย** (อ่านพอร์ตจริงจากหน้า /portfolio)\n- **บัฟเฟต์ถืออะไรอยู่** (13F สด) · **หุ้นซิ่งวันนี้มีไหม** · **NVDA backtest ย้อนหลังได้ไหม**\n- **ฝนตกหนักที่แอฟริกา กระทบหุ้นอะไร** (เหตุการณ์ → ห่วงโซ่)\n\n_โหมดตัวอย่าง (ยังไม่มี AI key) — ตอบจากข้อมูลจริงที่คำนวณได้เท่านั้น_";
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of text.match(/[\s\S]{1,16}/g) ?? []) {
          controller.enqueue(enc.encode(chunk));
          await new Promise((r) => setTimeout(r, 10));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo", "X-Intents": intents.join(",") } });
  }

  const sys = SYSTEM_ANALYST + CHAT_RULES;
  const aiMessages = [
    { role: "system" as const, content: sys },
    ...(packet ? [{ role: "system" as const, content: `ข้อมูลจริงประกอบคำตอบ (อ้างตัวเลขในนี้ตรงๆ ห้ามคำนวณยอดรวม/สัดส่วน/เปอร์เซ็นต์เพิ่มเอง):\n${packet}` }] : []),
    ...history,
  ];

  try {
    // ===== Cache คำตอบ 10 นาที: คำถามสาธารณะ (หุ้น/ตลาด/กูรู/ศัพท์) ที่คนถามซ้ำกันเยอะ =====
    // เว้น intent ส่วนตัว (portfolio/watchlist — ผูกข้อมูลรายบุคคล แคชไม่ได้)
    const personal = intents.some((x) => x === "portfolio" || x === "watchlist");
    const cacheKey = !personal
      ? `aic:${isPro ? "p" : "s"}:${intents.slice().sort().join(",")}:${tickers.join(",")}:${Buffer.from(lastUser.trim().toLowerCase()).toString("base64url").slice(0, 60)}`
      : null;
    if (cacheKey) {
      const hit = await kvGet<string>(cacheKey);
      if (hit) {
        return new Response(hit, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "live", "X-Cache": "hit", "X-Intents": intents.join(","), "X-Tickers": tickers.join(",") } });
      }
    }
    const stream = await chatStream(aiMessages, 0.5, isPro ? 3500 : 2048);
    if (!cacheKey) {
      return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "live", "X-Intents": intents.join(","), "X-Tickers": tickers.join(",") } });
    }
    // ส่งต่อ stream ให้ผู้ใช้ทันที แล้วเก็บสำเนาแบบสงบๆ ลง cache (tee = แยกสายอ่าน 2 ทาง)
    const [toUser, toCache] = stream.tee();
    (async () => {
      try {
        const text = await new Response(toCache).text();
        if (text.length > 40 && !text.startsWith("⚠️")) await kvSet(cacheKey!, text, 600);
      } catch {}
    })();
    return new Response(toUser, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "live", "X-Cache": "miss", "X-Intents": intents.join(","), "X-Tickers": tickers.join(",") } });
  } catch (e) {
    const msg = `⚠️ ${friendlyAIError(e)} — แสดงข้อมูลจริงแทน\n\n` + (demoReply || "ลองใหม่อีกครั้งครับ");
    return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-AI-Mode": "demo" } });
  }
}
