"use client";

import { useEffect, useState } from "react";

// 🏛️ Top Shareholders — ใครถือ ใครเท (แบบ StockRadars) — ข้อมูลสถาบัน/insider จาก Yahoo (ตลาด US เท่านั้น)
interface Data {
  available: boolean;
  institutions?: { org: string; pctHeld: number; pctChange: number; value: number; reportDate: string }[];
  insiders?: { name: string; position: string; shares: number; latestTrans: string }[];
  insiderNetPct?: number | null;
}

const fmtVal = (v: number) => (v >= 1e12 ? (v / 1e12).toFixed(1) + "T$" : v >= 1e9 ? (v / 1e9).toFixed(1) + "B$" : v >= 1e6 ? (v / 1e6).toFixed(0) + "M$" : v.toLocaleString());

export default function HoldersPanel({ ticker, market }: { ticker: string; market?: string }) {
  const isThai = ticker.endsWith(".BK");
  void market; // สำรองไว้กรณีมีข้อมูลรายตลาดเพิ่ม
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">("loading");

  useEffect(() => {
    if (isThai) return; // Yahoo ไม่มีข้อมูลผู้ถือหุ้นสถาบันของตลาดไทย
    let alive = true;
    setState("loading");
    fetch(`/api/holders?s=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!alive) return;
        setData(j);
        setState("ok");
      })
      .catch(() => alive && setState("none"));
    return () => {
      alive = false;
    };
  }, [ticker, isThai]);

  if (isThai) {
    return (
      <div className="card p-5 mt-6">
        <h3 className="text-sm font-bold text-zinc-100 mb-2">🏛️ ใครถือหุ้นนี้ (Top Shareholders)</h3>
        <p className="text-xs text-zinc-500">
          ข้อมูลผู้ถือหุ้นรายใหญ่/สถาบันของหุ้นไทยอยู่ในแบบ 56-1 ของ SET ซึ่งไม่มี API สาธารณะ — ดูได้ที่{" "}
          <a className="text-accent-soft hover:underline" href={`https://www.set.or.th/th/market/product/stock/quotes/${ticker.replace(".BK", "")}/company-profile`} target="_blank" rel="noopener noreferrer">
            หน้าโปรไฟล์บริษัทของ SET
          </a>{" "}
          (อัปเดตจากงบจริงทุกไตรมาส)
        </p>
      </div>
    );
  }
  if (state === "loading") return <div className="card p-5 mt-6 text-xs text-zinc-500">🏛️ กำลังดึงข้อมูลผู้ถือหุ้น…</div>;
  if (state === "none" || !data?.available || !data.institutions?.length) return null;

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-zinc-100">🏛️ ใครถือหุ้นนี้ (Top Shareholders)</h3>
        {typeof data.insiderNetPct === "number" && (
          <span className={`chip num border ${data.insiderNetPct >= 0 ? "bg-up/10 text-up border-up/30" : "bg-down/10 text-down border-down/30"}`}>
            Insider {data.insiderNetPct >= 0 ? "ซื้อสุทธิ +" : "ขายสุทธิ "}{(data.insiderNetPct * 100).toFixed(2)}% (6 ด.)
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-[11px] text-zinc-500 mb-1.5">🏦 สถาบัน (Top {Math.min(10, data.institutions.length)}) — จาก 13F/คำนวณ Yahoo</div>
          <ul className="space-y-1">
            {data.institutions.map((h) => (
              <li key={h.org} className="flex items-center justify-between text-[11px] bg-base-850 rounded px-2.5 py-1.5">
                <span className="text-zinc-300 truncate mr-2">{h.org}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="num text-zinc-200">{(h.pctHeld * 100).toFixed(1)}%</span>
                  <span className={`num ${h.pctChange > 0.001 ? "text-up" : h.pctChange < -0.001 ? "text-down" : "text-zinc-600"}`}>
                    {h.pctChange > 0.001 ? "▲เพิ่ม" : h.pctChange < -0.001 ? "▼ลด" : "–"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-600 mt-1.5">เทียบไตรมาสล่าสุด · ดูฝั่งกูรูเต็มรูปแบบได้ที่ <a className="text-accent-soft hover:underline" href="/gurus">หน้า 🎓 กูรู & 13F</a></p>
        </div>

        {!!data.insiders?.length && (
          <div>
            <div className="text-[11px] text-zinc-500 mb-1.5">👔 ผู้บริหาร/ผู้ถือรายใหญ่ภายใน (Insiders)</div>
            <ul className="space-y-1">
              {data.insiders.map((h) => (
                <li key={h.name} className="flex items-center justify-between text-[11px] bg-base-850 rounded px-2.5 py-1.5">
                  <span className="truncate mr-2">
                    <span className="text-zinc-300">{h.name}</span>
                    {h.position && <span className="text-zinc-600"> · {h.position}</span>}
                  </span>
                  {h.shares > 0 && <span className="num text-zinc-400 shrink-0">{fmtVal(h.shares)} หุ้น</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
