// ===== Daily Brief / Weekly — ประกอบข้อมูลรายงาน + ข้อความพร้อมโพสต์ลง Facebook =====
import { getNews, getQuotes } from "./yahoo";
import { computeThemeHeat } from "./radar";
import { chatOnce, hasAI } from "./ai";
import calendarJson from "@/data/calendar.json";
import trackJson from "@/data/track-record.json";

export async function buildBrief() {
  const indices = ["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK", "^N225"];
  const heat = await computeThemeHeat();
  const news = await getNews("stock market", 6);
  const quotes = await getQuotes(indices);

  const today = new Date().toISOString().slice(0, 10);
  const events = (calendarJson as { events: { date: string; label: string; impact: string; star: number }[] }).events
    .filter((e) => e.date >= today)
    .slice(0, 3);

  const thDate = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // ข้อความพร้อมโพสต์ลงกลุ่ม FB (Starter ย่อ / Pro เต็ม — ต่างกันที่ระดับรายละเอียด)
  const idxLine = indices
    .map((i) => {
      const q = quotes[i];
      if (!q || !isFinite(q.price)) return null;
      const arrow = q.changePct >= 0 ? "🟢" : "🔴";
      const name: Record<string, string> = { "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "DOW", "^VIX": "VIX", "^SET.BK": "SET", "^N225": "NIKKEI" };
      return `${name[i] ?? i} ${q.price.toFixed(0)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%) ${arrow}`;
    })
    .filter(Boolean)
    .join(" | ");

  const topThemes = heat.slice(0, 3);
  const themeLine = topThemes
    .map((h, i) => `${i + 1}. ${h.theme.emoji} ${h.theme.name} — ความร้อน ${h.heat}/100${h.avgChange > 0.3 ? " (สัญญาณบวกล่าสุด)" : h.avgChange < -0.3 ? " (สัญญาณลบล่าสุด)" : ""}`)
    .join("\n");

  const newsLine = news.slice(0, 4).map((n, i) => `${i + 1}. ${n.title}`).join("\n");

  const fbStarter = `🌅 StockLens Daily Brief — ${thDate}
📊 ตลาดเมื่อวาน
${idxLine}

🔥 Global Radar ธีมที่ร้อนที่สุด
${themeLine}

📰 ข่าวที่ต้องรู้
${newsLine}

👀 วิเคราะห์เต็มที่เว็บ → stocklens
⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`;

  const fbPro = `🌅 StockLens Daily Brief (Pro) — ${thDate}
📊 ตลาดเมื่อวาน
${idxLine}

🔥 Radar วันนี้ — ธีมเด่นและสิ่งที่ต้องจับตา
${themeLine}

📌 ปฏิทินสำคัญ
${events.map((e) => `• ${e.date} — ${e.label} (${e.impact})`).join("\n") || "• ไม่มีเหตุการณ์ใหญ่ในสัปดาห์นี้"}

📰 ข่าวที่ต้องรู้
${newsLine}

🎯 Watchlist เฉพาะกลุ่ม Pro + Flash Alert รอตามเหตุการณ์
⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`;

  // คอมเมนตารี่ AI สั้นๆ ต่อท้าย Brief (ถ้ามี AI key และมียอดเงิน — fail แบบเงียบๆ ได้)
  let aiCommentary = "";
  if (hasAI()) {
    try {
      aiCommentary = await chatOnce(
        [
          { role: "system", content: "คุณเป็นบรรณาธิการ Brief การเงินภาษาไทย เขียนคอมเมนต์ตลาด 2-3 ประโยค กระชับ ใช้ตัวเลขจากข้อมูลจริงที่ให้เท่านั้น โทนสุขุมเป็นกลาง ไม่ใช่คำแนะนำการลงทุน" },
          {
            role: "user",
            content: `ข้อมูลวันนี้:\nดัชนี: ${idxLine}\nธีมร้อนสุด: ${themeLine}\nข่าวเด่น: ${news.slice(0, 3).map((n) => n.title).join(" / ")}\nเขียน "💬 มุมมองวันนี้:" ตามด้วย 2-3 ประโยค`,
          },
        ],
        0.4
      );
    } catch {
      aiCommentary = "";
    }
  }

  return {
    thDate,
    indices: indices.map((i) => quotes[i]).filter((q) => q && isFinite(q.price)),
    themes: topThemes,
    allThemes: heat,
    news,
    events,
    aiCommentary,
    trackOpen: (trackJson as { entries: { status: string }[] }).entries.filter((e) => e.status === "open").length,
    fbStarter: aiCommentary ? fbStarter + "\n\n" + aiCommentary : fbStarter,
    fbPro: aiCommentary ? fbPro + "\n\n" + aiCommentary : fbPro,
  };
}
