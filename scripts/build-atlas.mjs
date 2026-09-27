// รวม scripts/atlas-src/* → src/data/atlas.json + คำนวณตำแหน่งบนกระดานคอร์ก
// รันใหม่หลังแก้ไข source: node scripts/build-atlas.mjs
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "scripts/atlas-src";
const nodes = [
  ...JSON.parse(readFileSync(`${DIR}/nodes-part1.json`, "utf8")),
  ...JSON.parse(readFileSync(`${DIR}/nodes-part2.json`, "utf8")),
  ...JSON.parse(readFileSync(`${DIR}/nodes-part3.json`, "utf8")),
];
const rawEdges = JSON.parse(readFileSync(`${DIR}/edges.json`, "utf8"));
const eras = JSON.parse(readFileSync(`${DIR}/eras.json`, "utf8"));

// ---------- ตรวจความถูกต้อง ----------
const ids = new Set(nodes.map((n) => n.id));
if (ids.size !== nodes.length) {
  const dup = nodes.map((n) => n.id).filter((id, i, a) => a.indexOf(id) !== i);
  throw new Error(`node id ซ้ำ: ${dup}`);
}
for (const e of rawEdges) {
  if (!ids.has(e.from)) throw new Error(`edge อ้าง from ที่ไม่มี: ${e.from}`);
  if (!ids.has(e.to)) throw new Error(`edge อ้าง to ที่ไม่มี: ${e.to}`);
}
const eraIds = new Set(eras.map((e) => e.id));
for (const n of nodes) if (!eraIds.has(n.era)) throw new Error(`node ${n.id} era ไม่มีจริง: ${n.era}`);

// ---------- ตำแหน่ง ----------
const BOARD_W = 4800, BOARD_H = 2150, CARD_W = 190, CARD_H = 140;

const ANCHORS = [
  [1900, 160], [1907, 300], [1913, 380], [1914, 420], [1919, 600], [1923, 700],
  [1925, 740], [1929, 860], [1930, 890], [1933, 990], [1937, 1090], [1939, 1160],
  [1944, 1320], [1945, 1370], [1948, 1440], [1957, 1620], [1965, 1760], [1971, 1920],
  [1973, 2000], [1974, 2040], [1979, 2140], [1985, 2280], [1987, 2352], [1990, 2400],
  [1991, 2440], [1997, 2580], [2000, 2680], [2001, 2720], [2008, 2900], [2010, 3080],
  [2013, 3080], [2020, 3300], [2022, 3370], [2023, 3450], [2024, 3520], [2026, 3560],
];
function yearX(year) {
  if (year <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [y1, x1] = ANCHORS[i - 1], [y2, x2] = ANCHORS[i];
    if (year <= y2) return x1 + ((year - y1) / (y2 - y1)) * (x2 - x1);
  }
  return ANCHORS[ANCHORS.length - 1][1];
}
const BAND = { system: 180, war: 520, crisis: 860, flow: 1200, power: 1540, institution: 1880 };

// โซนขวาสุด = Reset & โลกหลายขั้ว (x แม่นยำ แยกจากแถบเวลา)
const ZONE = {
  greatreset: [3720, 180], cbdc: [3990, 180], ai4ir: [4260, 180],
  trump2: [3720, 520], maralago: [3990, 520], taiwan: [4260, 520],
  debtclock: [3720, 860],
  goldrush22: [3720, 1200],
  dedollar: [3720, 1540], multipolar: [3990, 1540],
  brics: [3720, 1880],
};
// ไมล์ล่าสุดของ main area — จัดมือไม่ให้ทับกัน
const OVERRIDE = {
  covid: [3230, 860], inflation2022: [3395, 860], svb: [3555, 860],
  ukraine: [3230, 520], mideast: [3450, 520],
  m2: [3230, 1240],
  dollarweapon: [3390, 1540],
  thai: [2540, 1420], china: [2740, 1540],
  depression: [730, 660],
  bis: [740, 1880], smoot: [895, 1780], newdeal: [1035, 1950],
  nixonshock: [1950, 210], petrodollar: [2170, 150],
  brettonwoods: [1370, 230],
  oil73: [1975, 900],
  blackmonday: [2340, 900], japanbubble: [2450, 760],
  asiancrisis: [2610, 900], dotcom: [2720, 740], gfc: [2940, 880],
  cantillon: [3040, 1120],
};

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

const placed = [];
for (const n of nodes) {
  const h = hash(n.id);
  const jx = ((h % 120) - 60), jy = (((h >> 7) % 60) - 30), rot = ((h >> 3) % 9) - 4;
  const [ox, oy] = ZONE[n.id] ?? OVERRIDE[n.id] ?? [null, null];
  const x = ox ?? yearX(n.year) + jx * 0.5;
  const y = oy ?? BAND[n.type] + jy;
  placed.push({ ...n, x: Math.round(x), y: Math.round(y), rot });
}

// เตือนถ้าการ์ดทับกันหนัก (แถบเดียวกัน เกลื่อนกัน < 150px)
const warns = [];
for (let i = 0; i < placed.length; i++)
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 120)
      warns.push(`${a.id}(${a.x},${a.y}) ~ ${b.id}(${b.x},${b.y})`);
  }
if (warns.length) console.log("⚠️ ทับกัน:\n" + warns.join("\n"));

const out = {
  meta: { boardW: BOARD_W, boardH: BOARD_H, cardW: CARD_W, cardH: CARD_H, zoneX: 3660, builtAt: new Date().toISOString() },
  eras: eras.map((e) => ({ ...e, x: Math.round(yearX(e.from)) })),
  nodes: placed,
  edges: rawEdges,
};
writeFileSync("src/data/atlas.json", JSON.stringify(out, null, 2) + "\n");
console.log(`✓ atlas.json: ${placed.length} nodes, ${rawEdges.length} edges, ${eras.length} eras`);
