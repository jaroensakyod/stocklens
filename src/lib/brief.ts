// ===== Daily Brief / Weekly — ประกอบข้อมูลรายงาน + โพสต์ลงกลุ่ม Facebook ระดับที่จ่ายเงินได้ =====
// หลักการ: คนจ่าย 129฿ (Starter) ต้องได้มากกว่ากลุ่มฟรีทั่วไปอย่างชัดเจน
//          คนจ่าย 399฿ (Pro) ต้องได้ "ของที่หาที่อื่นไม่ได้": หุ้นซิ่งพร้อมหลักฐาน + สถานการณ์ Bull/Base/Bear + Track Record
// ทุกตัวเลขในโพสต์มาจากข้อมูลจริง (Yahoo/TradingView/งบ filings) — AI ทำหน้าที่บรรณาธิการเท่านั้น
import { getNews, getQuotes, getUsdThb } from "./yahoo";
import { computeThemeHeat } from "./radar";
import { chatOnce, hasAI } from "./ai";
import { getPicks } from "./picks";
import { getSurge } from "./surge";
import { buildAnalysis } from "./analysis";
import type { Quote } from "./types";
import calendarJson from "@/data/calendar.json";
import trackJson from "@/data/track-record.json";

const IDX_NAMES: Record<string, string> = { "^GSPC": "S&P", "^IXIC": "NASDAQ", "^DJI": "DOW", "^VIX": "VIX", "^SET.BK": "SET", "^N225": "NIKKEI" };

