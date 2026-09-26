"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackRecordEntry } from "@/lib/types";

interface Meta {
  watchingSignals: number;
  watchingDays: number;
  nextEvalDateTh?: string;
  firstSignalDateTh?: string;
}

export default function TrackRecordPage() {
  // อ่านสดจาก API — เพื่อให้เห็นรายการที่บันทึกใหม่แม้บน Vercel (DB)
  const [entries, setEntries] = useState<TrackRecordEntry[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    fetch("/api/track-record")
      .then((r) => r.json())
      .then((j) => {
        setEntries(j.entries ?? []);
        setMeta(j.meta ?? null);
      })
      .catch(() => {});
  }, []);

  const auto = entries.filter((e) => e.source === "value");
  const manual = entries.filter((e) => e.source !== "value");
  const closedAuto = auto.filter((e) => e.status !== "open");
  const wins = closedAuto.filter((e) => e.status === "win").length;
  const winRate = closedAuto.length ? Math.round((wins / closedAuto.length) * 100) : null;
  const alphas = closedAuto.filter((e) => e.resultPct !== undefined && e.benchPct !== undefined).map((e) => (e.resultPct ?? 0) - (e.benchPct ?? 0));
  const avgAlpha = alphas.length ? alphas.reduce((a, b) => a + b, 0) / alphas.length : null;

  const statusStyle: Record<string, string> = {
    open: "bg-zinc-500/15 text-zinc-400",
    win: "bg-emerald-500/15 text-emerald-400",
    loss: "bg-rose-500/15 text-rose-400",
    flat: "bg-amber-500/15 text-amber-400",
  };
  const statusLabel: Record<string, string> = { open: "ยังเปิดอยู่", win: "ถูก", loss: "ผิด", flat: "เที่ยว" };

  const EntryCard = ({ e }: { e: TrackRecordEntry }) => (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-xs text-zinc-500">{e.date}</span>
        <span className={`chip ${statusStyle[e.status]}`}>{statusLabel[e.status]}</span>
        <span className={`chip ${e.stance === "bullish" ? "bg-up/10 text-up" : e.stance === "bearish" ? "bg-down/10 text-down" : "bg-zinc-500/10 text-zinc-400"}`}>
          {e.stance === "bullish" ? "มองบวก" : e.stance === "bearish" ? "มองลบ" : "กลาง"}
        </span>
        {e.source === "value" ? (
          <span className="chip bg-sky-500/10 text-sky-400">🤖 สัญญาณอัตโนมัติ</span>
        ) : (
          <span className="chip bg-base-800 text-zinc-400">✍️ ทีมเขียนเอง</span>
        )}
        {e.resultPct !== undefined && e.benchPct !== undefined ? (
          <span className="num text-sm">
            <span className={`font-bold ${e.resultPct >= 0 ? "text-up" : "text-down"}`}>
              {e.resultPct >= 0 ? "+" : ""}{e.resultPct}%
            </span>
            <span className="text-zinc-500 text-xs ml-1.5">ขณะที่ตลาด {e.benchPct >= 0 ? "+" : ""}{e.benchPct}%</span>
            <span className={`text-xs font-semibold ml-1.5 ${(e.resultPct - e.benchPct) * (e.stance === "bearish" ? -1 : 1) > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
              ({e.stance === "bearish" ? "อ่อนกว่า" : "เกิน"}ตลาด {Math.abs(e.resultPct - e.benchPct).toFixed(1)}%)
            </span>
          </span>
        ) : e.resultPct !== undefined ? (
          <span className={`num text-sm font-bold ${e.resultPct >= 0 ? "text-up" : "text-down"}`}>
            {e.resultPct >= 0 ? "+" : ""}{e.resultPct}%
          </span>
        ) : null}
      </div>
      <p className="text-sm text-zinc-200 mt-2 leading-relaxed">{e.thesis}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {e.tickers.map((t) => (
          <Link key={t} href={`/stock/${t}`} className="chip bg-base-800 text-zinc-300 border border-base-700 hover:text-zinc-50">{t}</Link>
        ))}
      </div>
      {e.note && <p className="text-xs text-zinc-600 mt-2">{e.note}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🏆 Track Record สาธารณะ</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          เราบันทึกทุกสัญญาณที่ระบบปล่อยและทุกสมมติฐานที่เขียนไว้ — ถูกก็บอกว่าถูก ผิดก็บอกว่าผิด ไม่ลบ ไม่แก้
          นี่คือเหตุผลที่คุณควรเชื่อ (หรือไม่เชื่อ) เรา — ตรวจสอบย้อนได้ทุกตัวเลขที่หน้าสัญญาณต้นทาง
        </p>
        <Link href="/model-portfolio" className="inline-flex items-center gap-2 mt-3 card !py-2 !px-4 border-accent/40 hover:border-accent transition-colors">
          💼 <span className="text-sm font-bold text-zinc-100">ดูพอร์ตจำลองสด: AI ปรับรายสัปดาห์ + บันทึกผลจริงทุกสัปดาห์</span>
          <span className="text-accent text-sm">→</span>
        </Link>
      </div>

      {/* สถิติรวม — สัญญาณอัตโนมัติ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-zinc-50">{closedAuto.length}</div>
          <div className="text-xs text-zinc-500">สัญญาณที่ประเมินแล้ว</div>
        </div>
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-accent-soft">{winRate !== null ? winRate + "%" : "—"}</div>
          <div className="text-xs text-zinc-500">อัตราถูก (เกิน/อ่อนกว่าตลาด &gt;1%)</div>
        </div>
        <div className="card p-4 text-center">
          <div className={`num text-2xl font-bold ${avgAlpha !== null && avgAlpha >= 0 ? "text-up" : "text-down"}`}>
            {avgAlpha !== null ? (avgAlpha >= 0 ? "+" : "") + avgAlpha.toFixed(1) + "%" : "—"}
          </div>
          <div className="text-xs text-zinc-500">เฉลี่ยเกินตลาด (alpha)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-zinc-50">{meta?.watchingSignals ?? 0}</div>
          <div className="text-xs text-zinc-500">กำลังติดตาม (รอครบ 14 วัน)</div>
        </div>
      </div>

      {/* กติกาเปิดเผย — ใครก็ตรวจสอบวิธีตัดสินได้ */}
      <div className="card p-4 border-base-700">
        <div className="text-sm font-bold text-zinc-200">📏 กติกาการตัดสิน (เปิดเผย ตรวจสอบได้)</div>
        <ul className="text-xs text-zinc-400 mt-2 space-y-1.5 leading-relaxed list-disc pl-5">
          <li>สัญญาณ 🤿 "ใต้น้ำพร้อมกลับตัว" และ 🎈 "แพงเกินตัว" จากหน้า <Link href="/value" className="link">/value</Link> ถูกจด snapshot ทุกวันอัตโนมัติ</li>
          <li>ครบ <b className="text-zinc-200">14 วัน</b> ระบบเทียบ <b className="text-zinc-200">ราคาปิดวันปล่อยสัญญาณ → ราคาปิดล่าสุด</b> กับตลาด (US เทียบ S&amp;P500 · ไทยเทียบดัชนี SET)</li>
          <li>🤿 ถูก = วิ่ง<b className="text-zinc-200">เกินตลาดเกิน 1%</b> · 🎈 ถูก = อ่อนกว่าตลาดเกิน 1% · ช่วงกลาง = "เที่ยว" · สลับเกณฑ์ให้ผิด = แพ้</li>
          <li>ประเมินโดย cron รายคืน ไม่มีมนุษย์เข้าแตะผลลัพธ์ · ไม่หักค่าธรรมเนียม · ประเมินครั้งเดียวไม่แก้ย้อนหลัง</li>
        </ul>
      </div>

      {/* สัญญาณอัตโนมัติ */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-400">🤖 สัญญาณอัตโนมัติของระบบ — ประเมินผลจริงโดยระบบ</h2>
        {auto.length === 0 ? (
          <div className="card p-5">
            <p className="text-sm text-zinc-300 leading-relaxed">
              📹 กล้องเพิ่งเริ่มอัด — เราเริ่มจดสัญญาณรายวันไปเมื่อ{" "}
              {meta?.firstSignalDateTh ? <b className="text-zinc-100">{meta.firstSignalDateTh}</b> : "เร็วๆ นี้"}{" "}
              และกำลังเก็บสัญญาณรอวัดผลอยู่ {meta?.watchingSignals ?? 0} รายการ
              {meta?.nextEvalDateTh ? (
                <>
                  {" "}ชุดแรกจะถูกประเมินผลจริงเมื่อ <b className="text-accent">{meta.nextEvalDateTh}</b>
                </>
              ) : null}
            </p>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              เราไม่อ้าง backtest ย้อนหลังที่พิสูจน์ไม่ได้ — ทุกตัวเลขหน้านี้เกิดจากสัญญาณที่ปล่อยสาธารณะก่อน แล้ววัดผลทีหลังเท่านั้น
            </p>
          </div>
        ) : (
          auto.map((e) => <EntryCard key={e.id} e={e} />)
        )}
      </section>

      {/* สมมติฐานที่ทีมเขียน */}
      {manual.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-400">✍️ สมมติฐานที่ทีมเขียนเอง</h2>
          {manual.map((e) => (
            <EntryCard key={e.id} e={e} />
          ))}
        </section>
      )}

      <p className="text-xs text-zinc-600">
        * รายการที่ระบุ &ldquo;ตัวอย่างสาธิต&rdquo; เป็นข้อมูลตัวอย่างสำหรับโชว์รูปแบบ — ลบออกได้ที่ src/data/track-record.json
        · ผลสัญญาณอัตโนมัติวัดจากราคาปิดวันปล่อยสัญญาณ ไม่รวมค่าธรรมเนียม · ทั้งหมดเป็นข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}
