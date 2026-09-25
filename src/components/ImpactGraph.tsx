"use client";

import type { EventAnalysis } from "@/lib/types";

// 🕸️ กราฟความเชื่อมโยงเหตุการณ์ — วาดเป็นโหนด+เส้นเชื่อม (SVG แท้ พิมพ์/แชร์ได้คมชัด)
// โครง: เหตุการณ์ (ซ้าย) → ตัวกลางที่กระทบ (น้ำมัน/ดอกเบี้ย/อุตสาหกรรม) → หุ้นตัวไหนขึ้น✅/ลง❌ (ขวา พร้อมราคาสด)
export default function ImpactGraph({ result }: { result: EventAnalysis }) {
  const chains = result.chains.filter((c) => c.stocks.length > 0);
  if (chains.length === 0) return null;

  // ---------- จัด layout ----------
  const STOCK_W = 168;
  const STOCK_H = 40;
  const STOCK_GAP = 10;
  const CHAIN_W = 150;
  const CHAIN_H = 54;
  const CHAIN_GAP = 34;
  const PAD = 24;
  const EVENT_X = 90;
  const CHAIN_X = 330;
  const STOCK_X = 620;
  const svgW = STOCK_X + STOCK_W + PAD;

  // ความสูงแต่ละ chain = จำนวนหุ้น (แยกบวก/ลบเป็นช่องเดียวกันเรียงตาม direction)
  const chainDir = (c: (typeof chains)[number]) => (c.stocks.filter((s) => s.direction === "positive").length >= c.stocks.length / 2 ? "up" : "down");
  const bands = chains.map((c) => {
    const n = Math.max(c.stocks.length, 1);
    return { chain: c, height: Math.max(n * (STOCK_H + STOCK_GAP) + 10, CHAIN_H + 12) };
  });
  const totalH = bands.reduce((a, b) => a + b.height + CHAIN_GAP, 0) + PAD * 2;
  const svgH = Math.max(totalH, 260);

  let y = PAD;
  const layout = bands.map((b) => {
    const bandY = y;
    const bandH = b.height;
    const chainCy = bandY + bandH / 2;
    const stocks = b.chain.stocks.map((s, i) => ({
      s,
      y: bandY + 5 + i * (STOCK_H + STOCK_GAP),
    }));
    y += bandH + CHAIN_GAP;
    return { chain: b.chain, chainCy, stocks };
  });

  const eventCy = svgH / 2;
  const eventLabel = result.input.length > 60 ? result.input.slice(0, 57) + "…" : result.input;
  const lines = splitLines(eventLabel, 14);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <h3 className="text-sm font-bold text-zinc-100">🕸️ กราฟความเชื่อมโยง — เหตุการณ์ส่งผลถึงใคร</h3>
        <span className="text-[10px] text-zinc-600">คลิกหุ้นเพื่อเข้าหน้าวิเคราะห์ · เลื่อนดูได้ (มือถือ)</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ minWidth: 780 }} role="img" aria-label="กราฟความเชื่อมโยงเหตุการณ์">
          <defs>
            <marker id="arrowUp" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,6 L6,0 L12,6" fill="none" stroke="#34d399" strokeWidth="1.6" />
            </marker>
            <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,6 L12,0" fill="none" stroke="#fb7185" strokeWidth="1.6" />
            </marker>
          </defs>

          {/* เส้นเชื่อม: เหตุการณ์ → ตัวกลาง */}
          {layout.map(({ chain, chainCy }, i) => {
            const c = chainDir(chain) === "down" ? "#fb7185" : "#2dd4bf";
            return (
              <path
                key={"e" + i}
                d={`M ${EVENT_X + 66} ${eventCy} C ${EVENT_X + 120} ${eventCy}, ${CHAIN_X - 110} ${chainCy}, ${CHAIN_X - 12} ${chainCy}`}
                fill="none"
                stroke={c}
                strokeWidth={2}
                strokeOpacity={0.75}
              />
            );
          })}

          {/* เส้นเชื่อม: ตัวกลาง → หุ้น */}
          {layout.map(({ chain, chainCy, stocks }, i) =>
            stocks.map(({ s, y: sy }, j) => {
              const pos = s.direction === "positive";
              return (
                <path
                  key={`s${i}-${j}`}
                  d={`M ${CHAIN_X + CHAIN_W / 2} ${chainCy} C ${CHAIN_X + CHAIN_W / 2 + 70} ${chainCy}, ${STOCK_X - 80} ${sy + STOCK_H / 2}, ${STOCK_X - 6} ${sy + STOCK_H / 2}`}
                  fill="none"
                  stroke={pos ? "#34d399" : "#fb7185"}
                  strokeWidth={s.strength === "strong" ? 2.4 : s.strength === "medium" ? 1.7 : 1.1}
                  strokeOpacity={0.7}
                  strokeDasharray={s.strength === "weak" ? "4 4" : undefined}
                  markerEnd={pos ? "url(#arrowUp)" : "url(#arrowDown)"}
                />
              );
            })
          )}

          {/* โหนดเหตุการณ์ */}
          <g>
            <circle cx={EVENT_X} cy={eventCy} r={58} fill="#f59e0b" fillOpacity={0.14} stroke="#f59e0b" strokeWidth={2} />
            <text x={EVENT_X} y={eventCy - lines.length * 8 + 4} textAnchor="middle" fill="#fbbf24" fontSize={11} fontWeight={700}>
              ⚡ เหตุการณ์
            </text>
            {lines.map((ln, i) => (
              <text key={i} x={EVENT_X} y={eventCy + 8 + i * 13} textAnchor="middle" fill="#e4e4e7" fontSize={11}>
                {ln}
              </text>
            ))}
          </g>

          {/* โหนดตัวกลาง (สินค้า/มหภาค/อุตสาหกรรม) */}
          {layout.map(({ chain, chainCy }, i) => {
            const down = chainDir(chain) === "down";
            const nameLines = splitLines(chain.name, 13);
            return (
              <g key={"c" + i}>
                <rect
                  x={CHAIN_X - CHAIN_W / 2}
                  y={chainCy - CHAIN_H / 2}
                  width={CHAIN_W}
                  height={CHAIN_H}
                  rx={14}
                  fill={down ? "#fb7185" : "#2dd4bf"}
                  fillOpacity={0.12}
                  stroke={down ? "#fb7185" : "#2dd4bf"}
                  strokeWidth={1.6}
                />
                <text x={CHAIN_X} y={chainCy - nameLines.length * 7 + 2} textAnchor="middle" fill={down ? "#fda4af" : "#5eead4"} fontSize={10.5} fontWeight={700}>
                  {down ? "▼ แรงกดดัน" : "▲ หนุนราคา"}
                </text>
                {nameLines.map((ln, k) => (
                  <text key={k} x={CHAIN_X} y={chainCy + 8 + k * 13} textAnchor="middle" fill="#e4e4e7" fontSize={12} fontWeight={700}>
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}

          {/* โหนดหุ้น (คลิกได้) */}
          {layout.map(({ stocks }, i) =>
            stocks.map(({ s, y: sy }, j) => {
              const pos = s.direction === "positive";
              const q = s.quote;
              const pct = q && isFinite(q.changePct) ? q.changePct : null;
              return (
                <a key={`n${i}-${j}`} href={`/stock/${encodeURIComponent(s.ticker)}`}>
                  <title>{`${s.ticker} — ${s.reason}`}</title>
                  <rect
                    x={STOCK_X}
                    y={sy}
                    width={STOCK_W}
                    height={STOCK_H}
                    rx={9}
                    fill={pos ? "#34d399" : "#fb7185"}
                    fillOpacity={0.1}
                    stroke={pos ? "#34d399" : "#fb7185"}
                    strokeWidth={1.4}
                  />
                  <text x={STOCK_X + 12} y={sy + 17} fill="#fafafa" fontSize={13} fontWeight={800}>
                    {pos ? "✅" : "❌"} {s.ticker}
                  </text>
                  <text x={STOCK_X + 12} y={sy + 31} fill="#a1a1aa" fontSize={9.5}>
                    {s.reason.length > 26 ? s.reason.slice(0, 25) + "…" : s.reason}
                  </text>
                  {pct !== null && (
                    <text x={STOCK_X + STOCK_W - 10} y={sy + 24} textAnchor="end" fill={pct >= 0 ? "#34d399" : "#fb7185"} fontSize={11.5} fontWeight={800}>
                      {pct >= 0 ? "+" : ""}
                      {pct.toFixed(1)}%
                    </text>
                  )}
                </a>
              );
            })
          )}
        </svg>
      </div>
      <p className="text-[10px] text-zinc-600 mt-1">
        เส้นหนา = ผลกระทบแรง · เส้นประ = เบา · % คือราคาหุ้นวันนี้ (delay ~15 นาที) · เหตุผลเต็มดูในเมาส์-กดที่หุ้น
      </p>
    </div>
  );
}

function splitLines(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}