export async function buildBrief() {
  const indices = ["^GSPC", "^IXIC", "^DJI", "^VIX", "^SET.BK", "^N225"];
  const commodities = ["CL=F", "GC=F"];

  // ข้อมูลจริงทั้งหมด (แต่ละอันมี cache ของตัวเอง — ไม่ยิงซ้ำ)
  const [heat, news, idxQuotes, cmdQuotes, usdThb, picks, surge] = await Promise.all([
    computeThemeHeat(),
    getNews("stock market", 6),
    getQuotes(indices),
    getQuotes(commodities).catch(() => ({}) as Record<string, Quote>),
    getUsdThb().catch(() => 0),
    getPicks().catch(() => ({ date: "", picks: [], note: "" })),
    getSurge().catch(() => ({ rows: [], asOf: "" })),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const events = (calendarJson as { events: { date: string; label: string; impact: string; star: number }[] }).events
    .filter((e) => e.date >= today)
    .slice(0, 3);
  const thDate = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // ---------- ส่วนประกอบ ----------
  const idxLine = indices
    .map((i) => {
      const q = idxQuotes[i];
      if (!q || !isFinite(q.price)) return null;
      return `${IDX_NAMES[i] ?? i} ${q.price.toFixed(0)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%) ${q.changePct >= 0 ? "🟢" : "🔴"}`;
    })
    .filter(Boolean)
    .join(" | ");
  const oil = cmdQuotes["CL=F"];
  const gold = cmdQuotes["GC=F"];
  const macroLine = [
    oil && isFinite(oil.price) ? `น้ำมัน WTI $${oil.price.toFixed(1)} (${oil.changePct >= 0 ? "+" : ""}${oil.changePct.toFixed(1)}%)` : null,
    gold && isFinite(gold.price) ? `ทอง $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? "+" : ""}${gold.changePct.toFixed(1)}%)` : null,
    usdThb ? `USD/THB ${usdThb.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ธีมร้อน + "ทำไมร้อน" จากหุ้นในเรดาร์ของธีมนั้น (ขยับแรงสุดของกลุ่ม)
  const topThemes = heat.slice(0, 3);
  const themeWatchQuotes = await getQuotes([...new Set(topThemes.flatMap((t) => t.theme.watch.slice(0, 4)))]).catch(() => ({}) as Record<string, Quote>);
  const themeLines = topThemes.map((h, i) => {
    const movers = h.theme.watch
      .slice(0, 4)
      .map((w) => themeWatchQuotes[w])
      .filter((q) => q && isFinite(q.changePct))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    const why = movers[0] ? ` — ขับเคลื่อนโดย ${movers[0].symbol} ${movers[0].changePct >= 0 ? "+" : ""}${movers[0].changePct.toFixed(1)}%${movers[1] ? `, ${movers[1].symbol} ${movers[1].changePct >= 0 ? "+" : ""}${movers[1].changePct.toFixed(1)}%` : ""}` : "";
    const sig = h.avgChange > 0.3 ? " 📈สัญญาณบวก" : h.avgChange < -0.3 ? " 📉สัญญาณลบ" : "";
    return `${i + 1}. ${h.theme.emoji} ${h.theme.name} — ความร้อน ${h.heat}/100${sig}${why}`;
  });

  // Picks (มี cache 30 นาทีของตัวเอง) — Starter ได้ 3 ตัว / Pro ได้ทั้ง 5 + สถานการณ์ของตัวเด่น
  const p3 = picks.picks.slice(0, 3);
  const starterPicks = p3
    .map((p, i) => `${i + 1}. ${p.tagEmoji} ${p.ticker} ${p.currency === "USD" ? "$" : ""}${p.price.toFixed(2)} (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(1)}%) — ${p.tag} · ${p.reason}`)
    .join("\n");
  const proPicks = picks.picks
    .map((p, i) => `${i + 1}. ${p.tagEmoji} ${p.ticker} ${p.currency === "USD" ? "$" : ""}${p.price.toFixed(2)} (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(1)}%) — ${p.reason}${p.dime ? ` · ${p.dime}` : ""}`)
    .join("\n");

  // สถานการณ์ 12 เดือนของ pick อันดับ 1 (Pro เท่านั้น) — EPS จริง × สมมติ P/E
  let scenarioBlock = "";
  try {
    const top = picks.picks[0];
    if (top) {
      const a = await buildAnalysis(top.ticker);
      if ((a as { scenarios?: { scenarios: { label: string; targetPrice: number; upsidePct: number }[] } }).scenarios) {
        const sc = (a as { scenarios: { scenarios: { label: string; targetPrice: number; upsidePct: number }[] } }).scenarios.scenarios;
        const cur = top.currency === "USD" ? "$" : top.currency + " ";
        scenarioBlock = `🎯 สถานการณ์ 12 เดือนของ ${top.ticker} (จาก EPS TTM จริง × สมมติ P/E):\n${sc
          .map((s) => `   ${s.label}: ${cur}${s.targetPrice.toFixed(0)} (${s.upsidePct >= 0 ? "+" : ""}${s.upsidePct.toFixed(0)}%)`)
          .join(" · ")}`;
      }
    }
  } catch {}

  // หุ้นซิ่งพร้อมหลักฐาน (Pro เท่านั้น)
  const surgeTop = surge.rows.slice(0, 3);
  const surgeBlock = surgeTop.length
    ? surgeTop
        .map((r, i) => `${i + 1}. ${r.market} ${r.ticker} +${r.changePct.toFixed(1)}%${r.volRatio ? ` · วอลุ่ม x${r.volRatio}` : ""}${r.pctFrom52wHigh !== null && r.pctFrom52wHigh >= -2 ? " · ทะลุ/แตะยอด 52 สัปดาห์ 🏆" : ""} (คะแนนซิ่ง ${r.surgeScore})`)
        .join("\n")
    : "วันนี้ยังไม่มีหุ้นซิ่งที่ผ่านเกณฑ์ (ขยับ≥3% พร้อมวอลุ่ม/ตำแหน่งกราฟยืนยัน) — วันแบบนี้อย่าเร่งซื้อ";

  // Track Record — ความน่าเชื่อถือคือสิ่งที่ขายได้จริง
  const track = (trackJson as { entries: { status: string; resultPct?: number }[] }).entries;
  const trackOpen = track.filter((e) => e.status === "open").length;
  const trackDone = track.filter((e) => e.status === "win" || e.status === "loss").length;
  const trackWin = track.filter((e) => e.status === "win").length;
  const trackLine = `สถิติเปิดเผย: บันทึกสมมติฐานแล้ว ${track.length} รายการ · ยังเปิด ${trackOpen} · ปิดแล้ว ${trackDone} (ชนะ ${trackWin} = ${trackDone ? Math.round((trackWin / trackDone) * 100) : 0}%) — ดูทุกตัวได้ที่หน้า Track Record`;

  const newsHead = news.slice(0, 3).map((n) => n.title).join(" / ");

  // ---------- AI บรรณาธิการ (2 งาน: มุมมองวันนี้ + สรุปข่าวไทยพร้อมนัย) ----------
  let aiView = "";
  let aiNews = "";
  if (hasAI()) {
    const dataLine = `ดัชนี: ${idxLine}\nสินค้าโภคภัณฑ์: ${macroLine}\nธีมร้อน: ${themeLines.join("; ")}\nข่าวเด่น: ${newsHead}\nPicks: ${picks.picks.slice(0, 3).map((p) => `${p.ticker} ${p.changePct}%`).join(", ")}`;
    try {
      [aiView] = await Promise.all([
        chatOnce(
          [
            { role: "system", content: "คุณเป็นหัวหน้าบรรณาธิการข่าวการเงินภาษาไทย เขียนสั้น กระชับ ใช้ตัวเลขจากข้อมูลจริงที่ให้เท่านั้น ห้ามเดาเพิ่ม โทนสุขุม ไม่ใช่คำแนะนำการลงทุน" },
            { role: "user", content: `${dataLine}\n\nเขียน 2 ส่วน:\n1) "💬 มุมมองวันนี้:" 2-3 ประโยค สรุปสิ่งที่สำคัญที่สุดของตลาดวันนี้\n2) "🗓️ พรุ่งนี้จับตา:" 1-2 ประโยค` },
          ],
          0.4
        ),
        chatOnce(
          [
            { role: "system", content: "คุณเป็นบรรณาธิการแปล-วิเคราะห์ข่าวการเงิน ภาษาไทย จากพาดพิดภาษาอังกฤษ: สรุปแต่ละข่าว 1 ประโยคไทยง่ายๆ + บอกนัยต่อหุ้น/ตลาดอีก 1 ประโยคสั้น ห้ามแต่งตัวเลขที่ไม่มีในข่าว ตอบกลายเป็นรายการ • คั่นด้วยขึ้นบรรทัดใหม่เท่านั้น" },
            { role: "user", content: news.slice(0, 3).map((n) => `- ${n.title}`).join("\n") },
          ],
          0.4
        ).then((r) => {
          aiNews = r;
        }),
      ]);
    } catch {
      aiView = "";
    }
  }
  const newsBlockStarter = aiNews
    ? aiNews.trim()
    : news.slice(0, 3).map((n, i) => `• ${n.title} (${n.publisher})`).join("\n");
  const eventLine = events.length ? events.map((e) => `• ${e.date} — ${e.label} ${"★".repeat(e.star)} (${e.impact})`).join("\n") : "• ไม่มีเหตุการณ์ใหญ่ใกล้หน้า";

  // ---------- 🥉 STARTER ----------
  const fbStarter = `🌅 StockLens Daily Brief — ${thDate}

