"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BrokerBadge from "@/components/BrokerBadge";

interface Row {
  symbol: string; name: string; price: number; changePct: number; mcap: number;
  sector: string; industry: string; exchange: string; ipoDate: string | null;
  premarketPct: number | null; country: string;
}
interface Data {
  region: string; total: number; filtered: number; ipoCount: number;
  sectors: string[]; industries: string[]; rows: Row[];
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

// suffix Yahoo ของแต่ละตลาด — ให้ลิงก์/ป้ายโบรกเกอร์ชี้ถูกหุ้น
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

export default function ScreenerPage() {
  const [region, setRegion] = useState("america");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [ipoOnly, setIpoOnly] = useState(false);
  const [pmOnly, setPmOnly] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ region, limit: "200" });
      if (sector) params.set("sector", sector);
      if (industry) params.set("industry", industry);
      if (ipoOnly) params.set("ipo", "1");
      if (pmOnly) params.set("pm", "1");
      if (q) params.set("q", q);
      const res = await fetch("/api/universe?" + params);
      const j = await res.json();
      if (!res.ok) setErr(j.error || "โหลดไม่สำเร็จ");
      else setData(j);
    } catch {
      setErr("โหลดไม่สำเร็จ");
    }
    setLoading(false);
  }, [region, sector, industry, ipoOnly, pmOnly, q]);

  useEffect(() => {
    const id = setTimeout(load, 400);
    return () => clearTimeout(id);
  }, [load]);

  const fmtMcap = (v: number) => (v >= 1e12 ? (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(0) + "M" : "-");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🔎 คัดกรองหุ้น — ทั้งตลาด 30 ประเทศ</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {data ? `${data.total.toLocaleString()} หุ้นในตลาดนี้ (เรียงตามมูลค่าตลาด) · ${data.sectors.length} หมวดหมู่จริง · ${data.industries.length} อุตสาหกรรมย่อย · IPO ใหม่ ≤1 ปี: ${data.ipoCount} ตัว` : "กำลังโหลด universe ทั้งตลาดจาก TradingView…"}
        </p>
      </div>

      {/* ตลาด */}
      <div className="flex gap-1 flex-wrap">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => { setRegion(r.id); setSector(""); setIndustry(""); }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${region === r.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ตัวกรอง */}
      <div className="card p-4 grid md:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-zinc-500">หมวดหมู่ (Sector)</label>
          <select className="input mt-1" value={sector} onChange={(e) => { setSector(e.target.value); setIndustry(""); }}>
            <option value="">ทั้งหมด</option>
            {(data?.sectors ?? []).map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">อุตสาหกรรมย่อย (Industry)</label>
          <select className="input mt-1" value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={!sector}>
            <option value="">{sector ? "ทั้งหมดในหมวดนี้" : "เลือกหมวดก่อน"}</option>
            {(data?.industries ?? []).map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">ค้นหา</label>
          <input className="input mt-1" placeholder="ชื่อ/รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={ipoOnly} onChange={(e) => setIpoOnly(e.target.checked)} /> IPO ใหม่ ≤1 ปี
          </label>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input type="checkbox" className="accent-yellow-500 w-4 h-4" checked={pmOnly} onChange={(e) => setPmOnly(e.target.checked)} /> 🌅 Premarket เด่น
          </label>
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-down">{err}</div>}

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 text-xs text-zinc-500 border-b border-base-700/60 flex justify-between">
          <span>{loading ? "กำลังโหลด…" : `แสดง ${data?.rows.length ?? 0} / ${data?.filtered ?? 0} ตัว`}</span>
          <span>คลิกเข้าหน้าวิเคราะห์เต็ม (AI · ปัจจัย 5 มิติ · สถานการณ์)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                <th className="text-left px-4 py-2">หุ้น</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">ชื่อ</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">หมวด / อุตสาหกรรม</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Mkt Cap</th>
                <th className="text-right px-4 py-2">ราคา</th>
                <th className="text-right px-4 py-2">% วันนี้</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">🌅 พรีมาร์เก็ต</th>
                <th className="text-right px-4 py-2 hidden lg:table-cell">ซื้อผ่าน</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.exchange + r.symbol} className="border-b border-base-700/30 hover:bg-base-800/60">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/stock/${encodeURIComponent(ysym(region, r.symbol))}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.symbol}</Link>
                    {r.ipoDate && new Date(r.ipoDate).getTime() > Date.now() - 365 * 864e5 && (
                      <span className="chip bg-fuchsia-500/15 text-fuchsia-300 ml-1.5 !text-[9px]">IPO {r.ipoDate.slice(0, 7)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-400 hidden md:table-cell max-w-52 truncate">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-500 hidden lg:table-cell text-xs max-w-56 truncate" title={`${r.sector} · ${r.industry}`}>{r.sector}{r.industry ? ` · ${r.industry}` : ""}</td>
                  <td className="px-4 py-2 text-right num text-zinc-400 hidden sm:table-cell">{fmtMcap(r.mcap)}</td>
                  <td className="px-4 py-2 text-right num text-zinc-200">{r.price ? r.price.toFixed(2) : "—"}</td>
                  <td className={`px-4 py-2 text-right num font-semibold ${r.changePct >= 0 ? "text-up" : "text-down"}`}>
                    {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 text-right num text-xs hidden sm:table-cell">
                    {r.premarketPct !== null && Math.abs(r.premarketPct) > 0.5 ? (
                      <span className={r.premarketPct >= 0 ? "text-up" : "text-down"}>{r.premarketPct >= 0 ? "+" : ""}{r.premarketPct.toFixed(1)}%</span>
                    ) : (<span className="text-zinc-700">—</span>)}
                  </td>
                  <td className="px-4 py-2 text-right hidden lg:table-cell"><BrokerBadge ticker={ysym(region, r.symbol)} compact /></td>
                </tr>
              ))}
              {!loading && !data?.rows.length && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-500 text-sm">ไม่พบหุ้นที่ตรงเงื่อนไข</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
