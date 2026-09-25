import { NextRequest, NextResponse } from "next/server";
import { adminCode, daysLeft, readMembers } from "@/lib/admin";
import { getQuotes, getUsdThb } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

// 📲 LINE ส่วนตัว VIP — จุดขายของ Pro: ข้อความเด้งหาสมาชิกโดยตรง (ไม่ใช่ broadcast ก้อนเดียว)
// mode=flash  → multicast ข้อความ Flash หาสมาชิก Pro ที่กรอก lineUserId ทุกคนที่ยังไม่หมดอายุ
// mode=digest → push รายคน: สรุปราคาวอตช์ลิสต์ของ "เขา" + ธงเตือนหุ้นที่ขยับแรง ≥2%
// เอา lineUserId ได้จาก: LINE Official Account Manager → แชท → คลิกผู้ใช้ → คัดลอก User ID (U...)

async function lineApi(endpoint: string, token: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.line.me/v2/bot/message/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `LINE ${res.status}: ${t.slice(0, 160)}` };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน .env.local — ดูวิธีใน README (หัวข้อ LINE)" },
      { status: 400 }
    );
  }

  const { mode, message, _testTo } = (await req.json().catch(() => ({}))) as { mode?: string; message?: string; _testTo?: string };
  const members = (await readMembers()).filter((m) => daysLeft(m.paidUntil) >= 0);

  if (mode === "flash") {
    const text = (message || "").trim();
    if (!text) return NextResponse.json({ error: "ต้องมีข้อความ Flash" }, { status: 400 });
    // โหมดทดสอบ: ส่งหาตัวเองคนเดียว ไม่ยิงหาสมาชิกทั้งกลุ่ม
    if (_testTo) {
      if (!_testTo.startsWith("U")) return NextResponse.json({ error: "LINE User ID ต้องขึ้นต้นด้วย U" }, { status: 400 });
      const r = await lineApi("push", token, { to: _testTo, messages: [{ type: "text", text: `⚡ StockLens (ทดสอบ)\n\n${text.slice(0, 3500)}` }] });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      return NextResponse.json({ ok: true, sent: 1, mode: "test" });
    }
    const targets = members.filter((m) => m.tier === "pro" && m.lineUserId);
    if (targets.length === 0) {
      return NextResponse.json({ error: "ยังไม่มีสมาชิก Pro ที่กรอก LINE User ID — เพิ่มได้ในตารางสมาชิกด้านล่าง" }, { status: 400 });
    }
    const r = await lineApi("multicast", token, {
      to: targets.map((m) => m.lineUserId),
      messages: [{ type: "text", text: `⚡ StockLens Flash (Pro)\n\n${text.slice(0, 3500)}\n\n— บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน` }],
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, sent: targets.length, mode: "flash" });
  }

  if (mode === "digest") {
    const targets = members.filter((m) => m.lineUserId && m.watch && m.watch.length > 0);
    if (targets.length === 0) {
      return NextResponse.json({ error: "ยังไม่มีสมาชิกที่กรอก LINE User ID + รายชื่อหุ้นที่ติดตาม — เพิ่มในตารางสมาชิก (ช่อง watch)" }, { status: 400 });
    }
    // รวมทุก ticker ทุกคน → ดึง quote ครั้งเดียว
    const allTickers = [...new Set(targets.flatMap((m) => m.watch!))];
    const [quotes, usdThb] = await Promise.all([getQuotes(allTickers), getUsdThb().catch(() => 0)]);
    let sent = 0;
    const errors: string[] = [];
    for (const m of targets) {
      const lines: string[] = [`📲 วอตช์ลิสต์ของคุณ — ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`, ""];
      let flags = 0;
      for (const t of m.watch!) {
        const q = quotes[t];
        if (!q || !isFinite(q.price)) continue;
        const up = q.changePct >= 0;
        lines.push(`${up ? "🟢" : "🔴"} ${q.symbol} ${q.price.toFixed(2)} ${q.currency} (${up ? "+" : ""}${q.changePct.toFixed(2)}%)`);
        if (Math.abs(q.changePct) >= 2) flags++;
        if (q.currency === "USD" && usdThb > 0) lines.push(`   ≈ ${(q.price * usdThb).toFixed(0)}฿ · ซื้อได้ใน Dime`);
      }
      if (flags > 0) lines.push("", `🚨 มี ${flags} ตัวขยับแรงวันนี้ (≥2%) — เข้าไปดูห่วงโซ่เหตุการณ์ได้ที่ StockLens`);
      lines.push("", "— ข้อมูลหน่วง ~15 นาที · ไม่ใช่คำแนะนำการลงทุน");
      const r = await lineApi("push", token, { to: m.lineUserId, messages: [{ type: "text", text: lines.join("\n").slice(0, 3900) }] });
      if (r.ok) sent++;
      else errors.push(`${m.name}: ${r.error}`);
    }
    return NextResponse.json({ ok: errors.length === 0, sent, total: targets.length, errors: errors.slice(0, 5) });
  }

  return NextResponse.json({ error: "mode ต้องเป็น flash หรือ digest" }, { status: 400 });
}
