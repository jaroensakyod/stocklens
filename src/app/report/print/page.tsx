"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Candle, StockAnalysis } from "@/lib/types";
import { mdToHtml } from "@/lib/markdown";

// หน้ารายงานพร้อมพิมพ์เป็น PDF (Ctrl+P → Save as PDF) — มาตรฐานสิ่งพิมพ์ A4
// หัวกระดาษแบรนด์สีตาม tier · ตารางมีหัวซ้ำทุกหน้า · section ไม่ขาดกลางหน้า · footer ทุกหน้า · watermark กันแชร์ไฟล์
export default function ReportPrintPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-zinc-400">กำลังเตรียมรายงาน…</div>}>
      <ReportInner />
    </Suspense>
  );
}

// 📈 กราฟราคาแบบ SVG 1 ปี — พิมพ์คมชัดทุกความละเอียด (canvas/JS chart พิมพ์แล้วเบลอ)
function PriceSpark({ candles, currency, upHint }: { candles: Candle[]; currency: string; upHint?: string }) {
  if (candles.length < 10) return null;
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const W = 720;
  const H = 150;
  const PAD = 8;
  const pts = closes.map((v, i) => {
    const x = PAD + (i / (closes.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / span) * (H - PAD * 2 - 18);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = closes[0];
  const last = closes[closes.length - 1];
  const chg = ((last - first) / first) * 100;
  const up = chg >= 0;
  const stroke = up ? "#047857" : "#be123c";
  const y0 = H - 16;
  return (
    <figure className="my-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="กราฟราคา 1 ปี">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`${PAD},${y0} ${pts.join(" ")} ${W - PAD},${y0}`} fill="url(#sparkFill)" />
        <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
        <text x={PAD} y={H - 3} fontSize="10" fill="#71717a" textAnchor="start">{first.toFixed(2)} {currency} (1 ปีก่อน)</text>
        <text x={W - PAD} y={H - 3} fontSize="11" fontWeight="700" fill={stroke} textAnchor="end">{last.toFixed(2)} {currency} ({up ? "+" : ""}{chg.toFixed(1)}%){upHint ? ` · ${upHint}` : ""}</text>
        <text x={W - PAD} y={PAD + 6} fontSize="9" fill="#a1a1aa" textAnchor="end">สูงสุด {max.toFixed(2)}</text>
        <text x={PAD} y={PAD + 6} fontSize="9" fill="#a1a1aa">ต่ำสุด {min.toFixed(2)}</text>
      </svg>
    </figure>
  );
}

function ReportInner() {
  const sp = useSearchParams();
  const type = sp.get("type") || "brief";
  const tier = sp.get("tier") || "starter";
  const ticker = (sp.get("t") || "").toUpperCase();
  const persona = sp.get("persona") || "";
  const ev = sp.get("ev") || "";

  const [brief, setBrief] = useState<null | {
    thDate: string;
    indices: { symbol: string; price: number; changePct: number }[];
    themes: { theme: { emoji: string; name: string; desc: string }; heat: number; avgChange: number }[];
    news: { title: string; publisher: string }[];
    events: { date: string; label: string; impact: string }[];
    fbStarter: string;
    fbPro: string;
  }>(null);
  const [a, setA] = useState<(StockAnalysis & { usdThb?: number; scenarios?: { scenarios: { name: string; label: string; targetPrice: number; upsidePct: number; assumptions: string }[]; method: string } }) | null>(null);
  const [aiText, setAiText] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [flash, setFlash] = useState<null | { headline: string; narrative?: string; engine: string; chains: { name: string; reason: string; stocks: { ticker: string; direction: string; reason: string }[] }[] }>(null);

  const isStockReport = type === "deepdive" || (type === "flash" && !!ticker);

  useEffect(() => {
    if (type === "brief") fetch("/api/brief").then((r) => r.json()).then(setBrief).catch(() => {});
    if (isStockReport && ticker) {
      fetch(`/api/analysis?s=${encodeURIComponent(ticker)}`).then((r) => r.json()).then(setA).catch(() => {});
      fetch(`/api/chart?s=${encodeURIComponent(ticker)}&range=1Y`).then((r) => r.json()).then((j) => setCandles(j.candles ?? [])).catch(() => {});
      fetch(`/api/ai/analyze?s=${encodeURIComponent(ticker)}${persona ? `&persona=${persona}` : ""}`)
        .then((r) => r.text())
        .then(setAiText)
        .catch(() => setAiText("วิเคราะห์ไม่สำเร็จ — ลองใหม่"));
    }
    // Flash จากเหตุการณ์ (ev=) → ห่วงโซ่ Radar + AI
    if (type === "flash" && ev && !ticker) {
      fetch("/api/radar/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ev }) })
        .then((r) => r.json())
        .then((j) => setFlash({ headline: j.headline, narrative: j.narrative, engine: j.engine, chains: (j.chains ?? []).map((c: { name: string; reason: string; stocks: { ticker: string; direction: string; reason: string }[] }) => ({ name: c.name, reason: c.reason, stocks: c.stocks })) }))
        .catch(() => setFlash(null));
    }
  }, [type, ticker, persona, ev, isStockReport]);

  const wm = Array.from({ length: 24 }, (_, i) => (
    <span key={i}>StockLens · {tier.toUpperCase()} · {new Date().toLocaleDateString("th-TH")}</span>
  ));

  const title =
    type === "brief" ? "Daily Brief รายงานตลาดประจำวัน" :
    type === "deepdive" ? (persona === "geo" ? `Geopolitical Weekly: ${ticker}` : `Deep Dive: ${ticker}`) :
    type === "flash" ? (ev && !ticker ? "Flash Report" : `Flash Report: ${ticker}`) : "Report";
  const sub =
    type === "brief" ? "สรุปตลาด · ธีม Radar · ปฏิทิน · ข่าว — อ่านจบ 5 นาที" :
    persona === "geo" ? "วิเคราะห์ภูมิรัฐศาสตร์ 5 ชั้น (ช่องแคบ · ห่วงโซ่อุปทาน · คว่ำบัตร · ผลประโยชน์ชาติ · ดอลลาร์/ทอง)" :
    type === "deepdive" ? "บทวิเคราะห์เชิงลึกพร้อมข้อมูลงบจริง" :
    "รายงานด่วนภายใน 24 ชม. หลังเหตุการณ์";
  const dateStr = brief?.thDate ?? new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const refNo = "SL-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  return (
    <div className="bg-zinc-800 min-h-screen py-8 print:bg-white print:py-0">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex gap-2 justify-center items-center flex-wrap">
        <button className="btn-primary" onClick={() => window.print()}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
        <span className="text-xs text-zinc-400">เลือก &ldquo;Save as PDF&rdquo; ขนาด A4 · แนะนำปิด Headers/Footers ของเบราว์เซอร์</span>
      </div>

      <div className="report-page shadow-2xl">
        <div className="watermark">{wm}</div>

        {/* หัวกระดาษแบรนด์ — สีตามระดับสมาชิก */}
        <header className={`rp-header ${tier === "pro" ? "tier-pro" : "tier-starter"}`}>
          <div>
            <h1>🔬 StockLens</h1>
            <p className="rp-sub">{title}</p>
            <p className="rp-sub" style={{ fontSize: 10, opacity: 0.7 }}>{sub}</p>
          </div>
          <div className="rp-meta">
            <span className="rp-tier-badge">{tier === "pro" ? "🥇 PRO" : "🥉 STARTER"}</span>
            <span>{dateStr}</span>
            <span>อ้างอิง {refNo}</span>
            <span>สื่อวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน</span>
          </div>
        </header>

        <div className="rp-body">
          {type === "brief" && (
            !brief ? <p className="text-zinc-500">กำลังโหลด…</p> : (
              <>
                <section>
                  <h2>📊 ตลาดเมื่อวาน</h2>
                  <table>
                    <thead>
                      <tr><th>ดัชนี</th><th style={{ textAlign: "right" }}>ระดับ</th><th style={{ textAlign: "right" }}>เปลี่ยนแปลง</th></tr>
                    </thead>
                    <tbody>
                      {brief.indices.map((i) => (
                        <tr key={i.symbol}>
                          <td className="font-semibold">{i.symbol}</td>
                          <td className="num" style={{ textAlign: "right" }}>{i.price.toFixed(2)}</td>
                          <td className={`num font-semibold ${i.changePct >= 0 ? "text-emerald-700" : "text-rose-700"}`} style={{ textAlign: "right" }}>
                            {i.changePct >= 0 ? "▲ +" : "▼ "}{i.changePct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h2>🔥 Global Radar — ธีมที่ร้อนที่สุด</h2>
                  <table>
                    <thead>
                      <tr><th>ธีม</th><th style={{ textAlign: "right" }}>ความร้อน</th><th>สิ่งที่ติดตาม</th></tr>
                    </thead>
                    <tbody>
                      {brief.themes.map((t) => (
                        <tr key={t.theme.name}>
                          <td className="font-semibold">{t.theme.emoji} {t.theme.name}</td>
                          <td className="num font-semibold" style={{ textAlign: "right" }}>{t.heat}/100</td>
                          <td className="text-zinc-600" style={{ fontSize: 10 }}>{t.theme.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h2>🗓️ ปฏิทินสำคัญ</h2>
                  {brief.events.length === 0 ? (
                    <p className="text-zinc-500">ไม่มีเหตุการณ์ใหญ่ใกล้หน้า</p>
                  ) : (
                    <table>
                      <thead>
                        <tr><th style={{ width: "22%" }}>วันที่</th><th>เหตุการณ์</th><th style={{ width: "30%" }}>นัยต่อตลาด</th></tr>
                      </thead>
                      <tbody>
                        {brief.events.map((e) => (
                          <tr key={e.date + e.label}>
                            <td className="num font-semibold">{e.date}</td>
                            <td>{e.label}</td>
                            <td className="text-zinc-600" style={{ fontSize: 10 }}>{e.impact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h2>📰 ข่าวที่ต้องรู้</h2>
                  <ul style={{ margin: "0 0 0 16px", listStyle: "disc" }}>
                    {brief.news.map((n, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>{n.title} <span className="text-zinc-400">— {n.publisher}</span></li>
                    ))}
                  </ul>
                </section>

                {tier === "pro" ? (
                  <section className="rp-callout">
                    <h2 style={{ border: "none", margin: "0 0 4px", padding: 0 }}>🥇 ส่วนเฉพาะ Pro ในฉบับนี้</h2>
                    <p>Watchlist เฉพาะกลุ่ม · Flash Alert ผ่าน LINE เมื่อเกิดเหตุการณ์ใหญ่ (ภายใน 24 ชม.) · เจาะรายตัว Deep Dive ในฉบับถัดไป — อย่าลืมเปิดแจ้งเตือน LINE</p>
                  </section>
                ) : (
                  <section className="rp-lock">
                    🔒 <strong>อัปเกรด Pro</strong> เพื่อรับ Flash Alert 24 ชม. + Deep Dive รายตัว + สัญญาณเทคนิคเต็ม — รายละเอียดในกลุ่ม VIP
                  </section>
                )}
              </>
            )
          )}

          {type === "flash" && ev && !ticker && (
            !flash ? (
              <p className="text-zinc-500">กำลังวิเคราะห์เหตุการณ์…</p>
            ) : (
              <>
                <section>
                  <h2>⚡ {flash.headline}</h2>
                  <p style={{ fontSize: 9.5, color: "#71717a", marginTop: 2 }}>
                    เหตุการณ์: &ldquo;{ev}&rdquo; · เครื่องยนต์: {flash.engine === "ai" ? "AI + ฐานความรู้ StockLens" : "คีย์เวิร์ด + ฐานความรู้"} · ออกรายงานภายใน 24 ชม.หลังเหตุการณ์
                  </p>
                </section>
                {flash.narrative && (
                  <section className="rp-callout">
                    <h2 style={{ border: "none", margin: "0 0 4px", padding: 0 }}>🧭 บทวิเคราะห์</h2>
                    <p style={{ lineHeight: 1.7 }}>{flash.narrative}</p>
                  </section>
                )}
                {flash.chains.map((c) => (
                  <section key={c.name} style={{ border: "1px solid #e4e4e7", borderRadius: 6, padding: "8px 12px", marginTop: 8 }}>
                    <h2 style={{ border: "none", margin: 0, padding: 0, fontSize: 13 }}>{c.name}</h2>
                    <p style={{ fontSize: 10, color: "#71717a", margin: "2px 0 8px" }}>{c.reason}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {(["positive", "negative"] as const).map((dir) => {
                        const stocks = c.stocks.filter((s) => s.direction === dir);
                        if (!stocks.length) return null;
                        return (
                          <div key={dir}>
                            <p className={`font-bold ${dir === "positive" ? "text-emerald-700" : "text-rose-700"}`} style={{ fontSize: 11, marginBottom: 4 }}>
                              {dir === "positive" ? "✅ ได้ประโยชน์" : "❌ เสียประโยชน์"}
                            </p>
                            <table>
                              <tbody>
                                {stocks.map((s) => (
                                  <tr key={s.ticker}>
                                    <td className="font-bold" style={{ width: "28%" }}>{s.ticker}</td>
                                    <td style={{ fontSize: 10 }}>{s.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )
          )}

          {isStockReport && (
            !a ? <p className="text-zinc-500">กำลังโหลด {ticker}…</p> : (
              <>
                <section>
                  <h2 style={{ marginBottom: 2 }}>{a.quote.symbol} — {a.quote.name}</h2>
                  <p style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>
                    {a.profile?.sector}{a.profile?.industry ? ` / ${a.profile.industry}` : ""}
                    {a.profile?.marketCap ? ` · มูลค่าตลาด ${(a.profile.marketCap / 1e9).toFixed(1)} พันล้าน ${a.quote.currency === "THB" ? "บาท" : a.quote.currency}` : ""}
                  </p>
                  <p className="rp-quote">
                    <span className="num">{a.quote.price.toFixed(2)}</span> {a.quote.currency}
                    <span className={`num ${a.quote.changePct >= 0 ? "text-emerald-700" : "text-rose-700"}`} style={{ fontSize: 14, marginLeft: 8 }}>
                      {a.quote.changePct >= 0 ? "▲ +" : "▼ "}{a.quote.changePct.toFixed(2)}%
                    </span>
                    {a.usdThb && a.quote.currency === "USD" && (
                      <span className="text-zinc-500" style={{ fontSize: 12, marginLeft: 8 }}>≈ {(a.quote.price * a.usdThb).toFixed(0)} ฿ · ซื้อได้ใน Dime (เศษหุ้นเริ่ม 50฿)</span>
                    )}
                  </p>
                  <PriceSpark candles={candles} currency={a.quote.currency} />
                </section>

                {a.scenarios && (
                  <section>
                    <h2>🎯 สถานการณ์ 12 เดือน (สมมติจากงบจริง)</h2>
                    <table>
                      <thead>
                        <tr><th>สถานการณ์</th><th style={{ textAlign: "right" }}>ราคาเป้าหมาย</th><th style={{ textAlign: "right" }}>Upside</th><th style={{ width: "42%" }}>สมมติฐาน</th></tr>
                      </thead>
                      <tbody>
                        {a.scenarios.scenarios.map((s) => (
                          <tr key={s.name}>
                            <td className="font-semibold">{s.label}</td>
                            <td className="num font-semibold" style={{ textAlign: "right" }}>{s.targetPrice.toFixed(1)}</td>
                            <td className={`num font-semibold ${s.upsidePct >= 0 ? "text-emerald-700" : "text-rose-700"}`} style={{ textAlign: "right" }}>
                              {s.upsidePct >= 0 ? "+" : ""}{s.upsidePct.toFixed(0)}%
                            </td>
                            <td className="text-zinc-600" style={{ fontSize: 10 }}>{s.assumptions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 9.5, color: "#71717a" }}>{a.scenarios.method}</p>
                  </section>
                )}

                {type === "deepdive" && a.profile?.business && (
                  <section>
                    <h2>🏢 ธุรกิจนี้ทำเงินยังไง</h2>
                    <p style={{ textAlign: "justify", lineHeight: 1.7 }}>{a.profile.business}…</p>
                  </section>
                )}

                {a.factors && (
                  <section>
                    <h2>📐 คะแนนปัจจัย 5 มิติ (รวม {a.factors.overall}/100)</h2>
                    <table>
                      <thead>
                        <tr><th>มิติ</th><th style={{ textAlign: "right", width: "20%" }}>คะแนน</th><th style={{ width: "55%" }}>ภาพระดับ</th></tr>
                      </thead>
                      <tbody>
                        {[["Valuation", a.factors.valuation], ["Growth", a.factors.growth], ["Profitability", a.factors.profitability], ["Momentum", a.factors.momentum], ["Financial Health", a.factors.health]].map(([k, v]) => {
                          const score = Number(v);
                          return (
                          <tr key={k as string}>
                            <td>{k}</td>
                            <td className="num font-semibold" style={{ textAlign: "right" }}>{score}/100</td>
                            <td>
                              <div style={{ background: "#ececef", borderRadius: 99, height: 8, width: "100%" }}>
                                <div style={{ background: score >= 60 ? "#047857" : score >= 40 ? "#a16207" : "#be123c", borderRadius: 99, height: 8, width: `${score}%` }} />
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {a.factors.gaps.length > 0 && <p style={{ fontSize: 9.5, color: "#71717a" }}>ข้อมูลขาด: {a.factors.gaps.join(", ")}</p>}
                  </section>
                )}

                {a.technicals && tier === "pro" && (
                  <section>
                    <h2>📈 สัญญาณเทคนิค ({a.technicals.signal === "bullish" ? "เอียงบวก" : a.technicals.signal === "bearish" ? "เอียงลบ" : "เป็นกลาง"})</h2>
                    <ul style={{ margin: "0 0 0 16px", listStyle: "disc" }}>
                      {a.technicals.reasons.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                    </ul>
                  </section>
                )}

                {tier === "starter" && type === "deepdive" && (
                  <section className="rp-lock">
                    🔒 <strong>สัญญาณเทคนิคเต็ม + Deep Dive ฉบับเต็ม สงวนไว้สำหรับสมาชิก Pro</strong><br />
                    อัปเกรดเพื่อดู RSI/MACD/SMA · 3 สถานการณ์พร้อมสมมติฐานเต็ม · บทวิเคราะห์ AI ทุกมุมมอง
                  </section>
                )}

                <section>
                  <h2>🤖 บทวิเคราะห์{persona === "geo" ? "เชิงภูมิรัฐศาสตร์" : ""}</h2>
                  {aiText ? (
                    <div className="ai-report" style={{ textAlign: "justify" }} dangerouslySetInnerHTML={{ __html: mdToHtml(aiText) }} />
                  ) : (
                    <p className="text-zinc-500">กำลังประกอบบทวิเคราะห์…</p>
                  )}
                </section>
              </>
            )
          )}

          {/* ท้ายกระดาษ */}
          <div className="rp-footer">
            <span>🔬 StockLens — {title} · {tier === "pro" ? "Pro" : "Starter"} · {refNo}</span>
            <span>⚠️ บทวิเคราะห์เชิงข้อมูล ไม่ใช่คำแนะนำการลงทุน · ข้อมูล Yahoo Finance (delay ~15 นาที)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
