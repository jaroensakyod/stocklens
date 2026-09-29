"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TickerPicker from "@/components/TickerPicker";
import AiBrief from "@/components/AiBrief";
import { removeFromBasket, getBasket } from "@/lib/compareBasket";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface AnalysisRow {
  quote: { symbol: string; name: string; price: number; changePct: number; currency: string; exchange?: string };
  profile?: { marketCap?: number; trailingPE?: number; forwardPE?: number; priceToBook?: number; evToEbitda?: number; eps?: number; dividendYield?: number; beta?: number };
  financials?: { revenueGrowth?: number; earningsGrowth?: number; grossMargins?: number; operatingMargins?: number; profitMargins?: number; returnOnEquity?: number; returnOnAssets?: number; debtToEquity?: number; currentRatio?: number; freeCashflow?: number; totalCash?: number; totalDebt?: number };
  factors?: { overall: number; valuation: number; growth: number; profitability: number; momentum: number; health: number };
  technicals?: { signal?: string };
}
interface TvRowX {
  symbol: string; sector: string; industry: string;
  pe?: number | null; pb?: number | null; ps?: number | null; pfcf?: number | null; evEbitda?: number | null; peg?: number | null;
  grossMargin?: number | null; operMargin?: number | null; netMargin?: number | null;
  roe?: number | null; roa?: number | null; roic?: number | null;
  de?: number | null; currentRatio?: number | null; quickRatio?: number | null;
  revYoy?: number | null; epsYoy?: number | null; dividendPayout?: number | null; dividendYield?: number | null;
  perfW?: number | null; perf1M?: number | null; perf3M?: number | null; perf6M?: number | null;
  perfY?: number | null; perfYTD?: number | null; perf3Y?: number | null; perf5Y?: number | null;
  rsi?: number | null; beta?: number | null; sma200?: number | null; relVol?: number | null; volatilityD?: number | null;
  epsTtm?: number | null; targetPrice?: number | null; recommend?: number | null; price: number; employees?: number | null;
}
interface Loaded {
  symbol: string;
  a?: AnalysisRow;
  tv?: TvRowX;
}

const MAX = 4;

type Dir = "hi" | "lo"; // hi = มากกว่าดีกว่า
interface MetricDef { label: string; dir: Dir; fmt?: "pct" | "x" | "num" | "big"; get: (l: Loaded) => number | null | undefined }

