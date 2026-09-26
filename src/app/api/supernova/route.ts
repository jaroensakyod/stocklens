import { NextResponse } from "next/server";
import { getQuotes, getChart } from "@/lib/yahoo";
import { getHolders } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const THB_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// 🛰️ Supernova Monitor — สัญญาณมหภาครวมในไม้บรรทัดเดียว (กรอบวิเคราะห์สาธารณะสายมหภาค/วอลล์สตรีต)
// หลัก: พันธบัตร 10 ปี = เกจวัดความเชื่อมั่น/สงคราม · VIX = ความกลัว · ทอง vs ดอลลาร์ = ความเชื่อระบบเงิน · น้ำมัน = ความเสี่ยงภูมิรัฐศาสตร์
export async function GET() {
  const watch = {
    us10y: "^TNX", // ผลตอบแทนพันธบัตร 10 ปี (×10)
    us02y: "^IRX", // ดอกเบี้ยระยะสั้น (proxy)
    vix: "^VIX",
    dxy: "DX-Y.NYB",
    gold: "GC=F",
    oil: "BZ=F", // Brent
    set: "^SET.BK",
  };
  const entries = Object.entries(watch);
  const [quotesRes, chartsRes] = await Promise.all([
    getQuotes(entries.map(([, s]) => s)),
    Promise.allSettled(entries.map(([, s]) => getChart(s, "5D"))),
  ]);
  const rows = entries.map(([id, sym], i) => {
    const q = quotesRes[sym];
    const chart = chartsRes[i].status === "fulfilled" ? chartsRes[i].value : [];
    let chg5d: number | null = null;
    if (chart.length > 2) {
      const first = chart.find((k) => isFinite(k.close) && k.close > 0);
      const last = chart[chart.length - 1];
      if (first && isFinite(last.close)) chg5d = (last.close / first.close - 1) * 100;
    }
    const labels: Record<string, string> = {
      us10y: "พันธบัตร US 10 ปี", us02y: "ดอกเบี้ยระยะสั้น US", vix: "VIX (ความกลัว)", dxy: "ดัชนีดอลลาร์",
      gold: "ทองคำ", oil: "น้ำมัน Brent", set: "ดัชนี SET",
    };
    return {
      id,
      label: labels[id],
      price: isFinite(q?.price) ? q.price : null,
      changePct: q && isFinite(q.changePct) ? q.changePct : null,
      chg5d,
    };
  });

  // สรุปสัญญาณตามตรรกะ: ยีลด์+ทอง+น้ำมัน ขึ้นพร้อมกัน = ตลาดกลัวเงินเฟ้อ/สงคราม (risk-off inflation)
  const g = (id: string) => rows.find((r) => r.id === id);
  const y10 = g("us10y"), vix = g("vix"), gold = g("gold"), oil = g("oil"), dxy = g("dxy");
  const up = (r?: { chg5d: number | null }) => (r?.chg5d ?? 0) > 1;
  const down = (r?: { chg5d: number | null }) => (r?.chg5d ?? 0) < -1;
  let regime = "ปกติ/ผสม";
  let regimeDetail = "สัญญาณมหภาคไม่ชี้ทางเด่นชัดใน 5 วันที่ผ่านมา";
  if (up(y10) && up(gold) && (up(oil) || up(vix))) {
    regime = "⚠️ Risk-off + เงินแข็งค้นหา";
    regimeDetail = "ยีลด์-ทอง-น้ำมัน(VIX) ขึ้นพร้อมกัน — ตลาดกังวลเงินเฟ้อจากภูมิรัฐศาสตร์ เงินไหลเข้าสินทรัพย์ปลอดภัย (แนวกรอบสายมหภาค: สัญญาณตื่นตัว ไม่ใช่สัญญาณขาย)";
  } else if (down(y10) && up(gold)) {
    regime = "🟡 กังวลถอยถอน/เศรษฐกิจชะลอ";
    regimeDetail = "ยีลด์ลงขณะทองขึ้น — ตลาดเผื่อการชะลอตัว แต่ยังไม่พานิค";
  } else if (up(y10) && up(dxy) && !(vix && (vix.chg5d ?? 0) > 5)) {
    regime = "🟢 เศรษฐกิจแข็งแรง (risk-on ระวังดอกเบี้ย)";
    regimeDetail = "ยีลด์+ดอลลาร์แข็งจากการเติบโต — หุ้นโตต่อได้แต่กดหุ้นปันผล/เทคดอกเบี้ยไว";
  } else if ((vix?.chg5d ?? 0) > 10) {
    regime = "🔴 ความกลัวพุ่ง";
    regimeDetail = "VIX เด้งแรงใน 5 วัน — ภาวะผันผวนสูง ระวังจังหวะเข้า";
  }

  // Insider summary: หุ้น US ใหญ่ 8 ตัว (แคชรายตัวใน getHolders 24 ชม.)
  const insiders = await Promise.allSettled(
    ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM"].map((s) => getHolders(s))
  );
  const insiderRows = insiders
    .map((r, i) => {
      const sym = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM"][i];
      if (r.status !== "fulfilled" || !r.value) return null;
      const a = r.value.insiderActivity;
      if (!a || (!a.buyCount && !a.sellCount)) return null;
      return { symbol: sym, netShares: a.netShares, buyCount: a.buyCount, sellCount: a.sellCount };
    })
    .filter((x): x is { symbol: string; netShares: number; buyCount: number; sellCount: number } => !!x);
  const netBuyers = insiderRows.filter((x) => x.netShares > 0).length;

  return NextResponse.json({
    updatedAt: Date.now(),
    rows,
    regime,
    regimeDetail,
    insider: { netBuyers, n: insiderRows.length, rows: insiderRows },
    note: "กรอบการอ่านสัญญาณแบบสาธารณะ (เกจวัดมหภาคที่นักวิเคราะห์สายมหภาคใช้ทั่วไป) — เป็นข้อมูล ไม่ใช่คำแนะนำการลงทุน",
  });
}
