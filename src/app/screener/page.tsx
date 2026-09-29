"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";
import StarButton from "@/components/StarButton";
import presetsJson from "@/data/screener-presets.json";
import { SCREENER_THEMES } from "@/lib/screenerThemes";
import { addToBasket } from "@/lib/compareBasket";

interface Row {
  symbol: string; name: string; price: number; changePct: number; mcap: number;
  sector: string; industry: string; exchange: string; ipoDate: string | null;
  premarketPct: number | null; divYield: number | null; country: string;
  pe?: number | null; pb?: number | null; ps?: number | null; peg?: number | null; evEbitda?: number | null;
  grossMargin?: number | null; operMargin?: number | null; netMargin?: number | null;
  roe?: number | null; roa?: number | null; roic?: number | null;
  de?: number | null; currentRatio?: number | null; quickRatio?: number | null;
  revYoy?: number | null; epsYoy?: number | null; dividendPayout?: number | null;
  perf3M?: number | null; perfY?: number | null; perfYTD?: number | null; perf5Y?: number | null;
  rsi?: number | null; beta?: number | null; sma200?: number | null; relVol?: number | null;
  targetPrice?: number | null;
}
interface Data {
  region: string; total: number; filtered: number; ipoCount: number;
  sectors: string[]; industries: string[]; rows: Row[];
}
/** Radar 1 ชุด = เงื่อนไขครบชุด (บันทึกใน localStorage + แชร์เป็น URL ได้) */
interface Radar {
  name: string;
  region: string; sector: string; industry: string; q: string;
  ipoOnly: boolean; pmOnly: boolean;
  mcapMin: string; chgMin: string; chgMax: string; divMin: string; sort: string;
}
interface Preset {
  id: string; emoji: string; name: string; desc: string;
  mcapMin?: number; mcapMax?: number;
  conds: { f: string; op: "min" | "max"; v: number }[];
}

const PRESETS = (presetsJson as { presets: Preset[] }).presets;
const PAGE_SIZE = 50;

const REGIONS = [
  { id: "america", label: "🇺🇸 สหรัฐฯ" },
  { id: "thailand", label: "🇹🇭 ไทย" },
  { id: "vietnam", label: "🇻🇳 เวียดนาม" },
  { id: "indonesia", label: "🇮🇩 อินโด" },
  { id: "singapore", label: "🇸🇬 สิงคโปร์" },
  { id: "malaysia", label: "🇲🇾 มาเลย์" },
  { id: "philippines", label: "🇵🇭 ฟิลิปปินส์" },
  { id: "hongkong", label: "🇭🇰 ฮ่องกง" },
  { id: "china", label: "🇨🇳 จีน" },
  { id: "taiwan", label: "🇹🇼 ไต้หวัน" },
  { id: "japan", label: "🇯🇵 ญี่ปุ่น" },
  { id: "korea", label: "🇰🇷 เกาหลี" },
  { id: "india", label: "🇮🇳 อินเดีย" },
  { id: "australia", label: "🇦🇺 ออสฯ" },
  { id: "canada", label: "🇨🇦 แคนาดา" },
  { id: "uk", label: "🇬🇧 อังกฤษ" },
  { id: "germany", label: "🇩🇪 เยอรมัน" },
  { id: "france", label: "🇫🇷 ฝรั่งเศส" },
  { id: "switzerland", label: "🇨🇭 สวิส" },
  { id: "netherlands", label: "🇳🇱 เนเธอร์แลนด์" },
  { id: "sweden", label: "🇸🇪 สวีเดน" },
  { id: "italy", label: "🇮🇹 อิตาลี" },
  { id: "spain", label: "🇪🇸 สเปน" },
  { id: "turkey", label: "🇹🇷 ตุรกี" },
  { id: "israel", label: "🇮🇱 อิสราเอล" },
  { id: "uae", label: "🇦🇪 UAE" },
  { id: "saudiarabia", label: "🇸🇦 ซาอุฯ" },
  { id: "southafrica", label: "🇿🇦 แอฟริกาใต้" },
  { id: "brazil", label: "🇧🇷 บราซิล" },
  { id: "mexico", label: "🇲🇽 เม็กซิโก" },
];

