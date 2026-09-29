"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// 🐋 หุ้นที่เซียนถือร่วมกัน — consensus จาก 13F LIVE (เทียบหน้า top-10-holdings ของคู่แข่ง แต่เรา LIVE + QoQ net)
interface Row {
  ticker: string; issuer: string; count: number; totalValueUsd: number; avgPct: number; maxPct: number;
  increasing: number; decreasing: number;
  investors: { id: string; name: string; emoji: string; pct: number; valueUsd: number; rank: number; changeType?: string }[];
}

type SortKey = "count" | "total" | "avg" | "ticker";

export default function GurusConsensusPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [guruCount, setGuruCount] = useState(0);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("count");
  const [tab, setTab] = useState<"stocks" | "investors">("stocks");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/gurus/consensus")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "โหลดไม่สำเร็จ");
        setRows(j.rows ?? []);
        setGuruCount(j.guruCount ?? 0);
        setAsOf(j.asOf ?? null);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const sorted = useMemo(() => {
    const out = [...rows];
    if (sort === "count") out.sort((a, b) => b.count - a.count || b.totalValueUsd - a.totalValueUsd);
    else if (sort === "total") out.sort((a, b) => b.totalValueUsd - a.totalValueUsd);
    else if (sort === "avg") out.sort((a, b) => b.avgPct - a.avgPct);
    else out.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return out;
  }, [rows, sort]);

  if (err) return <div className="card p-8 text-center text-down text-sm">{err}</div>;
  if (!rows.length && !err) return <div className="py-20 text-center text-zinc-500 text-sm">กำลังไล่พอร์ตทุกเซียนจาก SEC EDGAR… (ครั้งแรกของวันอาจใช้เวลา ~1-2 นาที)</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🤝 หุ้นที่เซียนถือร่วมกัน</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          ดูว่าหุ้นตัวไหนที่นักลงทุนระดับโลก <b className="text-zinc-200">{guruCount}</b> ราย "เห็นตรงกัน" จนติด top holdings พร้อมกัน
          {asOf && <> · ข้อมูลงวด <span className="num">{asOf}</span></>} — ทั้งหมด LIVE จาก SEC EDGAR (ไม่ใช่ snapshot) พร้อมสัญญาณ ▲▼ ว่าใครเพิ่ม-ลดไตรมาสล่าสุด
        </p>
        <Link href="/gurus" className="chip bg-base-800 text-accent-soft border border-base-700 mt-2 inline-block">← ดูพอร์ตรายคนทั้งหมด</Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-base-700 overflow-hidden text-xs">
          <button className={`px-3 py-1.5 ${tab === "stocks" ? "bg-accent/20 text-zinc-100" : "text-zinc-500"}`} onClick={() => setTab("stocks")}>หุ้นยอดนิยม</button>
          <button className={`px-3 py-1.5 ${tab === "investors" ? "bg-accent/20 text-zinc-100" : "text-zinc-500"}`} onClick={() => setTab("investors")}>รายนักลงทุน</button>
        </div>
        {tab === "stocks" && (
          <select className="input !w-auto text-xs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="count">เรียงตาม: จำนวนเซียนที่ถือ</option>
            <option value="total">เรียงตาม: มูลค่ารวมที่ถือ</option>
            <option value="avg">เรียงตาม: สัดส่วนเฉลี่ยในพอร์ต</option>
            <option value="ticker">เรียงตาม: ชื่อย่อ (A→Z)</option>
          </select>
        )}
      </div>

      {tab === "stocks" ? (
        <div className="space-y-2.5">
          {sorted.map((r, i) => (
            <div key={r.ticker} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="num text-xs text-zinc-600 w-6">#{i + 1}</span>
                  <Link href={`/stock/${r.ticker}`} className="text-lg font-bold text-zinc-50 hover:text-accent-soft">{r.ticker}</Link>
                  <span className="text-xs text-zinc-500 max-w-48 truncate">{r.issuer}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="chip bg-accent/15 text-accent-soft border border-accent/30 num">{r.count} เซียนถือร่วม</span>
                  <span className="chip bg-base-800 text-zinc-300 border border-base-700 num">มูลค่ารวม ${(r.totalValueUsd / 1e9).toFixed(1)}B$</span>
                  <span className="chip bg-base-800 text-zinc-400 border border-base-700 num">เฉลี่ย {r.avgPct.toFixed(1)}% ของพอร์ต</span>
                  {r.increasing > r.decreasing && <span className="chip bg-up/10 text-up border border-up/30 num">▲ เพิ่มสุทธิ {r.increasing - r.decreasing} ราย</span>}
                  {r.decreasing > r.increasing && <span className="chip bg-down/10 text-down border border-down/30 num">▼ ลดสุทธิ {r.decreasing - r.increasing} ราย</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {r.investors.slice(0, 10).map((inv) => (
                  <Link key={inv.id} href={`/gurus/${inv.id}`} className={`chip border !text-[10px] ${inv.changeType === "increased" || inv.changeType === "new" ? "bg-up/10 text-up border-up/30" : inv.changeType === "decreased" ? "bg-down/10 text-down border-down/30" : "bg-base-800 text-zinc-400 border-base-700"}`}>
                    {inv.emoji} {inv.name} <span className="num opacity-80">{inv.pct.toFixed(1)}%</span>
                  </Link>
                ))}
                {r.investors.length > 10 && <span className="chip bg-base-800 text-zinc-500 border border-base-700 !text-[10px]">+{r.investors.length - 10}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-5">
          <p className="text-xs text-zinc-500 mb-3">มุมกลับ: เซียนแต่ละคนถืออะไรบ้าง (top holdings) — คลิกชื่อเข้าหน้าพอร์ตเต็มย้อนหลัง 4 ไตรมาส</p>
          <div className="space-y-4">
            {Array.from(new Set(sorted.flatMap((r) => r.investors.map((i) => i.id)))).map((gid) => {
              const mine = sorted.filter((r) => r.investors.some((i) => i.id === gid));
              const inv0 = mine[0]?.investors.find((i) => i.id === gid)!;
              return (
                <div key={gid}>
                  <Link href={`/gurus/${gid}`} className="text-sm font-bold text-zinc-100 hover:text-accent-soft">{inv0.emoji} {inv0.name}</Link>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {mine.slice(0, 12).map((r) => (
                      <Link key={r.ticker} href={`/stock/${r.ticker}`} className="chip bg-base-800 text-zinc-300 border border-base-700 !text-[11px]">
                        {r.ticker} <span className="num text-zinc-500">{r.investors.find((x) => x.id === gid)!.pct.toFixed(1)}%</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        นับจาก top-20 holdings ต่อกูรู (เกณฑ์เดียวกันทุกคน — หุ้นที่เป็นตำแหน่งเล็กในพอร์ตจะไม่ติด) · 13F ล่าช้าสูงสุด 45 วัน · เชิงการศึกษา ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}
