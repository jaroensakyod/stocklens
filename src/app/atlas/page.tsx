"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import atlasData from "@/data/atlas.json";

// 🕵️ Atlas — ห้องพยานหลักฐาน 100 ปี: กระดานคอร์ก + การ์ดกระดาษ + เชือกแดง + คลิกอ่านเต็ม
// ข้อมูลทั้งหมดมาจาก src/data/atlas.json (แก้ไขที่ scripts/atlas-src แล้วรัน node scripts/build-atlas.mjs)

interface AssetNote { t: string; y?: string; d?: string }
interface AtlasNode {
  id: string; type: string; era: string; year: number; date: string; emoji: string;
  title: string; summary: string; body: string[]; wins: AssetNote[]; loses: AssetNote[];
  lessons: string[]; x: number; y: number; rot: number;
}
interface AtlasEdge { from: string; to: string; label: string }
interface AtlasEra { id: string; from: number; to: number | string; name: string; desc: string; x: number }
interface Atlas { meta: { boardW: number; boardH: number; cardW: number; cardH: number; zoneX: number; zone2X: number; ancientX: number; ancientW: number }; eras: AtlasEra[]; nodes: AtlasNode[]; edges: AtlasEdge[] }
const ATLAS = atlasData as unknown as Atlas;

// แถบการส่งไม้ต่อมหาอำนาจ (x ตามพิกัดกระดาน — คลิกเพื่อเลื่อนไปยุคนั้น)
const HEGEMONS: { label: string; x: number; to: number; color: string; note: string }[] = [
  { label: "🇵🇹 โปรตุเกส", x: 700, to: 1180, color: "#f59e0b", note: "โปรตุเกสเปิดเส้นทางทะเล → สเปนคุมเงิน Potosí (จักรวรรดิไอบีเรีย)" },
  { label: "🇳🇱 ดัตช์", x: 1180, to: 1520, color: "#fb923c", note: "ศูนย์กลางการเงินโลกคนแรก (VOC+Bank of Amsterdam)" },
  { label: "🇬🇧 อังกฤษ", x: 1520, to: 2760, color: "#a855f7", note: "Pax Britannica: ปอนด์+ทอง+กองเรือ 200 ปี" },
  { label: "🇺🇸 อเมริกา", x: 2760, to: 5710, color: "#3b82f6", note: "Bretton Woods→เปโตรดอลลาร์→QE: ดอลลาร์ 100 ปี" },
  { label: "🌐 หลายขั้ว", x: 5710, to: 7150, color: "#22c55e", note: "ทดสอบครั้งใหญ่ที่สุดของระบบดอลลาร์ (2022-2030)" },
  { label: "🔮 AI ยุคใหม่ ?", x: 7150, to: 8400, color: "#a855f7", note: "หลัง Reset ~2030: AGI/ควอนตัม/มหาอำนาจใหม่ (มุมมอง AT)" },
];

const TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  system: { label: "ระบบเงินตรา", color: "#eab308", emoji: "⚖️" },
  war: { label: "สงคราม/ความขัดแย้ง", color: "#ef4444", emoji: "💥" },
  crisis: { label: "วิกฤตการเงิน", color: "#f97316", emoji: "📉" },
  flow: { label: "การไหลของเงิน", color: "#14b8a6", emoji: "🔄" },
  power: { label: "การเปลี่ยนอำนาจ", color: "#a855f7", emoji: "👑" },
  institution: { label: "สถาบัน/ข้อตกลง", color: "#3b82f6", emoji: "📜" },
  reset: { label: "Reset & อนาคต", color: "#22c55e", emoji: "♻️" },
};

const byId = new Map(ATLAS.nodes.map((n) => [n.id, n]));
const sortedByYear = [...ATLAS.nodes].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

