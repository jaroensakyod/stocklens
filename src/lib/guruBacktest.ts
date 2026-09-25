// ===== Guru Clone Backtest — "ตามกูรูแบบมีหลักฐาน" =====
// จำลอง: ทุกไตรมาสที่ 13F เปิดเผยต่อสาธารณะ (วัน filedAt = วันที่เรารู้ได้จริง ไม่แอบดูก่อนใคร)
// ให้ซื้อหุ้น top-10 (มูลค่ามากสุด ไม่รวม PUT) น้ำหนักเท่ากัน ถือถึงไตรมาสถัดไป แล้วสลับตามพอร์ตใหม่
// เทียบ: ซื้อ SPY ถือยาวช่วงเดียวกัน → ตอบคำถาม "ตามเขาแล้วรวยจริงไหม"
import { getChart, searchSymbols } from "./yahoo";
import { fetchRetry, TICKER_MAP, GURU_CONFIG } from "./gurus13f";
import type { Candle } from "./types";

export interface GuruQuarterLog {
  filedAt: string;
  reportAsOf: string;
  holdings: string[]; // top-10 ของไตรมาสนั้น
  quarterPct: number; // ผลตอบแทนก๊อปปี้กูรูไตรมาสนั้น
  spyPct: number;
  cumClone: number; // มูลค่าสะสม (เริ่ม 100)
  cumSpy: number;
}

export interface GuruBacktestResult {
  guruId: string;
  name: string;
  firm: string;
  emoji: string;
  quarters: GuruQuarterLog[];
  clone: { totalPct: number; cagrPct: number; maxDrawdownPct: number };
  spy: { totalPct: number; cagrPct: number };
  beatsSpy: boolean;
  grade: string; // S/A/B/C/D เทียบ SPY
  uniqueTickers: number;
  turnoverNote: string;
  currentTop: string[]; // top-10 ล่าสุด = "ทำตามวันนี้"
  note: string;
}

// กูรูที่เหมาะก๊อปปี้ top-10 (พอร์ตกระจุก เข้าใจง่าย) — ตัด multi-strategy พัน holdings (RenTech/Bridgewater/Millennium) ที่ top-10 ไม่แทนตัว
export const CLONABLE = ["buffett", "ackman", "druckenmiller", "tepper", "klarman"];

const cache = new Map<string, { at: number; data: GuruBacktestResult }>();
const TTL = 6 * 3600_000;

interface FilingMeta { accession: string; filedAt: string; reportAt: string }

