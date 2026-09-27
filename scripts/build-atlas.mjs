// รวม scripts/atlas-src/* → src/data/atlas.json + คำนวณตำแหน่งบนกระดานคอร์ก
// ไทม์ไลน์: 1450-2026 (พื้นที่หลัก) + กระเป๋า "โบราณศาสตร์เงิน" ซ้ายสุด (ไม่ตามสเกลเวลา)
// รันหลังแก้ source: node scripts/build-atlas.mjs
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "scripts/atlas-src";
const nodes = [
  ...JSON.parse(readFileSync(`${DIR}/nodes-part0.json`, "utf8")),
  ...JSON.parse(readFileSync(`${DIR}/nodes-rothschild.json`, "utf8")),
  ...JSON.parse(readFileSync(`${DIR}/nodes-future.json`, "utf8")),
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
const BOARD_W = 8400, BOARD_H = 2150, CARD_W = 190, CARD_H = 140;
const ANCIENT_X = 140, ANCIENT_W = 500; // กระเป๋าโบราณ (ไม่ตามสเกลเวลา)
const ZONE_X = 6000; // โซน Great Reset
const ZONE2_X = 7150; // โซน 🔮 ยุคหลัง 2030 (ม่วง) ขวาสุด

// สเกลเวลา 1450→2026: ช่วงก่อน 1900 กระจายตามความหนาแน่นเหตุการณ์, ช่วงหลัง 1900 ยัดแน่นตามเดิม (+2,340)
const ANCHORS = [
  [1450, 700], [1453, 720], [1488, 800], [1500, 840], [1545, 980], [1557, 1030],
  [1600, 1180], [1609, 1210], [1618, 1260], [1637, 1340], [1648, 1400], [1672, 1470],
  [1688, 1520], [1694, 1550], [1720, 1660], [1756, 1780], [1769, 1830], [1789, 1910],
  [1799, 1950], [1815, 2030], [1839, 2120], [1848, 2170], [1861, 2220], [1868, 2260],
  [1871, 2290], [1873, 2320], [1896, 2430], [1900, 2500],
  [1907, 2640], [1913, 2720], [1914, 2760], [1919, 2940], [1923, 3040], [1925, 3080],
  [1929, 3200], [1930, 3230], [1933, 3330], [1937, 3430], [1939, 3500], [1944, 3660],
  [1945, 3710], [1948, 3780], [1957, 3960], [1965, 4100], [1971, 4260], [1973, 4340],
  [1974, 4380], [1979, 4480], [1985, 4620], [1987, 4692], [1990, 4740], [1991, 4780],
  [1997, 4920], [2000, 5020], [2001, 5060], [2008, 5240], [2010, 5420], [2013, 5420],
  [2020, 5640], [2022, 5710], [2023, 5790], [2024, 5860], [2026, 5900], [2030, 7200], [2035, 7480], [2045, 8080],
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

// กระเป๋าโบราณ (ซ้ายสุด) — วางมือ ไม่ตามสเกล
const ANCIENT = {
  romedebase: [200, 220], songpaper: [360, 480], solidus: [200, 740],
};
// โซนขวาสุด = Reset & โลกหลายขั้ว (x แม่นยำ แยกจากแถบเวลา)
const ZONE = {
  greatreset: [6060, 180], cbdc: [6330, 180], ai4ir: [6600, 180],
  trump2: [6060, 520], maralago: [6330, 520], taiwan: [6600, 520],
  debtclock: [6060, 860],
  goldrush22: [6060, 1200],
  dedollar: [6060, 1540], multipolar: [6330, 1540],
  brics: [6060, 1880],
};
// จุดที่ต้องจัดมือไม่ให้ทับกัน (ส่วนใหญ่คือช่วงเหตุการณ์ถี่)
const OVERRIDE = {
  // ก่อน 1900
  portugal: [660, 1660], constantinople: [740, 1420],
  dutchgolden: [1360, 1620], glorious1688: [1560, 1440],
  paxbrit: [1900, 1560], industrial: [1720, 1400], rothschild: [2100, 1500],
  meiji: [2190, 1330], germanyunify: [2390, 1610],
  opium: [2070, 660], uscivilwar: [2260, 460],
  napoleon: [1900, 600], waterloo1815: [2130, 820],
  goldfix1919: [2960, 330],
  mingsilver: [1120, 1330],
  // ยุค AI/หลัง 2030
  aibubble: [5700, 170], gold100k: [5900, 1230], zombieset: [5750, 1090],
  at2030: [7250, 200], agi2030: [7540, 200], newhegemon: [7830, 200], ailadder: [8100, 200], ibbotson100: [5730, 1690],
  // หลัง 1900
  depression: [3070, 660],
  bis: [3080, 1880], smoot: [3235, 1780], newdeal: [3375, 1950],
  brettonwoods: [3710, 230], nixonshock: [4290, 210], petrodollar: [4510, 150],
  oil73: [4315, 900],
  blackmonday: [4680, 900], japanbubble: [4790, 760],
  asiancrisis: [4950, 900], dotcom: [5060, 740], gfc: [5280, 880], cantillon: [5380, 1120],
  covid: [5470, 830], inflation2022: [5700, 940], svb: [5895, 860], gme2021: [5580, 1060],
  ukraine: [5570, 520], mideast: [5790, 520],
  m2: [5570, 1240],
  dollarweapon: [5730, 1540],
  thai: [4880, 1420], china: [5080, 1540],
};

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

const placed = [];
for (const n of nodes) {
  const h = hash(n.id);
  const jx = ((h % 120) - 60), jy = (((h >> 7) % 60) - 30), rot = ((h >> 3) % 9) - 4;
  const [ox, oy] = ANCIENT[n.id] ?? ZONE[n.id] ?? OVERRIDE[n.id] ?? [null, null];
  const x = ox ?? yearX(n.year) + jx * 0.5;
  const y = oy ?? BAND[n.type] + jy;
  placed.push({ ...n, x: Math.round(x), y: Math.round(y), rot });
}

// เตือนถ้าการ์ดทับกันหนัก (เกลื่อนกัน < 150px ทั้งแกน)
const warns = [];
for (let i = 0; i < placed.length; i++)
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 120)
      warns.push(`${a.id}(${a.x},${a.y}) ~ ${b.id}(${b.x},${b.y})`);
  }
if (warns.length) console.log("⚠️ ทับกัน:\n" + warns.join("\n"));

const out = {
  meta: { boardW: BOARD_W, boardH: BOARD_H, cardW: CARD_W, cardH: CARD_H, zoneX: ZONE_X, zone2X: ZONE2_X, ancientX: ANCIENT_X, ancientW: ANCIENT_W, builtAt: new Date().toISOString() },
  eras: eras.map((e) => ({ ...e, x: e.id === "ancient" ? ANCIENT_X : Math.round(yearX(e.from)) })),
  nodes: placed,
  edges: rawEdges,
};
writeFileSync("src/data/atlas.json", JSON.stringify(out, null, 2) + "\n");
console.log(`✓ atlas.json: ${placed.length} nodes, ${rawEdges.length} edges, ${eras.length} eras`);
