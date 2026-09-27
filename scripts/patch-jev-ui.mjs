// พัตช์ UI สำหรับ Jev enrichment (ทิศทาง+สถานการณ์ ใน prolens, jevOutlook ใน aiopp)
import { readFileSync, writeFileSync } from "node:fs";

// ---------- methodology merge (idempotent) ----------
const enriched = JSON.parse(readFileSync(".zcode/jev-preds-enriched.json", "utf8"));
const scenario = JSON.parse(readFileSync(".zcode/jev-scenario.json", "utf8"));
const rx = JSON.parse(readFileSync(".zcode/jev-reextract.json", "utf8"));
const mPath = "src/data/prolens-methodology.json";
const m = JSON.parse(readFileSync(mPath, "utf8"));
const preds = rx.predictions.map((p, i) => ({ ...p, direction: enriched[i]?.direction ?? null, confidence: enriched[i]?.confidence ?? null }));
const dirCount = {};
for (const p of preds) dirCount[p.direction ?? "unknown"] = (dirCount[p.direction ?? "unknown"] ?? 0) + 1;
m.jevMining.predictions = preds.slice(0, 60);
m.jevMining.directionSummary = dirCount;
m.jevMining.scenario = scenario;
m._updatedAt = new Date().toISOString();
writeFileSync(mPath, JSON.stringify(m, null, 2) + "\n");
console.log("methodology directionSummary =", dirCount);

// ---------- prolens page ----------
const pPath = "src/app/prolens/page.tsx";
let s = readFileSync(pPath, "utf8");
s = s.replace(
  "predictions: { clip: string; quote: string; assets: string | null; timeframe: string | null; predScore: number }[]",
  "predictions: { clip: string; quote: string; assets: string | null; timeframe: string | null; predScore: number; direction?: string | null; confidence?: number | null }[]"
);
s = s.replace(
  "causalQuotes: { clip: string; quote: string }[] } }",
  "causalQuotes: { clip: string; quote: string }[]; directionSummary?: Record<string, number>; scenario?: { dominant: string | null; evidenceScore: number | null; goldLean: number | null; note: string } } }"
);
const dirMap = [
  'const DIR_STYLE: Record<string, { label: string; cls: string }> = { bull: { label: "▲ บวก", cls: "bg-up/15 text-up border-up/30" }, bear: { label: "▼ ลบ", cls: "bg-down/15 text-down border-down/30" }, conditional: { label: "⇄ มีเงื่อนไข", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }, neutral: { label: "● เล่าสถานะ", cls: "bg-base-800 text-zinc-500 border-base-700" } };',
  'const SCEN_TH: Record<string, string> = { warInflationReset: "⚔️ สงคราม+เงินเฟ้อ+Reset ราว 2030 (ทอง/สินค้าโภคภัณฑ์/กลาโหมชนะ)", softLanding: "🕊️ ผ่านพ้นแบบนุ่ม หุ้นโตต่อ", stagflationGrind: "🐢 เงินเฟ้อสูง+เติบโตต่ำยาว (ทองแข็ง หุ้น sideways)" };',
  "",
].join("\n");
if (!s.includes("DIR_STYLE")) s = s.replace("const ASSET_TH:", dirMap + "\nconst ASSET_TH:");

// ชิปทิศทางหลังชิป timeframe
const tfChip = '{p.timeframe && p.timeframe !== "none" && <span className="chip bg-base-800 text-zinc-500 border border-base-700 !text-[10px]">{TF_TH[p.timeframe] ?? p.timeframe}</span>}';
const dirChip = tfChip + '{p.direction && DIR_STYLE[p.direction] && <span className={"chip border !text-[10px] " + DIR_STYLE[p.direction].cls}>{DIR_STYLE[p.direction].label}{p.confidence !== null && p.confidence !== undefined ? " · มั่นใจ " + p.confidence.toFixed(0) + "/3" : ""}</span>}';
if (s.includes(tfChip)) s = s.split(tfChip).join(dirChip);
else console.log("⚠️ tfChip not found");

// บรรทัดสรุปทิศทาง+สถานการณ์ (แทรกก่อน div byAsset)
const byAssetDiv = '<div className="flex flex-wrap gap-1.5 mb-3">\n            {Object.entries(data.jevMining.summary.byAsset)';
const summaryLine = [
  '{data.jevMining.directionSummary && (',
  '            <p className="text-[11px] text-zinc-500 mb-2">',
  '              ทิศทางรวมทั้งคลัง: {Object.entries(data.jevMining.directionSummary).filter(([k]) => DIR_STYLE[k]).map(([k, v]) => DIR_STYLE[k].label + " " + v).join(" · ")}',
  '              {data.jevMining.scenario?.dominant && <> — <b className="text-accent-soft">สถานการณ์เด่นตาม Jev: {SCEN_TH[data.jevMining.scenario.dominant] ?? data.jevMining.scenario.dominant}</b> (หลักฐานเอียง {(data.jevMining.scenario.evidenceScore ?? 0).toFixed(1)}/4 · ทองเอียงบวก {(data.jevMining.scenario.goldLean ?? 0).toFixed(1)}/4)</>}',
  "            </p>",
  "          )}",
  "          " + byAssetDiv,
].join("\n");
if (s.includes(byAssetDiv)) s = s.replace(byAssetDiv, summaryLine);
else console.log("⚠️ byAssetDiv not found");
writeFileSync(pPath, s);
console.log("prolens page patched");

// ---------- aiopp page ----------
const aPath = "src/app/aiopp/page.tsx";
let a = readFileSync(aPath, "utf8");
a = a.replace("flag: string; jev?: number }", 'flag: string; jev?: number; jevOutlook?: { path: string | null; quality: number | null } }');
const oldChip = '{w.jev !== undefined && <span title="คะแนนความมีค่าต่อการจับตา จัดอันดับโดย Jev (TypeSafe System One)" className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[10px] ml-auto num">🧠 Jev {(w.jev * 100).toFixed(0)}</span>}';
const newChip = [
  '{w.jev !== undefined && <span title="คะแนนความมีค่าต่อการจับตา จัดอันดับโดย Jev (TypeSafe System One)" className="chip bg-accent/15 text-accent-soft border border-accent/30 !text-[10px] num">🧠 {(w.jev * 100).toFixed(0)}</span>}',
  '                  {w.jevOutlook?.path && <span title="เส้นทาง 24 เดือนข้างหน้า ตามการประเมินของ Jev (คุณภาพ 0-3)" className={"chip border !text-[10px] ml-auto " + (w.jevOutlook.path === "ipo" ? "bg-up/15 text-up border-up/30" : w.jevOutlook.path === "acquired" ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "bg-base-800 text-zinc-400 border-base-700")}>{w.jevOutlook.path === "ipo" ? "IPO" : w.jevOutlook.path === "acquired" ? "ถูกซื้อกิจการ" : w.jevOutlook.path === "struggle" ? "เสี่ยงชะงัก" : "ระดมเอกชนต่อ"}{w.jevOutlook.quality !== null && w.jevOutlook.quality !== undefined ? " " + w.jevOutlook.quality.toFixed(1) : ""}</span>}',
].join("\n");
if (a.includes(oldChip)) a = a.replace(oldChip, newChip);
else console.log("⚠️ aiopp chip not found");
writeFileSync(aPath, a);
console.log("aiopp page patched");