const SUFFIX: Record<string, string> = {
  america: "", thailand: ".BK", vietnam: ".HM", indonesia: ".JK", singapore: ".SI", malaysia: ".KL",
  philippines: ".PS", hongkong: ".HK", taiwan: ".TW", japan: ".T", korea: ".KS", india: ".NS",
  australia: ".AX", newzealand: ".NZ", canada: ".TO", uk: ".L", germany: ".DE", france: ".PA",
  netherlands: ".AS", switzerland: ".SW", sweden: ".ST", italy: ".MI", spain: ".MC", turkey: ".IS",
  israel: ".TA", uae: ".AD", saudiarabia: ".SR", southafrica: ".JO", brazil: ".SA", mexico: ".MX",
};
const ysym = (region: string, s: string) => {
  if (region === "china") return /^6/.test(s) ? s + ".SS" : /^[03]/.test(s) ? s + ".SZ" : s + ".SS";
  return s + (SUFFIX[region] ?? "");
};

const DEFAULT: Radar = {
  name: "", region: "thailand", sector: "", industry: "", q: "",
  ipoOnly: false, pmOnly: false, mcapMin: "", chgMin: "", chgMax: "", divMin: "", sort: "mcap",
};
const LS_KEY = "sl-radars";

/** ค่าที่คำนวณเพิ่มสำหรับ preset (% upside จากราคาเป้าหมาย · ราคาเทียบ SMA200) */
const derived = (r: Row): Row & { upside?: number | null; priceVsSma200?: number | null } => ({
  ...r,
  upside: r.targetPrice && r.price > 0 ? (r.targetPrice / r.price - 1) * 100 : null,
  priceVsSma200: r.sma200 && r.sma200 > 0 ? ((r.price - r.sma200) / r.sma200) * 100 : null,
});

