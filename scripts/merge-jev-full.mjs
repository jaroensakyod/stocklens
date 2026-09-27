// 🧠 จุดที่ 3 — merge ผล full suite เข้า methodology + patch หน้า /prolens (3 subsections ใหม่)
import { readFileSync, writeFileSync } from "node:fs";

// ---------- merge ----------
const cross = JSON.parse(readFileSync(".zcode/jev-cross.json", "utf8"));
const mPath = "src/data/prolens-methodology.json";
const m = JSON.parse(readFileSync(mPath, "utf8"));
m.jevMining.fullSuite = {
  ranAt: cross.ranAt,
  phaseCount: cross.phaseCount,
  adviceCount: cross.adviceCount,
  convictionAvg: cross.convictionAvg,
  highConviction: cross.highConviction,
  contradictions: cross.contradictions,
  stockCalls: cross.stockCalls,
  allocation: cross.allocation,
  note: "Jev full suite: 380 chunks × 4 คำถาม (conviction/เฟส/คำแนะนำ/หุ้น actionable) + วิเคราะห์ข้ามคลิป — รวม Jev ทั้งสิ้น ~860 calls สำหรับคลังนี้",
};
m._updatedAt = new Date().toISOString();
writeFileSync(mPath, JSON.stringify(m, null, 2) + "\n");
console.log("merged:", { posture: cross.allocation.posture, highConv: cross.highConviction.length, stocks: cross.stockCalls.map(s => s.ticker + "(" + s.chunks + ")").join(",") });

// ---------- lib ส่งออก ----------
let lib = readFileSync("src/lib/prolens.ts", "utf8");
if (!lib.includes("fullSuite")) {
  lib = lib.replace("jevMining: (methodology as Record<string, unknown>).jevMining ?? null };", "jevMining: (methodology as Record<string, unknown>).jevMining ?? null }; // jevMining.fullSuite อยู่ในนั้นแล้ว");
  writeFileSync("src/lib/prolens.ts", lib);
}

// ---------- page: interface + 3 subsections ----------
const pPath = "src/app/prolens/page.tsx";
let s = readFileSync(pPath, "utf8");

// interface เพิ่ม fullSuite
s = s.replace(
  "directionSummary?: Record<string, number>; scenario?: { dominant: string | null; evidenceScore: number | null; goldLean: number | null; note: string } } }",
  [
    "directionSummary?: Record<string, number>; scenario?: { dominant: string | null; evidenceScore: number | null; goldLean: number | null; note: string };",
    "  fullSuite?: {",
    "    phaseCount: Record<string, number>; adviceCount: Record<string, number>; convictionAvg: number | null;",
    "    highConviction: { asset: string; direction: string; clipCount: number; quoteCount: number; avgConfidence: number; sample: string[] }[];",
    "    contradictions: { asset: string; bear: { quote: string; clip: string }; bull: { quote: string; clip: string }; verdict: string | null; lean: number | null }[];",
    "    stockCalls: { ticker: string; chunks: number; priceRange: { min: number; max: number; n: number } | null; sample: { clip: string; ctx: string } | null }[];",
    "    allocation: { posture: string | null; cashRole: number | null; note: string };",
    "  } }",
  ].join("\n")
);

// maps ภาษาไทยเพิ่ม
const maps2 = [
  'const PHASE_TH: Record<string, string> = { buildup: "🧱 สะสม/เตรียม", war: "⚔️ สงคราม/วิกฤต", reset: "🔄 รีเซ็ต", rebuild: "🏗️ สร้างใหม่" };',
  'const ADVICE_TH: Record<string, string> = { buy: "🟢 ซื้อ/สะสม", sell: "🔴 ขาย/ลด", holdcash: "💵 ถือเงินสด/รอ", prepare: "🎒 เตรียมตัว", debt: "📉 ลดหนี้", diversify: "⚖️ กระจาย" };',
  'const POSTURE_TH: Record<string, string> = { maxCashGold: "เงินสดสูง+ทองหนัก รอซื้อวิกฤต", barbell: "บาร์เบล: ทอง/สินค้าโภคภัณฑ์ + หุ้นคุณภาพนิดหน่อย", allIn: "ลงหุ้นเต็มตัว", diversified: "กระจายทุกสินทรัพย์เท่ากัน" };',
  'const VERDICT_TH: Record<string, string> = { changed: "⚡ เปลี่ยนความเห็นจริง", timeframe: "✓ ไม่ขัดกัน — ต่าง timeframe/เงื่อนไข", differentAsset: "✓ คนละประเด็นในสินทรัพย์เดียวกัน" };',
  "",
].join("\n");
if (!s.includes("PHASE_TH")) s = s.replace("const ASSET_TH:", maps2 + "const ASSET_TH:");