${aiView || ""}${aiView ? "\n\n" : ""}📊 ตลาดข้ามคืน
${idxLine}
${macroLine ? macroLine : ""}

🔥 ธีมที่ร้อนวันนี้ (Global Radar)
${themeLines.join("\n")}

🎯 หุ้นที่ระบบแนะนำให้รู้จักวันนี้
(คัดจากตัวที่ขยับแรง + ผ่านคะแนนงบการเงิน ≥55/100)
${starterPicks}

📰 ข่าวที่ต้องรู้
${newsBlockStarter}

🗓️ ปฏิทินใกล้หน้า
${eventLine}

———
🔓 Pro เพิ่มอะไร: หุ้นซิ่งพร้อมหลักฐานวอลุ่ม · สถานการณ์ Bull/Base/Bear รายตัว · Flash Alert 24 ชม.
🔬 วิเคราะห์เต็มทุกตัวที่เว็บ StockLens
⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`;

  // ---------- 🥇 PRO ----------
  const fbPro = `⚡ StockLens PRO Daily — ${thDate}

${aiView || ""}${aiView ? "\n\n" : ""}📊 ตลาดข้ามคืน
${idxLine}
${macroLine ? macroLine : ""}

🔥 Radar เจาะลึก — ทำไมธีมนี้ร้อน
${themeLines.join("\n")}

🚀 หุ้นซิ่งวันนี้ (พร้อมหลักฐาน 3 ชั้น: ราคา·วอลุ่ม vs เฉลี่ย 20 วัน·ตำแหน่งกราฟ)
${surgeBlock}
⚠️ ซิ่ง = เสี่ยงสูงสุด — ดู Trust panel ก่อนเสมอ ตั้งจุดตัดขาดทุนก่อนเข้า

🎯 Daily Picks เต็ม 5 ตัว (คะแนน 5 มิติจากงบจริง)
${proPicks}

${scenarioBlock}

📰 ข่าวเชิงลึก + นัยต่อพอร์ต
${newsBlockStarter}

🗓️ ปฏิทินสัปดาห์นี้
${eventLine}

📈 ${trackLine}

———
⚡ เกิดเหตุการณ์ใหญ่ = Flash Alert เด้งในกลุ่มนี้ภายใน 24 ชม.
📄 อยากได้ Deep Dive ฉบับ PDF (มีกราฟ+สถานการณ์+AI 5 มุมมอง) แจ้งแอดมินได้เลย
⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน`;

  return {
    thDate,
    indices: indices.map((i) => idxQuotes[i]).filter((q) => q && isFinite(q.price)),
    themes: topThemes,
    allThemes: heat,
    news,
    events,
    aiCommentary: aiView,
    trackOpen,
    surgeCount: surge.rows.length,
    picksCount: picks.picks.length,
    fbStarter,
    fbPro,
  };
}
