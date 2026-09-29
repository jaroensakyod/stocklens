"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AiBrief from "@/components/AiBrief";

// 🐋 เซียนที่ถือหุ้นนี้ — reverse lookup จาก 13F LIVE (SEC EDGAR) ของกูรูในระบบ
interface Holder {
  id: string; name: string; firm: string; emoji: string; source: string;
  pct: number; valueUsd: number; shares: number; rank: number; ofCount: number;
  change?: { type: string; deltaPct?: number }; putCall?: string; asOf?: string;
}
interface Data { symbol: string; holders: Holder[]; summary: { count: number; totalValueUsd: number; totalShares: number; maxPct: number; increasing: number; decreasing: number; asOf: string | null; source: string } | null }

const changeBadge = (h: Holder) => {
  if (!h.change) return null;
  const { type, deltaPct } = h.change;
  if (type === "new") return <span className="chip border border-up/30 bg-up/10 text-up !text-[10px] !py-0.5">🆕 เปิดใหม่</span>;
  if (type === "increased") return <span className="chip border border-up/30 bg-up/10 text-up !text-[10px] !py-0.5">▲ ซื้อเพิ่ม {deltaPct?.toFixed(0)}%</span>;
  if (type === "decreased") return <span className="chip border border-down/30 bg-down/10 text-down !text-[10px] !py-0.5">▼ ลด {(deltaPct ?? 0).toFixed(0)}%</span>;
  return <span className="chip border border-base-700 bg-base-800 text-zinc-500 !text-[10px] !py-0.5">≈ ถือเท่าเดิม</span>;
};

