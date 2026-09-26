// ===== 🛰️ Supernova Monitor — สัญญาณมหภาครวมในไม้บรรทัดเดียว =====
// หลัก: พันธบัตร 10 ปี = เกจวัดความเชื่อมั่น/สงคราม · VIX = ความกลัว · ทอง vs ดอลลาร์ = ความเชื่อระบบเงิน · น้ำมัน = ความเสี่ยงภูมิรัฐศาสตร์
// (ย้ายมาจาก /api/supernova เพื่อให้หน้า /trend ใช้ร่วมกันได้)
import { getQuotes, getChart } from "./yahoo";

export interface SupernovaRow {
  id: string;
  label: string;
  price: number | null;
  changePct: number | null;
  chg5d: number | null;
}

export interface SupernovaResult {
  updatedAt: number;
  rows: SupernovaRow[];
  regime: string;
  regimeDetail: string;
  insider: { netBuyers: number; n: number; rows: { symbol: string; netShares: number; buyCount: number; sellCount: number }[] };
  note: string;
}

const WATCH: Record<string, string> = {
  us10y: "^TNX", // ผลตอบแทนพันธบัตร 10 ปี (×10)
  us02y: "^IRX", // ดอกเบี้ยระยะสั้น (proxy)
  vix: "^VIX",
  dxy: "DX-Y.NYB",
  gold: "GC=F",
  oil: "BZ=F", // Brent
  set: "^SET.BK",
};

export async function getSupernova(): Promise<Omit<SupernovaResult, "insider">> {
  const entries = Object.entries(WATCH);
  const [quotesRes, chartsRes] = await Promise.all([
    getQuotes(entries.map(([, s]) => s)),
    Promise.allSettled(entries.map(([, s]) => getChart(s, "5D"))),
  ]);
  const rows: SupernovaRow[] = entries.map(([id, sym], i) => {
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

  return {
    updatedAt: Date.now(),
    rows,
    regime,
    regimeDetail,
    note: "กรอบการอ่านสัญญาณแบบสาธารณะ (เกจวัดมหภาคที่นักวิเคราะห์สายมหภาคใช้ทั่วไป) — เป็นข้อมูล ไม่ใช่คำแนะนำการลงทุน",
  };
}