// แทรก 3 subsections ท้าย section Jev (ก่อนปิด div card ของ section — หาจุดปิด: หลัง list พยากรณ์ 12 อันดับ)
const closeAnchor = "          </div>\n        </div>\n      )}\n\n      {/* 6. Dual Lens: T vs J */}";
const block = [
  "          {/* ▼▼▼ Full Suite เพิ่ม 27 ก.ย. 2026 ▼▼▼ */}",
  "          {data.jevMining.fullSuite && (",
  "            <>",
  "              <div className=\"mt-4 pt-3 border-t border-base-700/60 grid sm:grid-cols-3 gap-3 text-center\">",
  "                <div className=\"bg-base-900 rounded-lg px-3 py-2\">",
  "                  <div className=\"text-[10px] text-zinc-500\">เฟสที่พูดถึงบ่อยสุด (380 chunks)</div>",
  "                  <div className=\"text-[13px] text-zinc-200 mt-1 leading-relaxed\">{Object.entries(data.jevMining.fullSuite.phaseCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className=\"mr-2\">{PHASE_TH[k] ?? k} <b className=\"num text-accent-soft\">{v}</b></span>)}</div>",
  "                </div>",
  "                <div className=\"bg-base-900 rounded-lg px-3 py-2\">",
  "                  <div className=\"text-[10px] text-zinc-500\">คำแนะนำที่บอกผู้ชม</div>",
  "                  <div className=\"text-[13px] text-zinc-200 mt-1 leading-relaxed\">{Object.entries(data.jevMining.fullSuite.adviceCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className=\"mr-2\">{ADVICE_TH[k] ?? k} <b className=\"num text-accent-soft\">{v}</b></span>)}</div>",
  "                </div>",
  "                <div className=\"bg-accent/10 border border-accent/25 rounded-lg px-3 py-2\">",
  "                  <div className=\"text-[10px] text-zinc-500\">Posture ที่คำแนะนำสื่อ (Jev สังเคราะห์)</div>",
  "                  <div className=\"text-[13px] font-bold text-accent-soft mt-1\">{POSTURE_TH[data.jevMining.fullSuite.allocation.posture ?? \"\"] ?? data.jevMining.fullSuite.allocation.posture}</div>",
  "                  <div className=\"text-[10px] text-zinc-500 mt-0.5\">บทบาทเงินสด (รอซื้อวิกฤต) {(data.jevMining.fullSuite.allocation.cashRole ?? 0).toFixed(0)}/3 · conviction เฉลี่ย {(data.jevMining.fullSuite.convictionAvg ?? 0).toFixed(1)}/3</div>",
  "                </div>",
  "              </div>",
  "",
  "              {data.jevMining.fullSuite.highConviction.length > 0 && (",
  "                <div className=\"mt-4\">",
  "                  <div className=\"text-xs font-bold text-zinc-300 mb-2\">📌 พยากรณ์หนักแน่น — ทิศทางเดียวกันซ้ำ ≥3 คลิป ({data.jevMining.fullSuite.highConviction.length} กลุ่ม)</div>",
  "                  <div className=\"grid sm:grid-cols-2 gap-2\">",
  "                    {data.jevMining.fullSuite.highConviction.map((h, i) => (",
  "                      <div key={i} className=\"bg-base-850 rounded-lg px-3 py-2\">",
  "                        <div className=\"flex items-center gap-2 flex-wrap\">",
  "                          <span className=\"chip bg-base-800 text-zinc-300 border border-base-700 !text-[10px]\">{ASSET_TH[h.asset] ?? h.asset}</span>",
  "                          <span className={`chip border !text-[10px] ${h.direction === \"bull\" ? \"bg-up/15 text-up border-up/30\" : \"bg-down/15 text-down border-down/30\"}`}>{h.direction === \"bull\" ? \"▲ บวกต่อเนื่อง\" : \"▼ ลบต่อเนื่อง\"}</span>",
  "                          <span className=\"text-[10px] text-zinc-500 num\">{h.clipCount} คลิป · {h.quoteCount} พูด · มั่นใจเฉลี่ย {h.avgConfidence.toFixed(1)}/3</span>",
  "                        </div>",
  "                        <p className=\"text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2\">“{h.sample[0]}”</p>",
  "                      </div>",
  "                    ))}",
  "                  </div>",
  "                </div>",
  "              )}",
  "",
  "              {data.jevMining.fullSuite.contradictions.length > 0 && (",
  "                <div className=\"mt-4\">",
  "                  <div className=\"text-xs font-bold text-zinc-300 mb-2\">⚖️ ตรวจความขัดแย้ง — bull กับ bear ในสินทรัพย์เดียวกัน (Jev ตัดสิน)</div>",
  "                  <div className=\"space-y-2\">",
  "                    {data.jevMining.fullSuite.contradictions.map((c, i) => (",
  "                      <div key={i} className=\"bg-base-850 rounded-lg px-3 py-2\">",
  "                        <div className=\"flex items-center gap-2 flex-wrap\">",
  "                          <span className=\"chip bg-base-800 text-zinc-300 border border-base-700 !text-[10px]\">{ASSET_TH[c.asset] ?? c.asset}</span>",
  "                          {c.verdict && <span className={`chip border !text-[10px] ${c.verdict === \"changed\" ? \"bg-amber-500/15 text-amber-400 border-amber-500/30\" : \"bg-up/10 text-up border-up/25\"}`}>{VERDICT_TH[c.verdict] ?? c.verdict}</span>}",
  "                          {c.lean !== null && <span className=\"text-[10px] text-zinc-500 num\">น้ำหนักรวมเอียงบวก {c.lean.toFixed(1)}/4</span>}",
  "                        </div>",
  "                        <div className=\"grid sm:grid-cols-2 gap-2 mt-1.5\">",
  "                          <p className=\"text-[11px] text-down leading-snug\">▼ “{c.bear.quote.slice(0, 140)}”</p>",
  "                          <p className=\"text-[11px] text-up leading-snug\">▲ “{c.bull.quote.slice(0, 140)}”</p>",
  "                        </div>",
  "                      </div>",
  "                    ))}",
  "                  </div>",
  "                </div>",
  "              )}",
  "",
  "              {data.jevMining.fullSuite.stockCalls.length > 0 && (",
  "                <div className=\"mt-4\">",
  "                  <div className=\"text-xs font-bold text-zinc-300 mb-2\">💼 หุ้นที่พูดถึงพร้อมคำแนะนำ + ราคาตอนพูด (ตรวจย้อนกับราคาปัจจุบันได้ที่หน้าหุ้น)</div>",
  "                  <div className=\"grid sm:grid-cols-2 gap-2\">",
  "                    {data.jevMining.fullSuite.stockCalls.map((sc) => (",
  "                      <div key={sc.ticker} className=\"bg-base-850 rounded-lg px-3 py-2 flex items-start gap-2\">",
  "                        <Link href={`/stock/${encodeURIComponent(sc.ticker.replace(\" หรือ NVDA\", \"\"))}`} className=\"chip bg-accent/15 text-accent-soft border border-accent/30 !text-[11px] shrink-0\">{sc.ticker.replace(\" หรือ NVDA\", \"\")}</Link>",
  "                        <div className=\"min-w-0\">",
  "                          <span className=\"text-[10px] text-zinc-500 num\">พูดใน {sc.chunks} chunks{sc.priceRange ? ` · ราคาตอนพูด ${sc.priceRange.min}–${sc.priceRange.max} บาท (${sc.priceRange.n} ครั้ง)` : \"\"}</span>",
  "                          {sc.sample && <p className=\"text-[11px] text-zinc-400 leading-snug line-clamp-2\">{sc.sample.ctx.slice(0, 160)}</p>}",
  "                        </div>",
  "                      </div>",
  "                    ))}",
  "                  </div>",
  "                </div>",
  "              )}",
  "            </>",
  "          )}",
  closeAnchor,
].join("\n");
if (!s.includes(closeAnchor)) { console.log("❌ closeAnchor NOT FOUND"); process.exit(1); }
s = s.replace(closeAnchor, block);
writeFileSync(pPath, s);
console.log("page patched");