export default function AtlasPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [era, setEra] = useState<string | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(0.75);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (window.innerWidth < 900) { setView("list"); setZoom(0.55); }
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (n: AtlasNode) =>
      (!era || n.era === era) &&
      (!types.length || types.includes(n.type)) &&
      (!s || (n.title + n.summary + n.body.join(" ") + n.date).toLowerCase().includes(s));
  }, [era, types, q]);

  const activeId = hover ?? selected;
  const connected = useMemo(() => {
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    for (const e of ATLAS.edges) { if (e.from === activeId) set.add(e.to); if (e.to === activeId) set.add(e.from); }
    return set;
  }, [activeId]);

  const toggleType = (t: string) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const selNode = selected ? byId.get(selected) ?? null : null;
  const selIdx = selected ? sortedByYear.findIndex((n) => n.id === selected) : -1;

  // คลิกการ์ด (กัน click หลังลากกระดาน)
  const cardClick = (id: string) => {
    if (dragRef.current?.moved) return;
    setSelected(id);
  };

  // เลื่อนกระดานไปยังพิกัด x (ใช้กับ chip ยุค + แถบมหาอำนาจ)
  const jumpToX = (x: number) => {
    const el = boardRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, (x - 100) * zoom), behavior: "smooth" });
  };
  const jumpToEra = (id: string) => {
    const e = ATLAS.eras.find((x) => x.id === id);
    if (e) jumpToX(e.x);
  };

  return (
    <div className="space-y-4">
      {/* หัวหน้า */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">🕵️ Atlas — ห้องพยานหลักฐานโลก 1450-2026</h1>
          <p className="text-sm text-zinc-400 mt-1">
            การส่งไม้ต่อมหาอำนาจ 570 ปี: โปรตุเกส→สเปน→ดัตช์→อังกฤษ→อเมริกา→? · สงครามโลก · การไหลของเงิน · ระบบเงินตรา · The Great Reset — {ATLAS.nodes.length} การ์ด เชื่อมเชือกแดง {ATLAS.edges.length} เส้น คลิกอ่านได้ทุกใบ
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={`btn-ghost !px-3 !py-1.5 !text-xs ${view === "board" ? "!bg-accent/20 !text-accent-soft !border-accent/40" : ""}`} onClick={() => setView("board")}>📌 กระดาน</button>
          <button className={`btn-ghost !px-3 !py-1.5 !text-xs ${view === "list" ? "!bg-accent/20 !text-accent-soft !border-accent/40" : ""}`} onClick={() => setView("list")}>📖 อ่านเรียงเวลา</button>
        </div>
      </div>

      {/* แถบเครื่องมือ */}
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input flex-1 min-w-48 !py-1.5" placeholder="ค้นหาในการ์ด เช่น ทองคำ, Nixon, บาท, devalue..." value={q} onChange={(e) => setQ(e.target.value)} />
          {view === "board" && (
            <div className="flex items-center gap-1">
              <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}>−</button>
              <span className="text-xs text-zinc-500 w-10 text-center num">{Math.round(zoom * 100)}%</span>
              <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)))}>+</button>
              <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => setZoom(0.75)}>รีเซ็ต</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`chip border !text-[11px] ${!era ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700"}`} onClick={() => { setEra(null); if (view === "board") jumpToX(0); }}>ทุกยุค</button>
          {ATLAS.eras.map((e) => (
            <button key={e.id} title={e.name} className={`chip border !text-[11px] num ${era === e.id ? "bg-accent/20 text-accent-soft border-accent/40" : "bg-base-800 text-zinc-400 border-base-700 hover:border-base-500"}`} onClick={() => { setEra(era === e.id ? null : e.id); if (view === "board") jumpToEra(e.id); }}>
              {e.from}–{e.to}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TYPES).map(([t, c]) => {
            const on = types.includes(t);
            const count = ATLAS.nodes.filter((n) => n.type === t).length;
            return (
              <button key={t} className={`chip border !text-[11px] ${on ? "text-zinc-50 border-zinc-400" : "text-zinc-500 border-base-700 hover:border-base-500"}`} style={on ? { backgroundColor: c.color + "26" } : undefined} onClick={() => toggleType(t)}>
                {c.emoji} {c.label} <span className="opacity-60 num">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== กระดานคอร์ก ===== */}
      {view === "board" && (
        <div className="card overflow-hidden">
          {/* แถบการส่งไม้ต่อมหาอำนาจ — สัดส่วนตามพิกัดจริงของกระดาน คลิกเพื่อกระโดดไปยุค */}
          <div className="px-3 pt-3 pb-2">
            <div className="text-[11px] text-zinc-500 mb-1.5">👑 การส่งไม้ต่อมหาอำนาจ-การเงินของโลก (คลิกเพื่อเลื่อนกระดานไปยุคนั้น)</div>
            <div className="flex gap-0.5">
              {HEGEMONS.map((h) => (
                <button
                  key={h.label}
                  title={h.note}
                  className="group relative h-7 rounded-md overflow-hidden text-[10px] font-bold text-black/80 hover:brightness-110 transition-[filter]"
                  style={{ width: `${((h.to - h.x) / ATLAS.meta.boardW) * 100}%`, flex: "0 0 auto", backgroundColor: h.color + "cc" }}
                  onClick={() => jumpToX(h.x)}
                >
                  <span className="absolute inset-0 flex items-center justify-center truncate px-1 group-hover:whitespace-normal">{h.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div
            ref={boardRef}
            className="overflow-auto cursor-grab active:cursor-grabbing"
            style={{ height: "72vh", backgroundColor: "#2b2119" }}
            onPointerDown={(e) => {
              const el = boardRef.current;
              if (!el) return;
              dragRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              const el = boardRef.current;
              if (!d || !el) return;
              const dx = e.clientX - d.x, dy = e.clientY - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
              if (d.moved) { el.scrollLeft = d.sl - dx; el.scrollTop = d.st - dy; }
            }}
            onPointerUp={() => setTimeout(() => (dragRef.current = null), 0)}
            onPointerLeave={() => (dragRef.current = null)}
          >
            <div style={{ width: ATLAS.meta.boardW * zoom, height: ATLAS.meta.boardH * zoom }} className="relative">
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ width: ATLAS.meta.boardW, height: ATLAS.meta.boardH, transform: `scale(${zoom})` }}
              >
                {/* พื้นไม้คอร์ก */}
                <div className="absolute inset-0" style={{ backgroundColor: "#33281e", backgroundImage: "radial-gradient(ellipse 900px 500px at 15% 20%, rgba(120,90,55,.28), transparent), radial-gradient(ellipse 1100px 600px at 70% 75%, rgba(90,65,40,.35), transparent), radial-gradient(rgba(160,120,75,.10) 1.2px, transparent 1.4px), radial-gradient(rgba(20,12,6,.25) 1.6px, transparent 1.8px)", backgroundSize: "auto, auto, 26px 26px, 38px 38px" }} />

                {/* กระเป๋าโบราณศาสตร์เงิน (ซ้ายสุด ไม่ตามสเกลเวลา) */}
                <div className="absolute top-0 bottom-0" style={{ left: ATLAS.meta.ancientX, width: ATLAS.meta.ancientW, background: "linear-gradient(90deg, rgba(234,179,8,.10), rgba(234,179,8,.04))", borderRight: "2px dashed rgba(234,179,8,.4)" }}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-bold tracking-wide text-amber-200/60" style={{ textShadow: "0 1px 2px #000" }}>
                    🏛️ โบราณศาสตร์เงิน
                  </div>
                </div>

                {/* โซน 🔮 ยุคหลัง 2030 (ขวาสุด) */}
                <div className="absolute top-0 bottom-0" style={{ left: ATLAS.meta.zone2X, right: 0, background: "linear-gradient(90deg, rgba(168,85,247,.06), rgba(168,85,247,.14))", borderLeft: "2px dashed rgba(168,85,247,.4)" }}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-bold tracking-wide text-purple-200/60" style={{ textShadow: "0 1px 2px #000" }}>
                    🔮 ยุคหลัง 2030 · AI/AGI (มุมมอง AT)
                  </div>
                </div>

                {/* โซน Reset ขวาสุด */}
                <div className="absolute top-0 bottom-0" style={{ left: ATLAS.meta.zoneX, width: ATLAS.meta.zone2X - ATLAS.meta.zoneX, background: "linear-gradient(90deg, rgba(34,197,94,.05), rgba(34,197,94,.12))", borderLeft: "2px dashed rgba(34,197,94,.35)" }}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-bold tracking-widest text-green-300/60" style={{ textShadow: "0 1px 2px #000" }}>
                    🧭 THE GREAT RESET & โลกหลายขั้ว
                  </div>
                </div>

                {/* เส้นแบ่งยุค + ป้ายชื่อยุค (แนวนอน ตัดความยาวตามช่องว่าง) */}
                {ATLAS.eras.slice(1).map((e, i) => {
                  const nextX = i + 2 < ATLAS.eras.length ? ATLAS.eras[i + 2].x : ATLAS.meta.zoneX;
                  const maxW = Math.max(60, nextX - e.x - 18);
                  const full = `${e.from} · ${e.name}`;
                  const label = maxW < 46 + e.name.length * 7.5 ? String(e.from) : full;
                  return (
                    <div key={e.id} className="absolute top-0 bottom-0" style={{ left: e.x - 14, borderLeft: "1px dashed rgba(245,235,214,.18)" }}>
                      <div
                        className="absolute top-1.5 left-1 whitespace-nowrap overflow-hidden text-ellipsis text-[11px] font-semibold text-amber-100/70 px-1.5 py-0.5 rounded"
                        style={{ maxWidth: maxW, background: "rgba(24,16,9,.72)", textShadow: "0 1px 2px #000" }}
                        title={full}
                      >
                        {label}
                      </div>
                    </div>
                  );
                })}

                {/* เชือกแดง */}
                <svg className="absolute inset-0 pointer-events-none" width={ATLAS.meta.boardW} height={ATLAS.meta.boardH}>
                  {ATLAS.edges.map((e, i) => {
                    const a = byId.get(e.from), b = byId.get(e.to);
                    if (!a || !b) return null;
                    const x1 = a.x + ATLAS.meta.cardW / 2, y1 = a.y + 10;
                    const x2 = b.x + ATLAS.meta.cardW / 2, y2 = b.y + 10;
                    const dist = Math.hypot(x2 - x1, y2 - y1);
                    const sag = Math.min(70, dist * 0.1);
                    const hot = activeId === e.from || activeId === e.to;
                    const dim = (era || types.length || q.trim()) && !(matches(a) && matches(b));
                    const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}`;
                    return (
                      <g key={i}>
                        <path d={d} fill="none" stroke={hot ? "#f87171" : "#a8341f"} strokeWidth={hot ? 3.4 : 2.1} opacity={dim ? 0.05 : hot ? 0.95 : 0.5} />
                        {hot && !dim && (
                          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + sag + 4} textAnchor="middle" fontSize="13" fill="#fecaca" style={{ paintOrder: "stroke", stroke: "#1c130c", strokeWidth: 3 }}>
                            {e.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* การ์ดกระดาษ */}
                {sortedByYear.map((n) => {
                  const t = TYPES[n.type] ?? TYPES.institution;
                  const visible = matches(n);
                  const lit = !connected || connected.has(n.id);
                  return (
                    <button
                      key={n.id}
                      className={`absolute text-left transition-[opacity,transform,box-shadow] duration-150 ${selected === n.id ? "z-30" : "z-20"} ${lit ? "" : "opacity-20"} ${visible ? "" : "opacity-[0.13]"}`}
                      style={{
                        left: n.x, top: n.y, width: ATLAS.meta.cardW,
                        transform: `rotate(${n.rot}deg) ${hover === n.id || selected === n.id ? "scale(1.07)" : "scale(1)"}`,
                        opacity: visible ? (lit ? 1 : 0.25) : 0.12,
                      }}
                      onClick={() => cardClick(n.id)}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {/* หมุด */}
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full z-10" style={{ background: `radial-gradient(circle at 35% 30%, ${t.color}, #00000088 75%)`, boxShadow: "0 2px 3px rgba(0,0,0,.5), inset 0 -2px 3px rgba(0,0,0,.4)" }} />
                      {/* กระดาษ */}
                      <span
                        className="block rounded-[3px] px-2.5 pt-3.5 pb-2"
                        style={{
                          backgroundColor: "#f4ecd8",
                          backgroundImage: "linear-gradient(160deg, #f8f2e2, #eee2c4), repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(120,95,55,.05) 23px)",
                          boxShadow: hover === n.id || selected === n.id ? "6px 10px 18px rgba(0,0,0,.55)" : "3px 5px 9px rgba(0,0,0,.45)",
                          border: "1px solid #d8c9a4",
                          filter: "drop-shadow(0 0 1px rgba(0,0,0,.3))",
                        }}
                      >
                        <span className="block text-[11px] font-bold text-red-800/90 num" style={{ fontFamily: "ui-monospace, monospace" }}>{n.date}</span>
                        <span className="block mt-1 text-[13.5px] leading-snug font-bold text-stone-900" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {n.emoji} {n.title}
                        </span>
                        <span className="mt-1.5 block h-1 rounded-full" style={{ backgroundColor: t.color, opacity: 0.8 }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="px-3 py-2 border-t border-base-700/60 text-[11px] text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>🖱️ ลากเพื่อเลื่อน · คลิกการ์ดเพื่ออ่าน · กระเป๋าซ้ายสุด=โบราณศาสตร์เงิน (ไม่ตามสเกลเวลา)</span>
            <span>เส้นสีแดง = ความเชื่อมโยงเหตุ-ผล (ชี้การ์ดเพื่อเห็นป้ายกำกับ)</span>
            <span>ซ้าย→ขวา = ค.ศ. 1450→2026 · แถบบน=ระบบเงิน กลาง=สงคราม/วิกฤต ล่าง=อำนาจ/สถาบัน · ขวาสุด=Reset</span>
          </div>
        </div>
      )}

      {/* ===== มุมมองอ่านเรียงเวลา ===== */}
      {view === "list" && (
        <div className="space-y-6">
          {ATLAS.eras.map((e) => {
            const list = sortedByYear.filter((n) => n.era === e.id && matches(n));
            if (!list.length) return null;
            return (
              <div key={e.id}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-lg font-bold text-amber-200/90 num">{e.from}–{e.to}</span>
                  <span className="text-sm font-bold text-zinc-100">{e.name}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 mb-3">{e.desc}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((n) => {
                    const t = TYPES[n.type] ?? TYPES.institution;
                    return (
                      <button key={n.id} className="card card-hover p-3.5 text-left" onClick={() => setSelected(n.id)}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="chip !text-[10px] border" style={{ backgroundColor: t.color + "22", color: t.color, borderColor: t.color + "55" }}>{t.emoji} {t.label}</span>
                          <span className="text-[10px] text-zinc-500 num">{n.date}</span>
                        </div>
                        <div className="text-sm font-bold text-zinc-100 leading-snug">{n.emoji} {n.title}</div>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== แผงอ่านเต็ม ===== */}
      {selNode && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSelected(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] bg-base-950 border-l border-base-700 shadow-2xl flex flex-col">
            <NodeReader
              node={selNode}
              era={ATLAS.eras.find((e) => e.id === selNode.era)}
              prev={selIdx > 0 ? sortedByYear[selIdx - 1] : null}
              next={selIdx >= 0 && selIdx < sortedByYear.length - 1 ? sortedByYear[selIdx + 1] : null}
              onClose={() => setSelected(null)}
              onGo={(id) => setSelected(id)}
            />
          </aside>
        </>
      )}

      {/* ท้ายหน้า: เชื่อมกับเครื่องมืออื่น */}
      <div className="card p-4 text-xs text-zinc-400 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-zinc-300 font-bold">เชื่อมต่อต่อ:</span>
        <Link href="/radar" className="link">🌐 Radar เหตุการณ์วันนี้</Link>
        <Link href="/prolens" className="link">🔬 ProLens (AT×PJ)</Link>
        <Link href="/web" className="link">🕸️ แผนผังข่าว</Link>
        <Link href="/stock/GC%3DF" className="link">🥇 ทองคำวันนี้</Link>
        <span className="text-zinc-600 ml-auto">อัปเดตความรู้: แก้ที่ scripts/atlas-src → node scripts/build-atlas.mjs</span>
      </div>
    </div>
  );
}

// ===== แผงอ่านรายการ์ด =====
function NodeReader({ node, era, prev, next, onClose, onGo }: {
  node: AtlasNode; era?: AtlasEra; prev: AtlasNode | null; next: AtlasNode | null;
  onClose: () => void; onGo: (id: string) => void;
}) {
  const t = TYPES[node.type] ?? TYPES.institution;
  const conn = ATLAS.edges.filter((e) => e.from === node.id || e.to === node.id).map((e) => ({ edge: e, other: e.from === node.id ? byId.get(e.to) : byId.get(e.from) }));
  return (
    <>
      <div className="p-4 border-b border-base-700 flex items-start gap-3 bg-base-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="chip !text-[10px] border" style={{ backgroundColor: t.color + "22", color: t.color, borderColor: t.color + "55" }}>{t.emoji} {t.label}</span>
            <span className="text-[10px] text-zinc-500">{era ? `${era.from}–${era.to} · ${era.name}` : ""}</span>
          </div>
          <h2 className="text-lg font-bold text-zinc-50 leading-snug">{node.emoji} {node.title}</h2>
          <div className="text-xs text-zinc-500 mt-1 num">{node.date}</div>
        </div>
        <button className="btn-ghost !px-2.5 !py-1 !text-sm shrink-0" onClick={onClose} aria-label="ปิด">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        <p className="text-zinc-300 leading-relaxed border-l-2 pl-3" style={{ borderColor: t.color }}>{node.summary}</p>

        <div className="space-y-3">
          {node.body.map((p, i) => (
            <p key={i} className="text-zinc-400 leading-relaxed">{p}</p>
          ))}
        </div>

        {(node.wins?.length > 0 || node.loses?.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-300">💹 ผู้ชนะ / 💀 ผู้แพ้ของเหตุการณ์นี้</div>
            <div className="grid gap-2">
              {node.wins.map((w, i) => (
                <AssetRow key={"w" + i} a={w} up />
              ))}
              {node.loses.map((l, i) => (
                <AssetRow key={"l" + i} a={l} />
              ))}
            </div>
          </div>
        )}

        {node.lessons?.length > 0 && (
          <div>
            <div className="text-xs font-bold text-zinc-300 mb-2">📌 บทเรียนนักลงทุน</div>
            <ul className="space-y-2">
              {node.lessons.map((l, i) => (
                <li key={i} className="bg-base-900 border border-base-700/60 rounded-lg px-3 py-2 text-[13px] text-zinc-300 leading-relaxed">{l}</li>
              ))}
            </ul>
          </div>
        )}

        {conn.length > 0 && (
          <div>
            <div className="text-xs font-bold text-zinc-300 mb-2">🧵 เชือกแดงที่โยงถึงการ์ดนี้ ({conn.length})</div>
            <div className="space-y-1.5">
              {conn.map(({ edge, other }, i) => (
                <button key={i} className="w-full text-left bg-base-900 border border-base-700/60 hover:border-red-500/50 rounded-lg px-3 py-2 flex items-center gap-2" onClick={() => other && onGo(other.id)}>
                  <span className="text-red-400">➰</span>
                  <span className="text-[11px] text-zinc-500 flex-1">{edge.label}</span>
                  {other && <span className="text-[12px] text-zinc-200 font-semibold shrink-0">{other.emoji} {other.title}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-base-700 flex items-center justify-between gap-2 bg-base-900/60">
        <button className="btn-ghost !px-3 !py-1.5 !text-xs flex-1 truncate" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
          {prev ? `← ${prev.emoji} ${prev.title.slice(0, 18)}` : "← เริ่มเรื่อง"}
        </button>
        <button className="btn-ghost !px-3 !py-1.5 !text-xs flex-1 truncate text-right" disabled={!next} onClick={() => next && onGo(next.id)}>
          {next ? `${next.title.slice(0, 18)} ${next.emoji} →` : "จบเรื่อง →"}
        </button>
      </div>
    </>
  );
}

function AssetRow({ a, up }: { a: AssetNote; up?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 flex items-start gap-2 border ${up ? "bg-up/5 border-up/25" : "bg-down/5 border-down/25"}`}>
      <span className={`text-xs font-bold ${up ? "text-up" : "text-down"} shrink-0`}>{up ? "▲" : "▼"}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-zinc-200">{a.t}</span>
        {a.d && <span className="text-[11px] text-zinc-500 ml-2">{a.d}</span>}
      </div>
      {a.y && (
        <Link href={`/stock/${encodeURIComponent(a.y)}`} className="chip bg-base-800 border border-base-600 text-zinc-300 !text-[10px] shrink-0 hover:border-accent/50">
          ดู {a.y} →
        </Link>
      )}
    </div>
  );
}