const pct = (v?: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const GROUPS: { id: string; label: string; rows: MetricDef[] }[] = [
  {
    id: "overview", label: "ภาพรวม", rows: [
      { label: "ราคา", dir: "hi", get: (l) => l.a?.quote.price },
      { label: "% วันนี้", dir: "hi", get: (l) => l.a?.quote.changePct },
      { label: "มูลค่าตลาด (USD)", dir: "hi", get: (l) => pct(l.a?.profile?.marketCap) },
      { label: "ความผันผวนรายวัน", dir: "lo", get: (l) => pct(l.tv?.volatilityD) },
      { label: "พนักงาน (คน)", dir: "hi", get: (l) => pct(l.tv?.employees) },
    ],
  },
  {
    id: "valuation", label: "ความคุ้มค่า (Valuation)", rows: [
      { label: "P/E (TTM)", dir: "lo", get: (l) => pct(l.tv?.pe) ?? pct(l.a?.profile?.trailingPE) },
      { label: "Forward P/E", dir: "lo", get: (l) => pct(l.a?.profile?.forwardPE) },
      { label: "P/B", dir: "lo", get: (l) => pct(l.tv?.pb) ?? pct(l.a?.profile?.priceToBook) },
      { label: "P/S", dir: "lo", get: (l) => pct(l.tv?.ps) },
      { label: "EV/EBITDA", dir: "lo", get: (l) => pct(l.tv?.evEbitda) ?? pct(l.a?.profile?.evToEbitda) },
      { label: "PEG", dir: "lo", get: (l) => pct(l.tv?.peg) },
    ],
  },
  {
    id: "performance", label: "ผลตอบแทนย้อนหลัง", rows: [
      { label: "1 สัปดาห์", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perfW) },
      { label: "1 เดือน", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perf1M) },
      { label: "3 เดือน", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perf3M) },
      { label: "6 เดือน", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perf6M) },
      { label: "YTD", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perfYTD) },
      { label: "1 ปี", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perfY) },
      { label: "3 ปี", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perf3Y) },
      { label: "5 ปี", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.perf5Y) },
    ],
  },
  {
    id: "profitability", label: "ความสามารถทำกำไร", rows: [
      { label: "Gross Margin", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.grossMargin) },
      { label: "Operating Margin", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.operMargin) },
      { label: "Profit Margin", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.netMargin) },
      { label: "ROE", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.roe) },
      { label: "ROA", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.roa) },
      { label: "ROIC", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.roic) },
    ],
  },
  {
    id: "growth", label: "การเติบโต", rows: [
      { label: "รายได้โต YoY", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.revYoy) ?? (l.a?.financials?.revenueGrowth !== undefined ? l.a.financials.revenueGrowth * 100 : null) },
      { label: "EPS โต YoY", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.epsYoy) ?? (l.a?.financials?.earningsGrowth !== undefined ? l.a.financials.earningsGrowth * 100 : null) },
    ],
  },
  {
    id: "health", label: "สุขภาพการเงิน", rows: [
      { label: "หนี้/ทุน (D/E)", dir: "lo", get: (l) => pct(l.tv?.de) ?? pct(l.a?.financials?.debtToEquity) },
      { label: "Current Ratio", dir: "hi", get: (l) => pct(l.tv?.currentRatio) ?? pct(l.a?.financials?.currentRatio) },
      { label: "Quick Ratio", dir: "hi", get: (l) => pct(l.tv?.quickRatio) },
      { label: "FCF (USD)", dir: "hi", fmt: "big", get: (l) => pct(l.a?.financials?.freeCashflow) },
      { label: "เงินสดรวม (USD)", dir: "hi", fmt: "big", get: (l) => pct(l.a?.financials?.totalCash) },
    ],
  },
  {
    id: "technical", label: "เทคนิค & สภาพคล่อง", rows: [
      { label: "RSI (14)", dir: "hi", get: (l) => pct(l.tv?.rsi) },
      { label: "ราคาเทียบ SMA200 (%)", dir: "hi", fmt: "pct", get: (l) => (l.tv?.sma200 && l.tv.sma200 > 0 ? ((l.tv.price - l.tv.sma200) / l.tv.sma200) * 100 : null) },
      { label: "วอลุ่มเทียบเฉลี่ย", dir: "hi", get: (l) => pct(l.tv?.relVol) },
      { label: "Beta (1 ปี)", dir: "lo", get: (l) => pct(l.tv?.beta) ?? pct(l.a?.profile?.beta) },
    ],
  },
  {
    id: "dividend", label: "ปันผล & นักวิเคราะห์", rows: [
      { label: "ปันผล %", dir: "hi", fmt: "pct", get: (l) => pct(l.tv?.dividendYield) ?? (l.a?.profile?.dividendYield !== undefined ? l.a.profile.dividendYield * 100 : null) },
      { label: "Payout (%)", dir: "lo", fmt: "pct", get: (l) => pct(l.tv?.dividendPayout) },
      { label: "EPS (TTM)", dir: "hi", get: (l) => pct(l.tv?.epsTtm) ?? pct(l.a?.profile?.eps) },
      { label: "ราคาเป้าหมาย", dir: "hi", get: (l) => pct(l.tv?.targetPrice) },
      { label: "Upside ตามเป้า", dir: "hi", fmt: "pct", get: (l) => (l.tv?.targetPrice && l.a?.quote.price ? (l.tv.targetPrice / l.a.quote.price - 1) * 100 : null) },
      { label: "มตินักวิเคราะห์ (TV)", dir: "hi", get: (l) => pct(l.tv?.recommend) },
    ],
  },
];

