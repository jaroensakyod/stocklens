// อัปเดต name-map.json อัตโนมัติ: ดึงรายชื่อหุ้นไทยทั้งตลาดจาก TradingView → ชื่อบริษัทจาก Yahoo spark
// ใช้: node scripts/update-name-map.mjs
// - ชื่ออังกฤษ (จาก Yahoo) ใส่อัตโนมัติทั้งตลาด ~900 ตัว (เช่น "delta electronics" → DELTA.BK)
// - ชื่อไทย: ใส่เสริมได้ที่ scripts/thai-names.csv (รูปแบบ: SYMBOL,ชื่อไทย ต่อบรรทัด) — SET กันบอทไว้ ดึงอัตโนมัติไม่ได้
// - ไม่ทับของเดิมที่มีอยู่ (alias เดิมชนะเสมอ)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MAP_FILE = "src/data/name-map.json";
const CSV_FILE = "scripts/thai-names.csv";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Content-Type": "application/json" };

// 1) รายชื่อ symbol ทั้งตลาดไทยจาก TradingView (ไล่ทุกหน้าจนหมด)
async function tvThailandSymbols() {
  const out = new Set();
  for (let from = 0; from < 3000; from += 200) {
    const res = await fetch("https://scanner.tradingview.com/thailand/scan", {
      method: "POST",
      headers: UA,
      body: JSON.stringify({
        filter: [{ left: "type", operation: "equal", right: "stock" }],
        columns: ["name"],
        sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
        range: [from, from + 200],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) break;
    const j = await res.json();
    const rows = j.data ?? [];
    if (!rows.length) break;
    for (const r of rows) {
      const s = String(r.s.split(":").pop() ?? "").trim().toUpperCase();
      if (/^[A-Z0-9]+$/.test(s)) out.add(s);
    }
  }
  return [...out];
}

// 2) ชื่อบริษัทจาก Yahoo search (longname — spark meta ไม่มีชื่อ) — ทีละตัว แต่ยิงขนาน 4 ช่อง
async function yahooNames(symbols) {
  const names = new Map();
  const queue = [...symbols];
  const worker = async () => {
    while (queue.length) {
      const sym = queue.shift();
      try {
        const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${sym}.BK&quotesCount=1&newsCount=0`, {
          headers: { "User-Agent": UA["User-Agent"] },
          signal: AbortSignal.timeout(10_000),
        });
        const j = await res.json();
        const name = String(j.quotes?.[0]?.longname ?? "").trim();
        if (name) names.set(sym, name);
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return names;
}

const clean = (s) =>
  s
    .toLowerCase()
    .replace(/\b(pcl|public company limited|plc|co\.,?\s*ltd\.?|company limited|inc\.?|corp\.?|corporation)\b/g, "")
    .replace(/[()\d]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const symbols = await tvThailandSymbols();
console.log("พบหุ้นไทยจาก TV:", symbols.length, "ตัว");
const names = await yahooNames(symbols);
console.log("ได้ชื่อบริษัทจาก Yahoo:", names.size, "ตัว");

// 3) ชื่อไทยเสริมจาก CSV (ถ้ามี)
const thai = new Map();
if (existsSync(CSV_FILE)) {
  for (const line of readFileSync(CSV_FILE, "utf8").split("\n")) {
    const m = line.split(",");
    if (m.length >= 2 && m[0].trim() && m[1].trim()) thai.set(m[0].trim().toUpperCase().replace(".BK", ""), m[1].trim());
  }
  console.log("ชื่อไทยจาก CSV:", thai.size, "ตัว");
}

// 4) เขียนรวม (ของเดิมชนะเสมอ)
const map = JSON.parse(readFileSync(MAP_FILE, "utf8"));
const aliases = map.aliases ?? {};
let added = 0;
for (const sym of symbols) {
  const ticker = sym + ".BK";
  const eng = clean(names.get(sym) ?? "");
  const add = (k, v) => {
    if (k && k.length >= 4 && !aliases[k]) { aliases[k] = v; added++; }
  };
  add(eng, ticker);
  const two = eng.split(" ").slice(0, 2).join(" ");
  if (two !== eng) add(two, ticker);
  add(sym.toLowerCase(), ticker);
  const th = thai.get(sym);
  if (th) add(th, ticker);
}
map.aliases = aliases;
writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + "\n");
console.log(`✅ เพิ่ม ${added} alias ใหม่ → รวมทั้งหมด ${Object.keys(aliases).length} คำ (เขียนลง ${MAP_FILE})`);