export default function GuruHoldersPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none" | "err">("loading");

  useEffect(() => {
    let alive = true;
    if (/\.[A-Z]{2}$/.test(ticker)) {
      setState("none");
      return;
    }
    setState("loading");
    fetch(`/api/guru-holders?s=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) throw new Error(j.error);
        setData(j);
        setState("ok");
      })
      .catch(() => alive && setState("err"));
    return () => {
      alive = false;
    };
  }, [ticker]);

  if (state === "none") return null; // หุ้นนอกสหรัฐฯ — 13F ไม่ครอบ
  if (state === "err") return null;
  if (state === "loading") return <div className="card p-5"><div className="text-sm text-zinc-500">🐋 กำลังไล่ดูว่าเซียนคนไหนถือ {ticker}… (ครั้งแรกของวันดึงจาก SEC ตรง อาจช้า ~30 วิ)</div></div>;
  if (!data?.holders?.length || !data.summary) {
    return (
      <div className="card p-5">
        <h2 className="text-base font-bold text-zinc-100 mb-1">🐋 นักลงทุนระดับโลกที่ถือหุ้นนี้</h2>
        <p className="text-xs text-zinc-500">ไม่พบ {ticker} ใน top holdings ของกูรูที่ติดตาม (ดูพอร์ตครบที่ <Link href="/gurus" className="text-accent-soft hover:underline">หน้ากูรู 13F</Link>)</p>
      </div>
    );
  }

  const s = data.summary;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-zinc-50">🐋 นักลงทุนระดับโลกที่ถือหุ้นนี้</h2>
        <Link href="/gurus" className="chip bg-base-800 text-accent-soft border border-base-700">ดูพอร์ตเต็มทุกคน →</Link>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        จากรายงาน 13F ล่าสุด (LIVE จาก SEC EDGAR{s.asOf ? ` · งวด ${s.asOf}` : ""}) — มองเห็นเฉพาะ top holdings ต่อกูรู
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          ["สถาบันที่ถือ", `${s.count} ราย`],
          ["มูลค่ารวมที่ถือ", s.totalValueUsd >= 1e9 ? `$${(s.totalValueUsd / 1e9).toFixed(1)}B` : `$${Math.round(s.totalValueUsd / 1e6)}M`],
          ["น้ำหนักสูงสุดในพอร์ต", `${s.maxPct.toFixed(1)}%`],
          ["ไตรมาสล่าสุด", `▲ซื้อ ${s.increasing} · ▼ลด ${s.decreasing}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-base-700/60 bg-base-800/40 p-2.5">
            <div className="text-[10px] text-zinc-500">{k}</div>
            <div className="num text-sm font-bold text-zinc-100">{v}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-base-700/60 text-zinc-500">
              <th className="py-2 text-left font-normal">นักลงทุน</th>
              <th className="py-2 text-right font-normal">สัดส่วนในพอร์ต</th>
              <th className="py-2 text-right font-normal">มูลค่าที่ถือ</th>
              <th className="py-2 text-right font-normal">อันดับในพอร์ต</th>
              <th className="py-2 text-right font-normal">เคลื่อนไหว QoQ</th>
            </tr>
          </thead>
          <tbody>
            {data.holders.map((h) => (
              <tr key={h.id} className="border-b border-base-700/30">
                <td className="py-2">
                  <span className="mr-1">{h.emoji}</span>
                  <b className="text-zinc-100">{h.name}</b>
                  <span className="text-zinc-500"> · {h.firm}</span>
                </td>
                <td className="py-2 num text-right font-semibold text-zinc-100">{h.pct.toFixed(2)}%</td>
                <td className="py-2 num text-right text-zinc-300">{h.valueUsd >= 1e9 ? `$${(h.valueUsd / 1e9).toFixed(1)}B` : `$${Math.round(h.valueUsd / 1e6)}M`}</td>
                <td className="py-2 num text-right text-zinc-400">#{h.rank}<span className="text-zinc-600">/{h.ofCount}</span></td>
                <td className="py-2 text-right">{changeBadge(h)}{h.putCall === "PUT" && <span className="ml-1 text-[10px] text-down">PUT</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AiBrief
        ticker={ticker}
        section="guru-holders"
        lines={[
          `สถาบันที่ถือ: ${s.count} ราย · มูลค่ารวม $${(s.totalValueUsd / 1e9).toFixed(1)}B · น้ำหนักสูงสุด ${s.maxPct.toFixed(1)}% ของพอร์ต`,
          `ไตรมาสล่าสุด: ▲ซื้อ ${s.increasing} ราย · ▼ลด ${s.decreasing} ราย`,
          ...data.holders.slice(0, 8).map((h) => `${h.name} (${h.firm}): ${h.pct.toFixed(1)}% ของพอร์ต · อันดับ #${h.rank}${h.change?.type === "increased" ? " · ซื้อเพิ่ม" : h.change?.type === "decreased" ? " · ลด" : h.change?.type === "new" ? " · เปิดใหม่" : ""}`),
          `งวด 13F ล่าสุด ${s.asOf ?? "—"}`,
        ]}
        rule={`เซียน ${s.count} รายถือหุ้นนี้รวม $${(s.totalValueUsd / 1e9).toFixed(1)}B — ไตรมาสล่าสุด${s.increasing > s.decreasing ? `มีแรงซื้อสุทธิ (${s.increasing} รายเพิ่ม vs ${s.decreasing} รายลด)` : s.decreasing > s.increasing ? `มีแรงขายสุทธิ (${s.decreasing} รายลด vs ${s.increasing} รายเพิ่ม)` : "ท่าทีคงที่"} · 13F ล่าช้าสูงสุด 45 วัน — อ่านเป็นข้อมูลประกอบการพิจารณา`}
      />

      <p className="text-[10px] text-zinc-600 mt-3">13F ยื่นได้ถึง 45 วันหลังสิ้นไตรมาส — ตำแหน่งจริงวันนี้อาจต่างจากนี้ · พอร์ตกูรูบางรายเห็นเฉพาะฝั่งหุ้นสหรัฐฯ ไม่เห็น hedge/เงินสด</p>
    </div>
  );
}