export default function ScreenerPage() {
  const [f, setF] = useState<Radar>(DEFAULT);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [radars, setRadars] = useState<Radar[]>([]);
  const [savedFlash, setSavedFlash] = useState("");
  const [presetId, setPresetId] = useState("");
  const [themeId, setThemeId] = useState("");
  const [themeHeat, setThemeHeat] = useState<Record<string, number>>({});
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState("");

  // โหลด Radar จาก URL (?r= หรือ ?p=preset / ?t=theme / ?sector=) หรือ localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
      if (Array.isArray(saved)) setRadars(saved.filter((r: Radar) => r && r.name));
    } catch { /* เริ่มต้นสะอาด */ }
    const sp = new URLSearchParams(location.search);
    const r = sp.get("r");
    if (r) {
      try {
        const parsed = JSON.parse(atob(r));
        setF({ ...DEFAULT, ...parsed, name: "" });
      } catch { /* URL เสีย = ใช้ default */ }
    }
    const p = sp.get("p");
    if (p && PRESETS.some((x) => x.id === p)) setPresetId(p);
    const t = sp.get("t");
    if (t && SCREENER_THEMES.some((x) => x.id === t)) setThemeId(t);
    const sector = sp.get("sector");
    if (sector) setF((prev) => ({ ...prev, sector }));
    const q = sp.get("q");
    if (q) setF((prev) => ({ ...prev, q }));
    // ความร้อนธีม (เรียงปุ่มธีมตาม heat จริงของวัน)
    fetch("/api/radar").then((r2) => r2.json()).then((j) => {
      const m: Record<string, number> = {};
      for (const th of j.themes ?? []) if (typeof th.heat === "number") m[th.id] = th.heat;
      setThemeHeat(m);
    }).catch(() => {});
  }, []);

  const set = <K extends keyof Radar>(k: K, v: Radar[K]) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ region: f.region, limit: "1000" });
      if (f.sector) params.set("sector", f.sector);
      if (f.industry) params.set("industry", f.industry);
      if (f.ipoOnly) params.set("ipo", "1");
      if (f.pmOnly) params.set("pm", "1");
      if (f.q) params.set("q", f.q);
      const res = await fetch("/api/universe?" + params);
      const j = await res.json();
      if (!res.ok) setErr(j.error || "โหลดไม่สำเร็จ");
      else setData(j);
    } catch {
      setErr("โหลดไม่สำเร็จ");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.region, f.sector, f.industry, f.ipoOnly, f.pmOnly, f.q]);

  useEffect(() => {
    const id = setTimeout(load, 400);
    return () => clearTimeout(id);
  }, [load]);

  // ตัวกรองตัวเลข + preset + ธีม + เรียง ทำฝั่ง client (เร็ว ไม่ต้องยิง API ใหม่)
  const rows = useMemo(() => {
    let out = (data?.rows ?? []).map(derived);
    // preset กลยุทธ์
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const mcMin = preset.mcapMin ?? 0;
      const mcMax = preset.mcapMax ?? Infinity;
      out = out.filter((r) => {
        if (r.mcap < mcMin || r.mcap > mcMax) return false;
        for (const c of preset.conds) {
          const v = (r as unknown as Record<string, number | null | undefined>)[c.f];
          if (typeof v !== "number" || !Number.isFinite(v)) return false;
          if (c.op === "min" && v < c.v) return false;
          if (c.op === "max" && v > c.v) return false;
        }
        return true;
      });
    }
    // ธีม (จาก impact-map: หุ้นในธีม → match กับ universe ของ region นี้)
    if (themeId) {
      const th = SCREENER_THEMES.find((t) => t.id === themeId);
      if (th) out = out.filter((r) => th.bases.has(r.symbol.toUpperCase()));
    }
    // ตัวกรองพื้นฐาน
    const mc = Number(f.mcapMin) || 0;
    if (mc) out = out.filter((r) => r.mcap >= mc);
    const cmin = f.chgMin !== "" ? Number(f.chgMin) : -Infinity;
    const cmax = f.chgMax !== "" ? Number(f.chgMax) : Infinity;
    out = out.filter((r) => r.changePct >= cmin && r.changePct <= cmax);
    const dv = Number(f.divMin) || 0;
    if (dv) out = out.filter((r) => (r.divYield ?? 0) >= dv);
    // เรียง
    if (f.sort === "chg-desc") out.sort((a, b) => b.changePct - a.changePct);
    else if (f.sort === "chg-asc") out.sort((a, b) => a.changePct - b.changePct);
    else if (f.sort === "div") out.sort((a, b) => (b.divYield ?? 0) - (a.divYield ?? 0));
    else if (f.sort === "pe-asc") out.sort((a, b) => (a.pe ?? Infinity) - (b.pe ?? Infinity));
    else if (f.sort === "upside") out.sort((a, b) => (b.upside ?? -Infinity) - (a.upside ?? -Infinity));
    else out.sort((a, b) => b.mcap - a.mcap);
    return out;
  }, [data, presetId, themeId, f.mcapMin, f.chgMin, f.chgMax, f.divMin, f.sort]);

  useEffect(() => setPage(1), [presetId, themeId, f.region, f.sector, f.industry, f.q, f.sort, f.mcapMin, f.divMin]);

  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const saveRadar = () => {
    const name = (f.name || "").trim() || `Radar ${radars.length + 1}`;
    const next = [...radars.filter((r) => r.name !== name), { ...f, name }];
    setRadars(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setF((p) => ({ ...p, name }));
    setSavedFlash(name);
    setTimeout(() => setSavedFlash(""), 2000);
  };
  const applyRadar = (r: Radar) => { setPresetId(""); setThemeId(""); setF({ ...r }); };
  const delRadar = (name: string) => {
    const next = radars.filter((r) => r.name !== name);
    setRadars(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };
  const shareRadar = () => {
    const url = `${location.origin}/screener?r=${btoa(JSON.stringify({ ...f, name: "" }))}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setSavedFlash("คัดลอกลิงก์แชร์แล้ว");
    setTimeout(() => setSavedFlash(""), 2000);
  };

  const fmtMcap = (v: number) => (v >= 1e12 ? (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(0) + "M" : "-");

  const compare = (ys: string) => {
    const res = addToBasket(ys);
    setFlash(res === "added" ? `เพิ่ม ${ys} เข้าตะกร้าเทียบแล้ว` : res === "exists" ? `${ys} อยู่ในตะกร้าแล้ว` : "ตะกร้าเต็ม (4 ตัว) — ไปที่หน้าเปรียบเทียบก่อน");
    setTimeout(() => setFlash(""), 2200);
  };

  const activePreset = PRESETS.find((p) => p.id === presetId);
  const activeTheme = SCREENER_THEMES.find((t) => t.id === themeId);
  const themesSorted = useMemo(() => {
    const withHeat = SCREENER_THEMES.map((t) => ({ ...t, heat: themeHeat[t.id] ?? null }));
    return withHeat.sort((a, b) => (b.heat ?? -1) - (a.heat ?? -1));
  }, [themeHeat]);
  const themesShown = showAllThemes ? themesSorted : themesSorted.slice(0, 12);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">📡 Radars Builder — สร้างเรดาร์หุ้นของคุณเอง</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {data ? `${data.total.toLocaleString()} หุ้นในตลาดนี้ · ${data.sectors.length} หมวด · ${data.industries.length} อุตสาหกรรม — กด preset กลยุทธ์/ธีมได้ทันที หรือจับคู่เงื่อนไขเอง บันทึกเป็น Radar แชร์ต่อได้` : "กำลังโหลด universe ทั้งตลาดจาก TradingView…"}
        </p>
      </div>

      {/* Radar ที่บันทึกไว้ */}
      {!!radars.length && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-zinc-500">Radar ของฉัน:</span>
          {radars.map((r) => (
            <span key={r.name} className="chip bg-accent/10 text-accent-soft border border-accent/30 flex items-center gap-1.5">
              <button onClick={() => applyRadar(r)} className="hover:underline">{r.name}</button>
              <button onClick={() => delRadar(r.name)} className="text-zinc-600 hover:text-down" title="ลบ">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Preset กลยุทธ์ — กดแล้วกรองทันที */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <h2 className="text-sm font-bold text-zinc-100">⚡ ตัวกรองด่วน — กลยุทธ์สำเร็จรูป {PRESETS.length} แบบ</h2>
          {presetId && (
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline" onClick={() => setPresetId("")}>ล้าง preset</button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              title={p.desc}
              onClick={() => setPresetId(presetId === p.id ? "" : p.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${presetId === p.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
        {activePreset && (
          <p className="text-[11px] text-zinc-500 mt-2">{activePreset.emoji} {activePreset.desc} — เมตริกครบสุดในตลาด 🇺🇸/🇹🇭 ตลาดอื่นอาจได้ผลน้อยกว่า</p>
        )}
      </div>

      {/* ธีมลงทุน — เชื่อมกับความร้อนธีมจริงของ Global Radar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <h2 className="text-sm font-bold text-zinc-100">🔥 ธีม & กลุ่มธุรกิจ (เรียงตามความร้อนธีมวันนี้)</h2>
          <div className="flex gap-2 items-center">
            {themeId && <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline" onClick={() => setThemeId("")}>ล้างธีม</button>}
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline" onClick={() => setShowAllThemes(!showAllThemes)}>{showAllThemes ? "ย่อธีม" : `ดูทั้งหมด ${SCREENER_THEMES.length} ธีม`}</button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {themesShown.map((t) => (
            <button
              key={t.id}
              title={`${t.desc} · ${t.tickers.length} หุ้น (จาก Global Radar)`}
              onClick={() => setThemeId(themeId === t.id ? "" : t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${themeId === t.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
            >
              {t.emoji} {t.name}
              {t.heat !== null && t.heat >= 50 && <span className={`num text-[9px] px-1 rounded ${t.heat >= 70 ? "bg-down/20 text-down" : "bg-accent/20 text-accent-soft"}`}>{t.heat}°</span>}
            </button>
          ))}
        </div>
        {activeTheme && (
          <p className="text-[11px] text-zinc-500 mt-2">{activeTheme.emoji} {activeTheme.desc} — {activeTheme.tickers.length} หุ้นที่เชื่อมกับธีมนี้ใน Global Radar (ดูห่วงโซ่เต็มที่ <Link href="/radar" className="text-accent-soft hover:underline">Global Radar</Link>)</p>
        )}
      </div>

      {/* ตลาด */}
      <div className="flex gap-1 flex-wrap">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => { set("region", r.id); set("sector", ""); set("industry", ""); }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${f.region === r.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ตัวกรอง — Radars Builder */}
      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-zinc-500">หมวดหมู่ (Sector)</label>
            <select className="input mt-1" value={f.sector} onChange={(e) => { set("sector", e.target.value); set("industry", ""); }}>
              <option value="">ทั้งหมด</option>
              {(data?.sectors ?? []).map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">อุตสาหกรรมย่อย (Industry)</label>
            <select className="input mt-1" value={f.industry} onChange={(e) => set("industry", e.target.value)} disabled={!f.sector}>
              <option value="">{f.sector ? "ทั้งหมดในหมวดนี้" : "เลือกหมวดก่อน"}</option>
              {(data?.industries ?? []).map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">มูลค่าตลาด ≥</label>
            <select className="input mt-1" value={f.mcapMin} onChange={(e) => set("mcapMin", e.target.value)}>
              <option value="">ทุกขนาด</option>
              <option value="100000000">≥ 100M</option>
              <option value="2000000000">≥ 2B (ใหญ่พอจริงจัง)</option>
              <option value="10000000000">≥ 10B (จริงจัง)</option>
              <option value="100000000000">≥ 100B (ยักษ์)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">ปันผล ≥</label>
            <select className="input mt-1" value={f.divMin} onChange={(e) => set("divMin", e.target.value)}>
              <option value="">ไม่สน</option>
              <option value="2">≥ 2%</option>
              <option value="4">≥ 4%</option>
              <option value="6">≥ 6% (หุ้นปันผลจัด)</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-zinc-500">ค้นหา</label>
            <input className="input mt-1" placeholder="ชื่อ/รหัส" value={f.q} onChange={(e) => set("q", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">% เปลี่ยนวันนี้ ช่วง</label>
            <div className="flex gap-1 mt-1">
              <input className="input num" type="number" placeholder="ต่ำสุด" value={f.chgMin} onChange={(e) => set("chgMin", e.target.value)} />
              <input className="input num" type="number" placeholder="สูงสุด" value={f.chgMax} onChange={(e) => set("chgMax", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">เรียงตาม</label>
            <select className="input mt-1" value={f.sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="mcap">มูลค่าตลาด (มาก→น้อย)</option>
              <option value="chg-desc">ขึ้นแรงสุดก่อน</option>
              <option value="chg-asc">ลงแรงสุดก่อน</option>
              <option value="div">ปันผลสูงสุดก่อน</option>
              <option value="pe-asc">P/E ถูกสุดก่อน</option>
              <option value="upside">Upside ตามนักวิเคราะห์</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={f.ipoOnly} onChange={(e) => set("ipoOnly", e.target.checked)} /> IPO ≤1 ปี
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={f.pmOnly} onChange={(e) => set("pmOnly", e.target.checked)} /> 🌅 PM
            </label>
          </div>
        </div>
        {/* บันทึก/แชร์ Radar */}
        <div className="flex gap-2 items-center border-t border-base-700/50 pt-3 flex-wrap">
          <input className="input !w-48" placeholder={`ตั้งชื่อ Radar เช่น "ปันผลจัด SET"`} value={f.name} onChange={(e) => set("name", e.target.value)} />
          <button className="btn-primary" onClick={saveRadar}>💾 บันทึก Radar</button>
          <button className="btn-secondary" onClick={shareRadar}>🔗 คัดลอกลิงก์แชร์</button>
          {savedFlash && <span className="text-xs text-up">✓ {savedFlash}</span>}
          {flash && <span className="text-xs text-accent-soft">{flash} <Link href="/compare" className="underline">ไปหน้าเปรียบเทียบ →</Link></span>}
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 text-xs text-zinc-500 border-b border-base-700/60 flex justify-between flex-wrap gap-2">
          <span>{loading ? "กำลังโหลด…" : `${rows.length.toLocaleString()} ตัวตรงเงื่อนไข — แสดงหน้า ${page}/${pages}`}</span>
          <span>★ ติดดาว · ⚔️ เพิ่มเทียบ · ➕ เข้าพอร์ต — คลิกชื่อหุ้นเข้าหน้าวิเคราะห์เต็ม</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                <th className="text-left px-4 py-2">หุ้น</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">ชื่อ</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">หมวด / อุตสาหกรรม</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Mkt Cap</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">P/E</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">Upside</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">ปันผล</th>
                <th className="text-right px-4 py-2">ราคา</th>
                <th className="text-right px-4 py-2">% วันนี้</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">🌅 พรีมาร์เก็ต</th>
                <th className="text-center px-3 py-2">⚡ จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const ys = ysym(f.region, r.symbol);
                const upside = r.targetPrice && r.price > 0 ? (r.targetPrice / r.price - 1) * 100 : null;
                return (
                  <tr key={r.exchange + r.symbol} className="border-b border-base-700/30 hover:bg-base-800/60">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/stock/${encodeURIComponent(ys)}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.symbol}</Link>
                      {r.ipoDate && new Date(r.ipoDate).getTime() > Date.now() - 365 * 864e5 && (
                        <span className="chip bg-fuchsia-500/15 text-fuchsia-300 ml-1.5 !text-[9px]">IPO {r.ipoDate.slice(0, 7)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-400 hidden md:table-cell max-w-52 truncate">{r.name}</td>
                    <td className="px-4 py-2 text-zinc-500 hidden lg:table-cell text-xs max-w-56 truncate" title={`${r.sector} · ${r.industry}`}>{r.sector}{r.industry ? ` · ${r.industry}` : ""}</td>
                    <td className="px-4 py-2 text-right num text-zinc-400 hidden sm:table-cell">{fmtMcap(r.mcap)}</td>
                    <td className="px-4 py-2 text-right num text-zinc-400 hidden md:table-cell">{r.pe ? r.pe.toFixed(1) : <span className="text-zinc-700">—</span>}</td>
                    <td className="px-4 py-2 text-right num hidden md:table-cell">
                      {upside !== null ? (
                        <span className={upside >= 0 ? "text-up" : "text-down"}>{upside >= 0 ? "+" : ""}{upside.toFixed(0)}%</span>
                      ) : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right num hidden sm:table-cell">{r.divYield ? <span className="text-accent-soft">{r.divYield.toFixed(1)}%</span> : <span className="text-zinc-700">—</span>}</td>
                    <td className="px-4 py-2 text-right num text-zinc-200">{r.price ? r.price.toFixed(2) : "—"}</td>
                    <td className={`px-4 py-2 text-right num font-semibold ${r.changePct >= 0 ? "text-up" : "text-down"}`}>
                      {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right num text-xs hidden sm:table-cell">
                      {r.premarketPct !== null && Math.abs(r.premarketPct) > 0.5 ? (
                        <span className={r.premarketPct >= 0 ? "text-up" : "text-down"}>{r.premarketPct >= 0 ? "+" : ""}{r.premarketPct.toFixed(1)}%</span>
                      ) : (<span className="text-zinc-700">—</span>)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <StarButton ticker={ys} className="text-base" />
                        <button className="text-zinc-500 hover:text-accent-soft" title="เพิ่มเข้าตะกร้าเปรียบเทียบ (สูงสุด 4)" onClick={() => compare(ys)}>⚔️</button>
                        <Link className="text-zinc-500 hover:text-accent-soft" title="เพิ่มเข้าพอร์ตของฉัน" href={`/portfolio?add=${encodeURIComponent(ys)}`}>➕</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-zinc-500 text-sm">ไม่พบหุ้นที่ตรงเงื่อนไข — ลองคลายเงื่อนไขบางตัว (preset บางตัวต้องใช้ตลาด 🇺🇸/🇹🇭 ที่เมตริกครบ)</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-base-700/60 flex-wrap">
            <button className="chip bg-base-800 text-zinc-300 border border-base-700 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>← ก่อนหน้า</button>
            {Array.from({ length: Math.min(pages, 9) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 4, pages - 8));
              return start + i;
            }).filter((p) => p >= 1 && p <= pages).map((p) => (
              <button key={p} className={`num px-2.5 py-1 rounded-lg text-xs font-bold ${p === page ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            {pages > 9 && <span className="text-zinc-600 text-xs">… {pages}</span>}
            <button className="chip bg-base-800 text-zinc-300 border border-base-700 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>ถัดไป →</button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-zinc-600">เมตริกจาก TradingView universe (คัดเฉพาะหุ้นสามัญ ตัด ETF/วอร์แรนต์/SPAC อัตโนมัติ) · Upside = ราคาเป้าหมายเฉลี่ยนักวิเคราะห์เทียบราคาล่าสุด · ราคา delay ~15 นาที</p>
    </div>
  );
}