async function getFilingHistory(cik: number, count = 12): Promise<FilingMeta[]> {
  const sub = (await (await fetchRetry(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`)).json()) as {
    filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[] } };
  };
  const rec = sub.filings.recent;
  // 13F-HR + amendment — เอา amendment ล่าสุดของแต่ละ reportDate
  const byReport = new Map<string, FilingMeta>();
  for (let i = 0; i < rec.form.length; i++) {
    if (rec.form[i] !== "13F-HR" && rec.form[i] !== "13F-HR/A") continue;
    const meta = { accession: rec.accessionNumber[i].replace(/-/g, ""), filedAt: rec.filingDate[i], reportAt: rec.reportDate[i] };
    const prev = byReport.get(meta.reportAt);
    if (!prev || meta.filedAt >= prev.filedAt) byReport.set(meta.reportAt, meta); // amendment มาทีหลัง = ฉบับแม่น
  }
  return [...byReport.values()].sort((a, b) => a.filedAt.localeCompare(b.filedAt)).slice(-count);
}

// resolve issuer → ticker แบบ 3 ชั้น: exact map → fuzzy ตัด suffix → Yahoo search (cache ถาวรต่อ session)
const resolved = new Map<string, string | null>();
function normalizeIssuer(issuer: string): string {
  return issuer
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+(INC|CORP|CORPORATION|CO|COMPANY|PLC|LTD|LIMITED|HOLDINGS|HOLDING|GROUP|SPONSORED ADR|ADR|COM SHS|NEW|THE)\b/g, " ")
    .replace(/\b(CLASS|CL|SHS)\s+[A-C]\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
async function resolveTicker(issuer: string): Promise<string | null> {
  if (resolved.has(issuer)) return resolved.get(issuer) ?? null;
  let t: string | null = TICKER_MAP[issuer] ?? null;
  if (!t) {
    const norm = normalizeIssuer(issuer);
    if (norm.length >= 4) {
      for (const k of Object.keys(TICKER_MAP)) {
        if (k.startsWith(norm.slice(0, 12)) || norm.startsWith(k.slice(0, 12))) {
          t = TICKER_MAP[k];
          break;
        }
      }
    }
  }
  if (!t) {
    try {
      const r = await searchSymbols(normalizeIssuer(issuer).slice(0, 40));
      const eq = r.find((x) => /^equity$/i.test(x.type)) ?? r.find((x) => /equity|stock/i.test(x.type));
      if (eq && !/INDEX|ETF/i.test(eq.type)) t = eq.symbol;
    } catch {}
  }
  resolved.set(issuer, t);
  return t;
}

async function fetchTop10(cik: number, acc: string): Promise<string[]> {
  const idx = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/index.json`)).json()) as {
    directory: { item: { name: string }[] };
  };
  const xmlFile = idx.directory.item.map((x) => x.name).find((n) => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary_doc"));
  if (!xmlFile) return [];
  const raw = (await (await fetchRetry(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/${xmlFile}`)).text()).replace(/<(\/?)n[a-zA-Z0-9]*:/g, "<$1");
  const g = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<\\]]+)`, ""));
    return m ? m[1].trim() : "";
  };
  const rows: { ticker: string; value: number }[] = [];
  for (const block of raw.split("</infoTable>")) {
    if (!block.includes("<nameOfIssuer>")) continue;
    const putCall = g(block, "putCall");
    if (putCall === "Put") continue; // เราไม่เล่น short ตามกูรู
    const issuer = g(block, "nameOfIssuer").toUpperCase();
    const value = Number(g(block, "value"));
    if (value > 0) rows.push({ ticker: issuer, value }); // เก็บเป็นชื่อไปก่อน resolve ทีเดียวหลังเรียงลำดับ
  }
  // มูลค่ามากสุดก่อน แล้วตัดซ้ำ (หุ้นเดียวหลายแถว = รวมมูลค่า)
  const sum = new Map<string, number>();
  for (const r of rows) sum.set(r.ticker, (sum.get(r.ticker) ?? 0) + r.value);
  const topNames = [...sum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  const out: string[] = [];
  for (const [name] of topNames) {
    const t = await resolveTicker(name);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

function closeOnOrBefore(candles: Candle[], unix: number): number | null {
  let lo = 0;
  let hi = candles.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= unix) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? candles[ans].close : null;
}

function mdd(series: number[]): number {
  let peak = series[0] ?? 100;
  let m = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    m = Math.min(m, ((v - peak) / peak) * 100);
  }
  return m;
}

export async function runGuruBacktest(guruId: string): Promise<GuruBacktestResult> {
  const cfg = GURU_CONFIG.find((g) => g.id === guruId);
  if (!cfg?.cik || !CLONABLE.includes(guruId)) throw new Error(`กูรู ${guruId} ไม่อยู่ในลิสต์ที่ทดสอบได้ (${CLONABLE.join(", ")})`);

  const hit = cache.get(guruId);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const filings = await getFilingHistory(cfg.cik, 12);
  if (filings.length < 4) throw new Error("ประวัติ 13F ย้อนหลังไม่พอ (ต้องมีอย่างน้อย 4 ไตรมาส)");

  // top-10 ทุกไตรมาส (ไล่ตามลำดับ กัน rate-limit SEC)
  const tops: string[][] = [];
  for (const f of filings) {
    const t = await fetchTop10(cfg.cik, f.accession).catch(() => [] as string[]);
    tops.push(t);
  }

  // ข้อมูลราคาทุก ticker ที่เคยอยู่ top-10 + SPY
  const allTickers = [...new Set(tops.flat())].slice(0, 80);
  const chartMap = new Map<string, Candle[]>();
  await Promise.all(
    allTickers.map(async (t) => {
      const c = await getChart(t, "5YD").catch(() => [] as Candle[]);
      if (c.length > 100) chartMap.set(t, c);
    })
  );
  const spy = await getChart("SPY", "5YD");

  const quarters: GuruQuarterLog[] = [];
  let clone = 100;
  let spyV = 100;
  const cloneSeries: number[] = [100];
  let missingLegs = 0;
  let legs = 0;

  for (let i = 0; i < filings.length - 1; i++) {
    const entryUnix = Date.parse(filings[i].filedAt) / 1000;
    const exitUnix = Date.parse(filings[i + 1].filedAt) / 1000;
    const holdings = tops[i].filter((t) => chartMap.has(t));
    let qRet = 0;
    if (holdings.length) {
      let sum = 0;
      for (const t of holdings) {
        legs++;
        const c = chartMap.get(t)!;
        const p0 = closeOnOrBefore(c, entryUnix);
        const p1 = closeOnOrBefore(c, exitUnix);
        if (p0 && p1) sum += p1 / p0 - 1;
        else missingLegs++;
      }
      qRet = sum / holdings.length;
    }
    const spy0 = closeOnOrBefore(spy, entryUnix);
    const spy1 = closeOnOrBefore(spy, exitUnix);
    const spyQ = spy0 && spy1 ? spy1 / spy0 - 1 : 0;
    clone *= 1 + qRet;
    spyV *= 1 + spyQ;
    cloneSeries.push(clone);
    quarters.push({
      filedAt: filings[i].filedAt,
      reportAsOf: filings[i].reportAt,
      holdings,
      quarterPct: Math.round(qRet * 1000) / 10,
      spyPct: Math.round(spyQ * 1000) / 10,
      cumClone: Math.round(clone * 100) / 100,
      cumSpy: Math.round(spyV * 100) / 100,
    });
  }

  const years = Math.max(quarters.length / 4, 0.5);
  const cloneTotal = clone - 100;
  const spyTotal = spyV - 100;
  const beatsSpy = clone > spyV;
  const edge = cloneTotal - spyTotal;
  let grade = "D";
  if (edge > 30) grade = "S";
  else if (edge > 10) grade = "A";
  else if (beatsSpy) grade = "B";
  else if (edge > -10) grade = "C";

  // วัดการเปลี่ยนพอร์ต: กี่ % ของ top-10 ที่เปลี่ยนระหว่างไตรมาส (เฉลี่ย)
  let changed = 0;
  for (let i = 1; i < tops.length; i++) {
    const prev = new Set(tops[i - 1]);
    changed += tops[i].filter((t) => !prev.has(t)).length / 10;
  }
  const avgChange = Math.round((changed / (tops.length - 1)) * 100);
  const turnoverNote =
    avgChange >= 50 ? `หมุนพอร์ตเร็วมาก (เปลี่ยน ~${avgChange}% ต่อไตรมาส) — ตามจริงต้องเทรดบ่อย ค่าธรรมเนียมกัดกิน` :
    avgChange >= 30 ? `หมุนพอร์ตปานกลาง (~${avgChange}% ต่อไตรมาส) — ตามได้แบบรายไตรมาส` :
    `ถือนิ่งมาก (เปลี่ยนแค่ ~${avgChange}% ต่อไตรมาส) — ตามง่าย เหมาะคนไม่ค่อยแตะพอร์ต`;

  const result: GuruBacktestResult = {
    guruId,
    name: cfg.name,
    firm: cfg.firm,
    emoji: cfg.emoji,
    quarters,
    clone: {
      totalPct: Math.round(cloneTotal * 10) / 10,
      cagrPct: Math.round(((clone / 100) ** (1 / years) - 1) * 1000) / 10,
      maxDrawdownPct: Math.round(mdd(cloneSeries) * 10) / 10,
    },
    spy: {
      totalPct: Math.round(spyTotal * 10) / 10,
      cagrPct: Math.round(((spyV / 100) ** (1 / years) - 1) * 1000) / 10,
    },
    beatsSpy,
    grade,
    uniqueTickers: allTickers.length,
    turnoverNote,
    currentTop: tops[tops.length - 1] ?? [],
    note: `จำลองซื้อ top-10 (มูลค่ามากสุด ไม่รวม PUT) น้ำหนักเท่ากัน ณ วัน 13F เปิดเผยสาธารณะ ถือถึงไตรมาสถัดไป — ไม่มีข้อมูลล่วงหน้า ไม่หักค่าธรรมเนียม/ภาษี · ตำแหน่งที่หุ้นยกเลิก/ไม่มีข้อมูลราคา ${missingLegs}/${legs} ช่วงถือว่าเท่าทุน`,
  };
  cache.set(guruId, { at: Date.now(), data: result });
  return result;
}