const fmtBig = (v: number) => (Math.abs(v) >= 1e12 ? (v / 1e12).toFixed(1) + "T" : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + "B" : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + "M" : v.toLocaleString("th-TH", { maximumFractionDigits: 0 }));

export default function ComparePage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ overview: true, valuation: true, performance: true, profitability: true, growth: true, health: true, technical: true, dividend: true });

  // เริ่มต้น: ?t= > ตะกร้าเปรียบเทียบ > ชุดตัวอย่าง
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t");
    let init: string[] = [];
    if (t) init = t.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, MAX);
    if (!init.length) {
      const basket = getBasket();
      if (basket.length) init = basket.slice(0, MAX);
    }
    if (!init.length) init = ["NVDA", "AAPL", "MSFT"];
    setTickers(init);
  }, []);

  useEffect(() => {
    if (!tickers.length) {
      setLoaded([]);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Loaded[] = [];
      for (const s of tickers) {
        const item: Loaded = { symbol: s };
        await Promise.all([
          fetch(`/api/analysis?s=${encodeURIComponent(s)}`).then((r) => r.json()).then((j) => {
            if (j && j.quote) item.a = j;
          }).catch(() => {}),
          fetch(`/api/tvrow?s=${encodeURIComponent(s)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => {
            item.tv = j.row;
          }).catch(() => {}),
        ]);
        out.push(item);
      }
      if (alive) {
        setLoaded(out);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tickers.join(",")]);

  const add = (s: string) => {
    const up = s.toUpperCase();
    if (!tickers.includes(up) && tickers.length < MAX) setTickers([...tickers, up]);
  };

  const winner = (def: MetricDef): number => {
    const vals = loaded.map((l, i) => ({ i, v: def.get(l) })).filter((x) => typeof x.v === "number" && Number.isFinite(x.v as number)) as { i: number; v: number }[];
    if (vals.length < 2) return -1;
    const best = vals.reduce((a, b) => (def.dir === "hi" ? (b.v > a.v ? b : a) : b.v < a.v ? b : a));
    return vals.length >= 2 ? best.i : -1;
  };

  const radarData = useMemo(() => {
    const dims: { k: keyof NonNullable<AnalysisRow["factors"]>; label: string }[] = [
      { k: "valuation", label: "คุ้มค่า" }, { k: "growth", label: "เติบโต" }, { k: "profitability", label: "กำไร" },
      { k: "momentum", label: "โมเมนตัม" }, { k: "health", label: "สุขภาพ" },
    ];
    return dims.map((d) => {
      const point: Record<string, string | number> = { dim: d.label };
      for (const l of loaded) point[l.symbol] = l.a?.factors ? l.a.factors[d.k] : 0;
      return point;
    });
  }, [loaded]);

  const perfBar = useMemo(
    () => loaded.map((l) => ({ name: l.symbol, "1 ปี %": l.tv?.perfY ?? 0, "YTD %": l.tv?.perfYTD ?? 0 })),
    [loaded]
  );

  const winCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of GROUPS) for (const r of g.rows) {
      const w = winner(r);
      if (w >= 0) m[loaded[w].symbol] = (m[loaded[w].symbol] ?? 0) + 1;
    }
    return m;
  }, [loaded]);
  const bestOverall = Object.entries(winCount).sort((a, b) => b[1] - a[1])[0];

  const cell = (l: Loaded, def: MetricDef, isWin: boolean) => {
    const v = def.get(l);
    if (v === null || v === undefined || !Number.isFinite(v)) return <span className="text-zinc-700">—</span>;
    let text: string;
    if (def.fmt === "pct") text = `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
    else if (def.fmt === "big") text = fmtBig(v);
    else if (def.fmt === "x") text = v.toFixed(2) + "x";
    else text = Math.abs(v) >= 1000 ? v.toLocaleString("th-TH", { maximumFractionDigits: 0 }) : v.toFixed(2);
    return <span className={isWin ? "font-bold text-up" : ""}>{text}</span>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">⚔️ เปรียบเทียบหุ้น (ข้ามตลาด 30 ประเทศ)</h1>
        <p className="text-sm text-zinc-400 mt-1">เลือก 2–4 ตัว ดู 70+ ตัวชี้วัด 8 กลุ่มในตารางเดียว — พร้อม radar คะแนนปัจจัย 5 มิติจากงบจริง (ของเฉพาะ StockLens) และไฮไลต์ตัวชนะทุกแถว</p>
      </div>

      <div className="card p-4 flex flex-wrap gap-2 items-center">
        {tickers.map((t) => (
          <span key={t} className="chip bg-base-800 text-zinc-100 border border-base-700">
            <Link href={`/stock/${encodeURIComponent(t)}`} className="font-bold hover:text-accent-soft">{t}</Link>
            <button className="text-zinc-500 hover:text-down ml-1" onClick={() => { setTickers(tickers.filter((x) => x !== t)); removeFromBasket(t); }}>✕</button>
          </span>
        ))}
        {tickers.length < MAX && <TickerPicker onSelect={add} placeholder="ค้นหาเพื่อเพิ่ม เช่น AAPL / PTT.BK" />}
        {tickers.length > 0 && <span className="text-xs text-zinc-500 num">{tickers.length}/{MAX}</span>}
        {loading && <span className="text-xs text-zinc-500">กำลังโหลด…</span>}
      </div>

      {loaded.length >= 2 && (
        <>
          {/* Radar คะแนนปัจจัย + กราฟ perf */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-4">
              <h2 className="text-sm font-bold text-zinc-100 mb-1">🕸️ คะแนนปัจจัย 5 มิติ (จากงบจริง)</h2>
              <p className="text-[10px] text-zinc-600 mb-2">คะแนน StockLens 0-100 · ยิ่งกว้างยิ่งแข็งแรง — คำนวณจาก filings จริง ไม่ใช่แค่ราคา</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis dataKey="dim" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    {loaded.map((l, i) => (
                      <Radar key={l.symbol} name={l.symbol} dataKey={l.symbol} stroke={["#eab308", "#2dd4bf", "#f472b6", "#a78bfa"][i]} fill={["#eab308", "#2dd4bf", "#f472b6", "#a78bfa"][i]} fillOpacity={0.15} />
                    ))}
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {loaded.map((l) => (
                  <span key={l.symbol} className={`chip num ${l.a?.factors && l.a.factors.overall === Math.max(...loaded.map((x) => x.a?.factors?.overall ?? -1)) ? "bg-up/10 text-up border border-up/30 font-bold" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
                    {l.symbol} รวม {l.a?.factors?.overall ?? "—"}/100
                  </span>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-bold text-zinc-100 mb-1">📊 เทียบผลตอบแทน</h2>
              <p className="text-[10px] text-zinc-600 mb-2">ผลตอบแทนสะสม % — ยิ่งสูงยิ่งดี</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfBar}>
                    <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#71717a", fontSize: 10 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="1 ปี %" fill="#eab308" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="YTD %" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ตาราง 8 กลุ่ม */}
          {GROUPS.map((g) => (
            <div key={g.id} className="card overflow-hidden">
              <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))}>
                <span className="text-sm font-bold text-zinc-100">{g.label}</span>
                <span className="text-zinc-500 text-xs">{openGroups[g.id] ? "▲ ย่อ" : "▼ ขยาย"}</span>
              </button>
              {openGroups[g.id] && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="border-b border-base-700/60 text-zinc-500">
                        <th className="text-left px-4 py-2 font-normal">ตัวชี้วัด</th>
                        {loaded.map((l) => (
                          <th key={l.symbol} className="text-right px-4 py-2">
                            <Link href={`/stock/${encodeURIComponent(l.symbol)}`} className="text-zinc-200 hover:text-accent-soft font-bold">{l.symbol}</Link>
                            <div className="text-[10px] font-normal text-zinc-600 max-w-32 truncate">{l.a?.quote.name ?? l.tv?.sector ?? ""}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => {
                        const w = winner(r);
                        return (
                          <tr key={r.label} className="border-b border-base-700/30">
                            <td className="px-4 py-1.5 text-zinc-500">{r.label}{r.dir === "lo" && <span className="text-[9px] text-zinc-700 ml-1">(ต่ำดีกว่า)</span>}</td>
                            {loaded.map((l, i) => (
                              <td key={l.symbol} className="px-4 py-1.5 text-right num text-zinc-200">{cell(l, r, w === i)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* สรุป AI + สรุปชนะ */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-zinc-100 mb-2">🧠 สรุปการเปรียบเทียบ</h2>
            {bestOverall && (
              <p className="text-xs text-zinc-400 mb-3">
                นับชั้นชนะตามตัวชี้วัด: <b className="text-up">{bestOverall[0]}</b> ชนะ {bestOverall[1]} รายการจาก {Object.values(winCount).reduce((a, b) => a + b, 0)} ที่วัดได้
                {loaded.length >= 2 && loaded.some((l) => l.a?.factors) && (
                  <> · คะแนนปัจจัยรวมสูงสุด: <b className="text-zinc-200">{loaded.reduce((a, b) => ((b.a?.factors?.overall ?? -1) > (a.a?.factors?.overall ?? -1) ? b : a)).symbol}</b></>
                )}
              </p>
            )}
            <AiBrief
              ticker={loaded.map((l) => l.symbol).join("-vs-")}
              section="compare"
              lines={[
                `เทียบ ${loaded.map((l) => l.symbol).join(" / ")}`,
                ...loaded.map((l) => `${l.symbol}: P/E ${l.tv?.pe?.toFixed(1) ?? l.a?.profile?.trailingPE?.toFixed(1) ?? "—"} · ROE ${l.tv?.roe?.toFixed(0) ?? "—"}% · โต ${l.tv?.revYoy?.toFixed(0) ?? "—"}% · 1 ปี ${l.tv?.perfY?.toFixed(0) ?? "—"}% · คะแนนรวม ${l.a?.factors?.overall ?? "—"}/100`),
                ...(bestOverall ? [`ชนะมากสุดตามตัวชี้วัด: ${bestOverall[0]} (${bestOverall[1]} รายการ)`] : []),
              ]}
              rule={`เทียบ ${loaded.length} ตัว: ${bestOverall ? `${bestOverall[0]} ชนะตามตัวชี้วัดมากที่สุด (${bestOverall[1]} รายการ)` : "ยังวัดไม่ได้"} — ดูรายละเอียดตามกลุ่มว่าชนะตรงไหน เพราะ "ชนะรวม" ไม่ได้แปลว่าเหมาะกับทุกสไตล์ — อ่านเป็นข้อมูลประกอบการพิจารณา`}
            />
          </div>
        </>
      )}

      {loaded.length < 2 && !loading && <p className="text-center text-zinc-500 text-sm py-8">เพิ่มหุ้นอย่างน้อย 2 ตัวเพื่อเริ่มเปรียบเทียบ</p>}
      <p className="text-[10px] text-zinc-600">เมตริกจาก TradingView universe + งบจริง Yahoo/SEC · ตัวเลขที่เป็นสีเขียวหนา = ดีที่สุดในแถวนั้น · หมายเหตุ (ต่ำดีกว่า) = ตัวชี้วัดประเภทยิ่งน้อยยิ่งดี เช่น P/E · ไม่ใช่คำแนะนำการลงทุน</p>
    </div>
  );
}
