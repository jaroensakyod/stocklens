// Backfill ราคาย้อนหลัง 5 ปี (OHLCV) จาก Yahoo → Turso — รันครั้งเดียว (หรือเติมเมื่อขยาย universe)
// ใช้: node scripts/backfill-turso.mjs [จำนวนตัวต่อตลาด] (default ไทย 300 + US 200)
// อัตรา: ~3 ตัว/วินาที (พัก 300ms ต่อตัวกันโดน Yahoo throttle) — 500 ตัว ≈ 8-10 นาที
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const c = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

// สร้างตาราง (idempotent — เหมือน src/lib/turso.ts)
await c.execute(`CREATE TABLE IF NOT EXISTS prices_daily (
  date TEXT NOT NULL, symbol TEXT NOT NULL,
  open REAL, high REAL, low REAL, close REAL, volume INTEGER, chg_pct REAL,
  PRIMARY KEY (date, symbol))`);
await c.execute(`CREATE TABLE IF NOT EXISTS scores_daily (
  date TEXT NOT NULL, symbol TEXT NOT NULL,
  total INTEGER, quality INTEGER, valuation INTEGER, momentum INTEGER, news INTEGER, street INTEGER, safety INTEGER,
  confidence INTEGER,
  PRIMARY KEY (date, symbol))`);
await c.execute(`CREATE TABLE IF NOT EXISTS news (
  headline_hash TEXT PRIMARY KEY,
  title TEXT NOT NULL, source TEXT, link TEXT, pub_time INTEGER, lang TEXT,
  theme_id TEXT, jev_sentiment TEXT, jev_impact REAL,
  jev_substantive INTEGER, jev_suspicious INTEGER, heuristic_risk INTEGER, credibility TEXT,
  fetched_at INTEGER)`);
await c.execute(`CREATE TABLE IF NOT EXISTS themes_daily (
  date TEXT NOT NULL, theme_id TEXT NOT NULL,
  heat INTEGER, mood TEXT, mood_score REAL, news_count INTEGER,
  PRIMARY KEY (date, theme_id))`);
console.log("✓ schema พร้อม");

const N_TH = Number(process.argv[2] ?? 300);
const N_US = Number(process.argv[3] ?? 200);
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120" };

async function universe(region, n) {
  const FIELDS = ["name", "close", "change", "market_cap_basic", "sector", "industry", "exchange", "ipo_date", "premarket_change", "country", "dividends_yield"];
  const out = [];
  for (let from = 0; from < n; from += 200) {
    const body = {
      filter: [
        { left: "type", operation: "equal", right: "stock" },
        { left: "market_cap_basic", operation: "in_range", right: [region === "thailand" ? 3e7 : 3e8, 1e16] },
      ],
      columns: FIELDS,
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [from, from + 200],
    };
    const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const j = await res.json();
    const batch = (j.data ?? []).map((x) => x.s.split(":").pop());
    out.push(...batch);
    if (batch.length < 200) break;
  }
  return out.slice(0, n);
}

const toYahoo = (region, s) => (region === "thailand" ? s + ".BK" : s);

async function chartDaily(sym, reg) {
  for (const host of ["query1", "query2"]) {
    try {
      const res = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5y&interval=1d`, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const q = r?.indicators?.quote?.[0] ?? {};
      const rows = [];
      for (let i = 0; i < ts.length; i++) {
        const [o, h, l, cl] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
        if (![o, h, l, cl].every((v) => typeof v === "number" && isFinite(v))) continue;
        const d = new Date(ts[i] * 1000);
        // เป็นข้อมูลรายวัน (UTC) — ปรับเป็นวันตลาดไทย (+7 ก่อนเที่ยงคืน UTC) และ US ใช้วันที่ NY
        const local = region === "thailand" ? new Date((ts[i] + 7 * 3600) * 1000) : d;
        const prev = rows.length ? rows[rows.length - 1] : null;
        rows.push({ date: local.toISOString().slice(0, 10), open: o, high: h, low: l, close: cl, volume: q.volume?.[i] ?? 0, chg: prev ? (cl / prev.close - 1) * 100 : null });
      }
      return rows;
    } catch {}
  }
  return [];
}

const SQL = `INSERT INTO prices_daily (date, symbol, open, high, low, close, volume, chg_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (date, symbol) DO UPDATE SET open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume, chg_pct=excluded.chg_pct`;

// ข้ามตัวที่มีข้อมูลแล้ว (รอบเติมเต็มไม่ต้องดึงซ้ำ)
const existing = new Set((await c.execute("SELECT DISTINCT symbol FROM prices_daily")).rows.map((r) => String(r.symbol)));
console.log("มีอยู่แล้ว:", existing.size, "ตัว — จะข้าม");

const WORKERS = Number(process.env.BF_WORKERS ?? 5); // ขนาน 5 ชุด (Yahoo อึดอัดน้อยกว่า batch quotes)
for (const [reg, n] of [["thailand", N_TH], ["america", N_US]]) {
  let syms = await universe(reg, n);
  const before = syms.length;
  syms = syms.filter((s) => !existing.has(toYahoo(reg, s)));
  console.log(`\n== ${reg}: เติม ${syms.length}/${before} ตัว (ขนาน ${WORKERS}) ==`);
  let done = 0;
  let idx = 0;
  const now = () => new Date().toISOString().slice(11, 19);
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (idx < syms.length) {
        const my = idx++;
        const s = syms[my];
        if (!s) break;
        const y = toYahoo(reg, s);
        const rows = await chartDaily(y, reg);
        if (rows.length) {
          try {
            await c.batch(rows.map((r) => ({ sql: SQL, args: [r.date, y, r.open, r.high, r.low, r.close, Math.round(r.volume), r.chg === null ? null : Math.round(r.chg * 100) / 100] })), "write");
            done++;
          } catch {
            // ข้ามตัวที่ติด
          }
        }
        if (done % 50 === 0 && done > 0) console.log(`  [${now()}] ... ${done}/${syms.length}`);
        await new Promise((r) => setTimeout(r, Number(process.env.BF_DELAY ?? 120)));
      }
    })
  );
  console.log(`== ${reg} เสร็จ: ${done}/${syms.length} ตัว ==`);
}
const total = await c.execute("SELECT COUNT(*) n, COUNT(DISTINCT symbol) s, MIN(date) a, MAX(date) b FROM prices_daily");
console.log("\nคลังรวมตอนนี้:", JSON.stringify(total.rows[0]));
