"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";

interface Row {
  symbol: string; name: string; price: number; changePct: number; mcap: number;
  sector: string; industry: string; exchange: string; ipoDate: string | null;
  premarketPct: number | null; divYield: number | null; country: string;
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

export default function ScreenerPage() {
  const [f, setF] = useState<Radar>(DEFAULT);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [radars, setRadars] = useState<Radar[]>([]);
  const [savedFlash, setSavedFlash] = useState("");

  // โหลด Radar จาก URL (?r=) หรือ localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
      if (Array.isArray(saved)) setRadars(saved.filter((r: Radar) => r && r.name));
    } catch { /* เริ่มต้นสะอาด */ }
    const r = new URLSearchParams(location.search).get("r");
    if (r) {
      try {
        const parsed = JSON.parse(atob(r));
        setF({ ...DEFAULT, ...parsed, name: "" });
      } catch { /* URL เสีย = ใช้ default */ }
    }
  }, []);

  const set = <K extends keyof Radar>(k: K, v: Radar[K]) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ region: f.region, limit: "200" });
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

  // ตัวกรองตัวเลข + เรียง ทำฝั่ง client (เร็ว ไม่ต้องยิง API ใหม่)
  const rows = (() => {
    let out = [...(data?.rows ?? [])];
    const mc = Number(f.mcapMin) || 0;
    if (mc) out = out.filter((r) => r.mcap >= mc);
    const cmin = f.chgMin !== "" ? Number(f.chgMin) : -Infinity;
    const cmax = f.chgMax !== "" ? Number(f.chgMax) : Infinity;
    out = out.filter((r) => r.changePct >= cmin && r.changePct <= cmax);
    const dv = Number(f.divMin) || 0;
    if (dv) out = out.filter((r) => (r.divYield ?? 0) >= dv);
    if (f.sort === "chg-desc") out.sort((a, b) => b.changePct - a.changePct);
    else if (f.sort === "chg-asc") out.sort((a, b) => a.changePct - b.changePct);
    else if (f.sort === "div") out.sort((a, b) => (b.divYield ?? 0) - (a.divYield ?? 0));
    else out.sort((a, b) => b.mcap - a.mcap);
    return out;
  })();

  const saveRadar = () => {
    const name = (f.name || "").trim() || `Radar ${radars.length + 1}`;
    const next = [...radars.filter((r) => r.name !== name), { ...f, name }];
    setRadars(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setF((p) => ({ ...p, name }));
    setSavedFlash(name);
    setTimeout(() => setSavedFlash(""), 2000);
  };
  const applyRadar = (r: Radar) => setF({ ...r });
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">📡 Radars Builder — สร้างเรดาร์หุ้นของคุณเอง</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {data ? `${data.total.toLocaleString()} หุ้นในตลาดนี้ · ${data.sectors.length} หมวด · ${data.industries.length} อุตสาหกรรม — จับคู่เงื่อนไขได้อิสระ บันทึกเป็น Radar ของคุณ แล้วแชร์ต่อได้` : "กำลังโหลด universe ทั้งตลาดจาก TradingView…"}
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
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 text-xs text-zinc-500 border-b border-base-700/60 flex justify-between">
          <span>{loading ? "กำลังโหลด…" : `${rows.length} ตัวตรงเงื่อนไข (จาก ${data?.filtered ?? 0} ที่ผ่านตัวกรองหลัก)`}</span>
          <span>คลิกเข้าหน้าวิเคราะห์เต็ม (AI · ปัจจัย 5 มิติ · ฤดูกาล)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                <th className="text-left px-4 py-2">หุ้น</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">ชื่อ</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">หมวด / อุตสาหกรรม</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Mkt Cap</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">ปันผล</th>
                <th className="text-right px-4 py-2">ราคา</th>
                <th className="text-right px-4 py-2">% วันนี้</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">🌅 พรีมาร์เก็ต</th>
                <th className="text-right px-4 py-2 hidden lg:table-cell">ซื้อผ่าน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.exchange + r.symbol} className="border-b border-base-700/30 hover:bg-base-800/60">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/stock/${encodeURIComponent(ysym(f.region, r.symbol))}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.symbol}</Link>
                    {r.ipoDate && new Date(r.ipoDate).getTime() > Date.now() - 365 * 864e5 && (
                      <span className="chip bg-fuchsia-500/15 text-fuchsia-300 ml-1.5 !text-[9px]">IPO {r.ipoDate.slice(0, 7)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-400 hidden md:table-cell max-w-52 truncate">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-500 hidden lg:table-cell text-xs max-w-56 truncate" title={`${r.sector} · ${r.industry}`}>{r.sector}{r.industry ? ` · ${r.industry}` : ""}</td>
                  <td className="px-4 py-2 text-right num text-zinc-400 hidden sm:table-cell">{fmtMcap(r.mcap)}</td>
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
                  <td className="px-4 py-2 text-right hidden lg:table-cell"><BrokerBadge ticker={ysym(f.region, r.symbol)} compact /></td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-500 text-sm">ไม่พบหุ้นที่ตรงเงื่อนไข — ลองคลายเงื่อนไขบางตัว</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
