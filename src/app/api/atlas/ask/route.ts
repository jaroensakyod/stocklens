import { NextRequest, NextResponse } from "next/server";
import atlasData from "@/data/atlas.json";
import { jevAsk } from "@/lib/typesafe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AtlasNode { id: string; type: string; era: string; year: number; date: string; emoji: string; title: string; summary: string; body: string[] }
const ATLAS = atlasData as unknown as { nodes: AtlasNode[] };

// POST /api/atlas/ask { q } — พิมพ์เหตุการณ์/คำถาม → Jev ชี้การ์ดบนกระดานที่เกี่ยวข้องสุด 3 ใบ
export async function POST(req: NextRequest) {
  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  if (!q || q.trim().length < 3) return NextResponse.json({ error: "พิมพ์อย่างน้อย 3 ตัวอักษร" }, { status: 400 });

  // 1) keyword prefilter: ไทยไม่มีช่องว่าง → ใช้ n-gram (3-8 ตัวอักษร) + คำอังกฤษ ให้คะแนนการ์ด จำกัดให้ Jev เลือกจาก ~12 ใบ
  const qRaw = q.toLowerCase();
  const tokens: string[] = qRaw.split(/[\s,./()]+/).filter((t) => t.length > 1);
  const ngrams: string[] = [];
  for (const w of qRaw.split(/[\s,./()]+/)) {
    for (let len = 3; len <= Math.min(8, w.length); len++) for (let i = 0; i + len <= w.length; i++) ngrams.push(w.slice(i, i + len));
  }
  const KEY2ID = {
    "อิหร่าน": "mideast", "ฮอร์มุซ": "taiwan", "น้ำมัน": "oil73", "ทอง": "goldstd", "ทองคำ": "goldrush22",
    "สงคราม": "ww2", "ดอลลาร์": "nixonshock", "ดอกเบี้ย": "volcker", "จีน": "china", "รัสเซีย": "ukraine",
    "เงินเฟ้อ": "inflation2022", "พันธบัตร": "debtclock", "ai": "ai4ir", "reset": "greatreset", "รีเซ็ต": "greatreset",
    "หุ้นไทย": "zombieset", "set": "zombieset", "กลาโหม": "anduril", "ฟอง": "aibubble", "ยูเครน": "ukraine",
  };
  for (const [k, id] of Object.entries(KEY2ID)) if (qRaw.includes(k)) tokens.push(id);
  const scored = ATLAS.nodes.map((n) => {
    const hay = (n.title + " " + n.summary + " " + n.body.join(" ")).toLowerCase();
    let s = 0;
    for (const t of tokens) {
      if (n.title.toLowerCase().includes(t)) s += 8;
      if (hay.includes(t)) s += 2;
    }
    for (const g of ngrams) if (hay.includes(g)) s += 1; // n-gram ไทยให้แต้มบางเบากว่า
    return { n, s };
  }).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 12);

  if (!scored.length) return NextResponse.json({ cards: [], note: "ไม่พบการ์ดที่คำค้นตรง — ลองคำอื่น เช่น ทอง, สงคราม, ดอกเบี้ย, จีน, reset, AI" });

  // 2) Jev เลือกการ์ดที่เกี่ยวข้องสุด (choice ให้ probability ทุกใบ)
  const cands = scored.slice(0, 10);
  const a = await jevAsk(
    `คำถาม/เหตุการณ์จากผู้ใช้: "${q}" — การ์ดบนกระดานประวัติศาสตร์ (Atlas):\n${cands.map(x => `${x.n.id}: ${x.n.title} — ${x.n.summary.slice(0, 110)}`).join("\n")}`,
    {
      best: { type: "choice", instructions: "Which card is MOST relevant to answering the user's question?", criteria: Object.fromEntries(cands.map(x => [x.n.id, x.n.title.slice(0, 40)])) },
      relevance: { type: "score", instructions: "Overall: does the board contain a genuinely relevant answer to the question?", criteria: ["ไม่เกี่ยวเลย", "เกี่ยวทางอ้อม", "เกี่ยวพอสมควร", "ตรงประเด็นมาก"] },
    }
  );
  const probs = ((a?.best as { probabilities?: Record<string, number> })?.probabilities) ?? {};
  const ranked = cands
    .map(x => ({ id: x.n.id, title: x.n.title, emoji: x.n.emoji, date: x.n.date, summary: x.n.summary.slice(0, 160), prob: probs[x.n.id] ?? 0, kw: x.s }))
    .sort((p, c) => c.prob - p.prob || c.kw - p.kw)
    .slice(0, 3);

  return NextResponse.json({ cards: ranked, relevance: (a?.relevance as { score?: number })?.score ?? null, note: a ? undefined : "Jev ไม่ตอบ (แสดงผลจากการค้นหาคำสำคัญ)" });
}
