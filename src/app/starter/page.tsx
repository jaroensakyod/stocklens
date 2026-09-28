"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { StarterProfile, StarterResult } from "@/lib/starterPortfolio";
import type { StarterBtResult } from "@/lib/starterBacktest";
import type { StarterCustomResult } from "@/lib/starterCustom";
import { CUSTOM_THEMES, INTL_REGIONS, type StarterCustomOptions } from "@/lib/customThemes";
import { usePortfolio } from "@/lib/store";

// 🧑‍🎓 พอร์ตตัวอย่างรายวันสำหรับมือใหม่ — 2 โหมด: ⭐ สไตล์สำเร็จ 6 แบบ หรือ 🛠️ ปรับเอง (สัดส่วน/ธีม/เกรด/ซิ่ง)
// (ข้อมูลจากเครื่องยนต์จริง หมุนรายวัน — เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน)

const BUDGETS = [5000, 10000, 50000, 100000];
const KIND_LABEL: Record<string, { label: string; emoji: string }> = {
  etf: { label: "กองทุนดัชนี", emoji: "🧺" },
  dividend: { label: "หุ้นปันผล", emoji: "💰" },
  growth: { label: "หุ้นโตต่อเนื่อง", emoji: "🌱" },
  momentum: { label: "หุ้นน่าสนใจวันนี้", emoji: "🎯" },
  surge: { label: "หุ้นซิ่ง", emoji: "🚀" },
  commodity: { label: "ทองคำ", emoji: "🥇" },
  guru: { label: "หุ้นที่กูรูถือ", emoji: "🐋" },
  cash: { label: "เงินสด", emoji: "💵" },
};

const RISK_COLOR: Record<string, string> = {
  "ต่ำ": "chip bg-emerald-500/10 text-emerald-400 text-[10px]",
  "กลาง": "chip bg-amber-500/10 text-amber-400 text-[10px]",
  "สูง": "chip bg-red-500/10 text-red-400 text-[10px]",
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

// 🤔 คำถาม 3 ข้อช่วยเลือกสไตล์ — client ล้วน ไม่มีถูกผิด แค่จับคู่ "นิสัยคุณ ↔ ความผันผวนที่เหมาะ"
const QUIZ: { q: string; opts: [string, string, string] }[] = [
  { q: "1️⃣ ตั้งใจถือพอร์ตนี้นานแค่ไหน?", opts: ["ไม่ถึง 1 ปี", "1-3 ปี", "3 ปีขึ้นไป"] },
  { q: "2️⃣ ถ้าพอร์ตติดลบ 20% ในช่วงตลาดเสีย คุณจะ…", opts: ["ขายกันเสียก่อน นอนไม่หลับ", "ถือเฉยๆ รอตลาดกลับ", "ยิ่งลงยิ่งซื้อเพิ่ม"] },
  { q: "3️⃣ มีเวลา/ตั้งใจตามข่าวและพอร์ตแค่ไหน?", opts: ["แทบไม่มีเวลาดู", "บางวันเปิดดู", "ทุกวัน ชอบตลาดมาก"] },
];

// ===== 🛠️ ปรับพอร์ตเอง — ตัวเลือก สัดส่วน/จำนวนตัว/ธีม/เกรด/หุ้นซิ่ง =====
type MixKey = "th" | "us" | "fund" | "intl";
type CustomMix = Record<MixKey, number>;
const MIX_SLOTS: { key: MixKey; label: string; emoji: string }[] = [
  { key: "th", label: "หุ้นไทย", emoji: "🇹🇭" },
  { key: "us", label: "หุ้นเมกา", emoji: "🇺🇸" },
  { key: "fund", label: "กองทุน/ETF", emoji: "🧺" },
  { key: "intl", label: "หุ้นประเทศอื่น", emoji: "🌏" },
];
const MIX_PRESETS: { id: string; label: string; mix: CustomMix }[] = [
  { id: "thai", label: "🇹🇭 ไทยล้วน", mix: { th: 100, us: 0, fund: 0, intl: 0 } },
  { id: "us", label: "🇺🇸 เมกาล้วน", mix: { th: 0, us: 100, fund: 0, intl: 0 } },
  { id: "fifty", label: "🇹🇭+🇺🇸 50/50", mix: { th: 50, us: 50, fund: 0, intl: 0 } },
  { id: "fund", label: "🧺 กองทุนล้วน (DCA)", mix: { th: 0, us: 0, fund: 100, intl: 0 } },
  { id: "world", label: "🌐 กระจายทั่วโลก", mix: { th: 15, us: 40, fund: 25, intl: 20 } },
  { id: "core", label: "🛰️ Core-Satellite", mix: { th: 15, us: 25, fund: 60, intl: 0 } },
];
const COUNT_OPTS = [3, 5, 8, 10, 12];
const GRADE_OPTS: { id: StarterCustomOptions["minGrade"]; label: string }[] = [
  { id: "all", label: "ทุกเกรด" },
  { id: "AAA", label: "AAA เท่านั้น" },
  { id: "AA", label: "AA ขึ้นไป" },
  { id: "A", label: "A ขึ้นไป" },
  { id: "B", label: "B ขึ้นไป" },
];
const CUSTOM_DEFAULTS: StarterCustomOptions = {
  mix: { th: 20, us: 40, fund: 25, intl: 15 },
  count: 5,
  themes: [],
  regions: [],
  minGrade: "all",
  momentum: false,
};
const CUSTOM_LS = "sl-starter-custom";

export default function StarterPage() {
  const [data, setData] = useState<StarterResult | null>(null);
  const [risk, setRisk] = useState<StarterProfile["id"]>("balance");
  const [budget, setBudget] = useState(10000);
  // ทบต้น: rate override (null = ใช้ค่า default จากพอร์ตที่เลือก) + การเพิ่มเงินประจำ
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [contribMode, setContribMode] = useState<"none" | "week" | "month" | "year">("month");
  const [contrib, setContrib] = useState(1000);
  // 🤔 quiz เลือกสไตล์ + ปุ่มส่งพอร์ตเข้า "พอร์ตของฉัน"
  const [quizOpen, setQuizOpen] = useState(false);
  const [quiz, setQuiz] = useState<{ q1?: number; q2?: number; q3?: number }>({});
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const { holdings, setHoldings } = usePortfolio();
  // 🕰️ ไทม์แมชชีนของพอร์ตนี้ — ย้อนหลังจากราคาจริงของทุกตำแหน่ง
  const [bt, setBt] = useState<StarterBtResult | null>(null);
  const [btBusy, setBtBusy] = useState(false);
  const [btYears, setBtYears] = useState(5);
  // 🛠️ ปรับพอร์ตเอง: โหมด + ตัวเลือก (จำใน localStorage) + ผลลัพธ์
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [cOpts, setCOpts] = useState<StarterCustomOptions>(CUSTOM_DEFAULTS);
  const [customRes, setCustomRes] = useState<StarterCustomResult | null>(null);
  const [customBusy, setCustomBusy] = useState(false);
  const [customErr, setCustomErr] = useState<string | null>(null);
  // 🧠 โหมด Jev: โจทย์ภาษาอิสระ + สถานะ busy + ชั้นข้อมูล AI ของผลลัพธ์ล่าสุด
  const [brief, setBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState<StarterCustomResult["ai"] | null>(null);

  useEffect(() => {
    fetch("/api/starter")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  // โหลดตัวเลือกที่บันทึกไว้ + บันทึกทุกครั้งที่แก้ (รอโหลดเสร็จก่อนจึงบันทึก กันทับค่าเก่าด้วย default ตอน mount)
  const [optsReady, setOptsReady] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_LS) || "null");
      if (raw && typeof raw === "object") {
        setCOpts({ ...CUSTOM_DEFAULTS, ...raw, mix: { ...CUSTOM_DEFAULTS.mix, ...(raw.mix ?? {}) } });
        if (typeof raw.brief === "string") setBrief(raw.brief.slice(0, 300));
      }
    } catch {
      /* เริ่มด้วยค่า default */
    }
    setOptsReady(true);
  }, []);
  useEffect(() => {
    if (!optsReady) return;
    try {
      localStorage.setItem(CUSTOM_LS, JSON.stringify({ ...cOpts, brief }));
    } catch {}
  }, [cOpts, brief, optsReady]);

  // สลับพอร์ต/โหมด → รีเซ็ตอัตราโตกลับไปใช้ default ของพอร์ตใหม่
  useEffect(() => {
    setRateOverride(null);
  }, [risk, mode, customRes]);

  const presetProfile = useMemo(() => data?.profiles.find((p) => p.id === risk), [data, risk]);
  const profile = mode === "custom" ? customRes?.profile ?? null : presetProfile;
  const yearlyDiv = profile?.stats.yieldPerYearPct != null ? (budget * profile.stats.yieldPerYearPct) / 100 : null;

  // ===== 🤔 quiz → สไตล์ที่เหมาะ (คะแนนรวม + กติกากันพลาด: ขายตอนติดลบ = ต้องผันผวนต่ำสุด / ไม่มีเวลาดู = ไม่เกินสมดุล) =====
  const recommend = useMemo(() => {
    if (quiz.q1 === undefined || quiz.q2 === undefined || quiz.q3 === undefined) return null;
    const sum = quiz.q1 + quiz.q2 + quiz.q3;
    let id: StarterProfile["id"] = sum <= 1 ? "calm" : sum <= 3 ? "balance" : sum <= 5 ? "grow" : "tech";
    let why: string;
    if (quiz.q2 === 0) {
      id = "calm";
      why = "คุณบอกว่าพอร์ตติดลบ 20% จะขายกันเสียก่อน — พอร์ตความผันผวนต่ำช่วยไม่ให้ต้องเจอจังหวะตัดสินใจแบบนั้น";
    } else if (quiz.q3 === 0 && (id === "grow" || id === "tech")) {
      id = "balance";
      why = "คุณบอกว่าแทบไม่มีเวลาตามพอร์ต — สไตล์ที่ต้องเฝ้าระวังจึงยังไม่เหมาะ เริ่มจากพอร์ตสมดุลก่อน";
    } else if (id === "calm") {
      why = "คุณเลือกทุกข้อแบบระวังตัว — สายปันผล นอนหลับสบาย คือแบบของคุณ";
    } else if (id === "balance") {
      why = "คุณอยู่กึ่งกลาง: อยากโตแต่ยังไม่อยากเสี่ยงจัด — พอร์ตสมดุลเหมาะกับจุดเริ่มต้น";
    } else if (id === "grow") {
      why = "คุณรับความเสี่ยงได้และมีเวลาตามบ้าง — พอร์ตเติบโตเหมาะกว่า";
    } else {
      why = "คุณทนความผันผวนสูงได้และตามตลาดทุกวัน — สายเติบโต/เทคเร้าใจที่สุดสำหรับคุณ";
    }
    return { id, why };
  }, [quiz]);
  const recId = recommend?.id;
  useEffect(() => {
    if (recId) setRisk(recId);
  }, [recId]);

  // ===== 🛠️ เลื่อนสไลเดอร์สัดส่วน: แท่งที่เหลือปรับตามสัดส่วนเดิมให้รวมเป็น 100% เสมอ =====
  function setMixSlot(key: MixKey, val: number) {
    const v = Math.max(0, Math.min(100, Math.round(val)));
    const others = MIX_SLOTS.map((s) => s.key).filter((k) => k !== key);
    const restTarget = 100 - v;
    const restCur = others.reduce((a, k) => a + cOpts.mix[k], 0);
    const next: CustomMix = { ...cOpts.mix, [key]: v };
    if (restCur === 0) {
      next[others[0]] = restTarget;
    } else {
      for (const k of others) next[k] = Math.round((restTarget * cOpts.mix[k]) / restCur);
      const drift = restTarget - others.reduce((a, k) => a + next[k], 0);
      const big = [...others].sort((a, b) => next[b] - next[a])[0];
      next[big] = Math.max(0, next[big] + drift);
    }
    setCOpts({ ...cOpts, mix: next });
  }
  const toggleIn = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  // ===== ✨ ประกอบพอร์ตจากตัวเลือกของผู้ใช้ (engine บน server) =====
  function buildCustom() {
    setCustomBusy(true);
    setCustomErr(null);
    setAiInfo(null);
    fetch("/api/starter-custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cOpts),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "สร้างพอร์ตไม่สำเร็จ");
        return j as StarterCustomResult;
      })
      .then((j) => setCustomRes(j))
      .catch((e) => setCustomErr(e instanceof Error ? e.message : "สร้างพอร์ตไม่สำเร็จ — ลองอีกครั้ง"))
      .finally(() => setCustomBusy(false));
  }

  // ===== 🧠 ให้ Jev จัดให้ — Jev คัดตัวจากคลังจริง + AI เขียนวิเคราะห์ (ใช้ตัวเลือกชุดเดียวกัน + โจทย์ brief) =====
  function buildCustomAI() {
    setAiBusy(true);
    setCustomErr(null);
    fetch("/api/starter-custom-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cOpts, brief }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Jev จัดพอร์ตไม่สำเร็จ");
        return j as StarterCustomResult;
      })
      .then((j) => {
        setCustomRes(j);
        setAiInfo(j.ai ?? null);
      })
      .catch((e) => setCustomErr(e instanceof Error ? e.message : "Jev จัดพอร์ตไม่สำเร็จ — ลองอีกครั้ง หรือใช้ปุ่มประกอบด้วยเครื่องยนต์ก่อน"))
      .finally(() => setAiBusy(false));
  }

  // สลับมาแท็บปรับเองครั้งแรก → ประกอบให้เลยด้วยตัวเลือกปัจจุบัน (ไม่ต้องรอกดเอง)
  const customTouched = useRef(false);
  useEffect(() => {
    if (mode === "custom" && !customTouched.current) {
      customTouched.current = true;
      buildCustom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ===== ➕ ส่งพอร์ตนี้เข้า "พอร์ตของฉัน" (localStorage) — ตัวที่ถืออยู่แล้วรวมจำนวน + ต้นทุนเฉลี่ยถ่วงน้ำหนัก =====
  function addToPortfolio() {
    if (!profile) return;
    const next = holdings.map((h) => ({ ...h }));
    let added = 0;
    for (const p of profile.positions) {
      if (!p.priceThb || !p.priceLocal || p.priceLocal <= 0) continue;
      const units = (budget * p.weight) / 100 / p.priceThb;
      const qty = p.unitThb ? Math.floor(units) : Math.round(units * 1000) / 1000;
      if (!(qty > 0)) continue;
      const prev = next.find((h) => h.ticker === p.symbol);
      if (prev) {
        const total = prev.qty + qty;
        prev.avgCost = Math.round(((prev.avgCost * prev.qty + p.priceLocal * qty) / total) * 100) / 100;
        prev.qty = Math.round(total * 1000) / 1000;
      } else {
        next.push({ ticker: p.symbol, qty, avgCost: p.priceLocal });
      }
      added++;
    }
    setHoldings(next);
    setAddedMsg(added ? `✅ เพิ่ม ${added} ตำแหน่งแล้ว` : "ราคายังไม่พร้อม — ลองอีกครั้งหลังตารางโหลดเสร็จ");
  }

  // ===== 🕰️ ไทม์แมชชีน: ดึงผลย้อนหลังของพอร์ตที่เลือก (ราคาจริงของทุกตำแหน่ง) =====
  const profileId = profile?.id;
  const profilePositions = profile?.positions;
  useEffect(() => {
    const positions = (profilePositions ?? []).filter((p) => p.priceLocal).map((p) => ({ symbol: p.symbol, weight: p.weight, kind: p.kind }));
    if (!positions.length) return;
    let alive = true;
    setBtBusy(true);
    setBt(null);
    fetch("/api/starter-backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: StarterBtResult) => alive && setBt(j))
      .catch(() => {})
      .finally(() => alive && setBtBusy(false));
    return () => {
      alive = false;
    };
  }, [profileId, profilePositions]);

  // ถ้าช่วงที่เลือกไว้ไม่มีข้อมูล (พอร์ตนี้ประวัติสั้น) → ขยับไปช่วงยาวสุดที่มี
  useEffect(() => {
    if (bt && !bt.marks.some((m) => m.years === btYears && m.available)) {
      const best = bt.marks.filter((m) => m.available).slice(-1)[0];
      if (best) setBtYears(best.years);
    }
  }, [bt, btYears]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero สำหรับคนไม่รู้อะไรเลย */}
      <section className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-50">
          🧑‍🎓 พอร์ตตัวอย่างรายวัน <span className="text-accent">สำหรับมือใหม่</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm leading-relaxed max-w-2xl mx-auto">
          ไม่รู้เรื่องหุ้นเลย? เลือก <b className="text-zinc-200">งบ</b> กับ <b className="text-zinc-200">สไตล์ 6 แบบ</b>{" "}
          หรือสลับไปแท็บ <b className="text-zinc-200">🛠️ ปรับเอง</b> — สัดส่วนไทย/เมกา/กองทุน/ต่างประเทศ จำนวนตัว
          ธีมที่สนใจ เกรดขั้นต่ำ และจะเติมหุ้นซิ่งไหม — เราจัดสัดส่วนให้จากข้อมูลจริงของวันนี้
          พร้อมเหตุผลกำกับทุกตัว ปันผลคาดหมาย ผลตอบแทนย้อนหลัง และสัดส่วนความเสี่ยงของพอร์ต
        </p>
        {data && (
          <p className="text-[11px] text-zinc-500 mt-2">
            ข้อมูลวันที่ {data.dateTh} · คำนวณล่าสุด {data.asOf}
          </p>
        )}
      </section>

      {/* แท็บโหมด: ⭐ สไตล์สำเร็จ | 🛠️ ปรับพอร์ตเอง */}
      <div className="flex gap-2 justify-center">
        {(
          [
            ["preset", "⭐ สไตล์สำเร็จ 6 แบบ"],
            ["custom", "🛠️ ปรับพอร์ตเอง"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`chip !text-sm !px-4 !py-2 ${mode === m ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 🛠️ โหมดปรับเอง — แผงตัวเลือก */}
      {mode === "custom" && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-1">1️⃣🛠️ ปรับพอร์ตเอง — เลือกสัดส่วน ธีม จำนวนตัว แล้วเราจัดให้</h2>
          <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
            ปรับได้ทั้งหมด: สัดส่วนตลาด · จำนวนตัว · ธีมที่สนใจ · เกรดขั้นต่ำ · เติมหุ้นซิ่ง — งบ สถิติ ทบต้น และไทม์แมชชีนด้านล่างใช้ร่วมกับโหมดสไตล์สำเร็จ
          </p>
          <div className="card p-4 space-y-5">
            {/* สัดส่วน — พรีเซ็ต + สไลเดอร์ 4 แท่ง */}
            <div>
              <div className="text-xs text-zinc-300 font-semibold mb-2">สัดส่วนสินทรัพย์ (ปรับแล้วรวม 100% เสมอ)</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {MIX_PRESETS.map((p) => {
                  const on = MIX_SLOTS.every((s) => p.mix[s.key] === cOpts.mix[s.key]);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setCOpts({ ...cOpts, mix: { ...p.mix } })}
                      className={`chip ${on ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                {MIX_SLOTS.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">
                        {s.emoji} {s.label}
                      </span>
                      <span className="num font-bold text-accent">{cOpts.mix[s.key]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={cOpts.mix[s.key]}
                      onChange={(e) => setMixSlot(s.key, Number(e.target.value))}
                      className="w-full mt-1 accent-[var(--accent,#f5b340)]"
                      aria-label={`สัดส่วน ${s.label} (%)`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* จำนวนตัว */}
            <div>
              <div className="text-xs text-zinc-300 font-semibold mb-2">อยากถือกี่ตัว?</div>
              <div className="flex flex-wrap gap-2">
                {COUNT_OPTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCOpts({ ...cOpts, count: n })}
                    className={`chip num ${cOpts.count === n ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}
                  >
                    {n} ตัว
                  </button>
                ))}
                <span className="text-[10px] text-zinc-600 self-center ml-1">มือใหม่แนะนำ 5-8 ตัว — กระจายพอโดยไม่ต้องตามเยอะ</span>
              </div>
            </div>

            {/* ธีม */}
            <div>
              <div className="text-xs text-zinc-300 font-semibold mb-1">สนใจแนวไหน? (เลือกได้หลายธีม · ไม่เลือก = ไม่จำกัด)</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {CUSTOM_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCOpts({ ...cOpts, themes: toggleIn(cOpts.themes, t.id) })}
                    className={`chip ${cOpts.themes.includes(t.id) ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">ธีมใช้กับหุ้นไทย+เมกา · บางธีม (อวกาศ กลาโหม ทอง) ยังไม่มีหุ้นไทย — ระบบจะเติมหุ้นไทยทั่วไปแทนและบอกในหมายเหตุใต้ปุ่มประกอบ</p>
            </div>

            {/* ภูมิภาคหุ้นนอก — แสดงเมื่อสัดส่วน 🌏 > 0 */}
            {cOpts.mix.intl > 0 && (
              <div>
                <div className="text-xs text-zinc-300 font-semibold mb-1">🌏 หุ้นประเทศอื่น — เลือกภูมิภาค (ไม่เลือก = กระจาย 4 ภูมิภาคหลัก)</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {INTL_REGIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setCOpts({ ...cOpts, regions: toggleIn(cOpts.regions, r.id) })}
                      className={`chip ${cOpts.regions.includes(r.id) ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
                    >
                      {r.flag} {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5">
                  แต่ละภูมิภาคประกอบจาก ETF ดัชนีประเทศ + หุ้นใหญ่รายประเทศที่ซื้อในตลาดเมกาเป็นดอลลาร์ (ADR) — ไม่ต้องเปิดบัญชีที่ประเทศนั้น
                </p>
              </div>
            )}

            {/* เกรดขั้นต่ำ */}
            <div>
              <div className="text-xs text-zinc-300 font-semibold mb-1">เกรดขั้นต่ำ (เกรด StockLens ของเว็บเรา — AAA ดีสุด)</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {GRADE_OPTS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setCOpts({ ...cOpts, minGrade: g.id })}
                    className={`chip ${cOpts.minGrade === g.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {cOpts.minGrade !== "all" && (
                <p className="text-[10px] text-amber-400/80 mt-1.5">
                  เปิดกรองเกรด = คำนวณคะแนน 6 เสาใหม่ ครั้งแรกใช้ ~20-40 วิ (ครั้งต่อไปเร็วเพราะ cache) · เกรดนี้เป็นระบบของ StockLens ไม่ใช่เกรดทางการเช่น SET ESG หรือเครดิตเรตติ้ง
                </p>
              )}
            </div>

            {/* หุ้นซิ่ง */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-300 font-semibold">🚀 เติมหุ้นซิ่ง/หุ้นเด่นวันนี้ ~10%</div>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">
                  จากเรดาร์หุ้นซิ่ง + Daily Picks ของวัน — ความเสี่ยงสูง เหมาะเฉพาะเงินที่เสียได้ไม่เจ็บ
                </p>
              </div>
              <button
                onClick={() => setCOpts({ ...cOpts, momentum: !cOpts.momentum })}
                className={`chip whitespace-nowrap ${cOpts.momentum ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-base-800 text-zinc-400 border border-base-700"}`}
                aria-pressed={cOpts.momentum}
              >
                {cOpts.momentum ? "เปิดอยู่ 🚀" : "ปิดอยู่"}
              </button>
            </div>

            {/* ปุ่มประกอบ 2 โหมด + โจทย์ให้ Jev + หมายเหตุของผลลัพธ์ */}
            <div className="pt-3 border-t border-base-700/60 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={buildCustomAI} disabled={aiBusy || customBusy} className="btn-primary whitespace-nowrap">
                  {aiBusy ? "🧠 Jev กำลังคิด…" : "🧠 ให้ Jev จัด + วิเคราะห์ให้"}
                </button>
                <button onClick={buildCustom} disabled={customBusy || aiBusy} className="btn-ghost whitespace-nowrap">
                  {customBusy ? "⏳ กำลังประกอบ…" : "⚙️ ประกอบด้วยเครื่องยนต์"}
                </button>
                {customRes && !customBusy && !aiBusy && (
                  <span className="text-[11px] text-zinc-500">คำนวณล่าสุด {customRes.asOf} · ปรับตัวเลือกแล้วกดประกอบใหม่ได้เลย</span>
                )}
              </div>
              <div>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value.slice(0, 300))}
                  placeholder={'เล่าเพิ่มให้ Jev ฟัง (ไม่บังคับ) เช่น "กลัวขาดทุน เน้นปันผล อยากมีทองนิดๆ"'}
                  rows={2}
                  maxLength={300}
                  className="input w-full !py-2 text-sm"
                  aria-label="โจทย์เพิ่มเติมสำหรับ Jev"
                />
                <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                  ใช้ตัวเลือกชุดเดียวกันด้านบน — Jev คัดหุ้นจากคลังจริงของวัน แล้ว AI เขียนเหตุผลภาษามือใหม่ แล้ว Jev ตรวซ้ำอีกรอบ (~10-40 วิ ครั้งแรก)
                </p>
              </div>
            </div>
            {(customBusy || aiBusy) && (
              <p className="text-xs text-zinc-500 animate-pulse">
                {aiBusy ? "🧠 Jev กำลังคัดหุ้น และ AI กำลังเขียนวิเคราะห์จากข้อมูลจริงของวัน…" : "กำลังดึงราคา/คะแนนจริงของวันนี้มาจัดพอร์ต…"}
              </p>
            )}
            {customErr && <p className="text-xs text-down">{customErr}</p>}
            {customRes && customRes.notes.length > 0 && (
              <div className="space-y-1">
                {customRes.notes.map((n, i) => (
                  <p key={i} className="text-[11px] text-zinc-400 leading-relaxed">
                    {n}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 🧠 การ์ดวิเคราะห์จาก Jev+AI ของพอร์ตที่เพิ่งจัด */}
          {aiInfo && (aiInfo.summary || aiInfo.jevCheck) && (
            <div className="card p-4 mt-3 border-accent/40 !bg-accent/5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="chip bg-accent text-zinc-950 text-[10px]">🧠 Jev คัดตัว · AI วิเคราะห์</span>
                {aiInfo.engine === "rules" && <span className="chip bg-base-800 text-zinc-400 text-[10px]">วันนี้ AI ไม่ว่าง — ผลจากเครื่องยนต์กฎ</span>}
              </div>
              {aiInfo.summary && <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{aiInfo.summary}</p>}
              {aiInfo.jevCheck && <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{aiInfo.jevCheck}</p>}
              <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                Jev คัดหุ้นจากคลังจริงของวัน · น้ำหนักตามสัดส่วนที่คุณเลือกเอง · เหตุผลอ้างข้อมูลที่ให้เท่านั้น — เป็นตัวอย่างเพื่อการเรียนรู้ ไม่ใช่คำแนะนำการลงทุน
              </p>
            </div>
          )}
        </section>
      )}

      {/* เลือกสไตล์ — 6 แบบ */}
      {mode === "preset" && (
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">1️⃣ เลือกสไตล์ของคุณ (6 แบบ)</h2>

        {/* 🤔 ยังไม่รู้จะเลือกไหน — ตอบ 3 ข้อ เราเลือกให้ */}
        <div className="card p-4 mb-3">
          <button onClick={() => setQuizOpen(!quizOpen)} className="text-sm font-bold text-accent hover:text-accent-soft">
            🤔 ยังไม่รู้จะเลือกสไตล์ไหน? ตอบ 3 ข้อ — เราเลือกให้ {quizOpen ? "▾" : "▸"}
          </button>
          {quizOpen && (
            <div className="space-y-4 mt-3">
              {QUIZ.map((row, qi) => {
                const key = `q${qi + 1}` as "q1" | "q2" | "q3";
                return (
                  <div key={key}>
                    <div className="text-xs text-zinc-300 font-semibold mb-2">{row.q}</div>
                    <div className="flex flex-wrap gap-2">
                      {row.opts.map((opt, oi) => (
                        <button
                          key={opt}
                          onClick={() => setQuiz({ ...quiz, [key]: oi })}
                          className={`chip ${quiz[key] === oi ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {recommend && (
                <div className="card !bg-accent/5 !border-accent/40 p-3">
                  <div className="text-sm font-bold text-accent">
                    ⭐ เหมาะกับคุณ: {data?.profiles.find((p) => p.id === recommend.id)?.emoji} {data?.profiles.find((p) => p.id === recommend.id)?.title}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{recommend.why}</p>
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    (เลือกให้แล้วด้านล่าง — ถ้าชอบ 🇹🇭 ไทย หรือ 🐋 ตามรอยบัฟเฟต์ มากกว่า กดเลือกเองได้เลย)
                  </p>
                </div>
              )}
              {!recommend && <p className="text-[11px] text-zinc-600">ตอบครบ 3 ข้อแล้วเราจะไฮไลต์สไตล์ที่เหมาะกับคุณทันที</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(data?.profiles ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setRisk(p.id)}
              className={`card p-3.5 text-left transition-colors ${risk === p.id ? "!border-accent bg-accent/5" : "hover:border-base-600"}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="text-xl">{p.emoji}</div>
                {recId === p.id && recommend && <span className="chip bg-accent text-zinc-950 text-[10px]">⭐ เหมาะกับคุณ</span>}
              </div>
              <div className={`font-bold text-sm mt-1 ${risk === p.id ? "text-accent" : "text-zinc-100"}`}>{p.title}</div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{p.desc}</div>
            </button>
          ))}
          {!data && (
            <div className="card p-8 text-center text-zinc-500 text-sm col-span-2 md:col-span-3">
              <span className="animate-pulse">กำลังคำนวณพอร์ตจากข้อมูลวันนี้…</span>
            </div>
          )}
        </div>
      </section>
      )}

      {/* เลือกงบ — chips + slider + พิมพ์เอง */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">2️⃣ มีเงินก้อนแรกเท่าไหร่? (บาท)</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              className={`chip ${budget === b ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"} num`}
            >
              ฿{baht(b)}
            </button>
          ))}
          <input
            type="number"
            min={100}
            step={500}
            value={budget}
            onChange={(e) => setBudget(Math.max(100, Number(e.target.value) || 0))}
            className="input num !w-36"
            aria-label="งบประมาณ (บาท)"
          />
        </div>
        <input
          type="range"
          min={1000}
          max={1000000}
          step={1000}
          value={Math.min(Math.max(budget, 1000), 1000000)}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full mt-3 accent-[var(--accent,#f5b340)]"
          aria-label="เลื่อนปรับงบประมาณ"
        />
        {budget < 1000 && <p className="text-[11px] text-amber-400 mt-1">เริ่มจริงได้จากหลักร้อย (เศษหุ้น Dime เริ่ม 50฿) แต่แนะนำ ≥1,000฿ ให้กระจายพอ</p>}
      </section>

      {/* สถิติพอร์ตรวม — เห็นภาพก่อนดูตาราง */}
      {profile && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3">
            3️⃣ ภาพรวมพอร์ต {profile.emoji} {profile.title} · งบ ฿{baht(budget)}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ปันผลคาดหมาย/ปี</div>
              <div className="num text-lg font-bold text-accent">{yearlyDiv != null ? `~฿${baht(yearlyDiv)}` : "-"}</div>
              <div className="text-[10px] text-zinc-500">{profile.stats.yieldPerYearPct != null ? `${profile.stats.yieldPerYearPct.toFixed(1)}% ของงบ` : "จาก yield จริงของหุ้นในพอร์ต"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ผลตอบแทน 5 ปีเฉลี่ย (ราคาล้วน)</div>
              <div className="num text-lg font-bold text-zinc-50">{profile.stats.avgCagr5yPct != null ? `${profile.stats.avgCagr5yPct.toFixed(1)}%/ปี` : "-"}</div>
              <div className="text-[10px] text-zinc-500">อดีตไม่รับประกันอนาคต</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">สัดส่วนตลาด</div>
              <div className="text-lg font-bold text-zinc-50">
                🇺🇸 {profile.stats.usPct}% <span className="text-zinc-600">|</span> 🇹🇭 {profile.stats.thPct}%
                {profile.stats.intlPct > 0 && (
                  <>
                    {" "}
                    <span className="text-zinc-600">|</span> 🌏 {profile.stats.intlPct}%
                  </>
                )}
              </div>
              <div className="text-[10px] text-zinc-500">{profile.stats.intlPct > 0 ? "ต่างประเทศซื้อเป็น USD (ADR/ETF) ผ่านบัญชีเมกา" : "สหรัฐฯ ซื้อเป็นบาทผ่าน Dime ได้"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-zinc-500">ความเสี่ยงพอร์ต</div>
              <div className="text-sm font-bold mt-1 space-x-1">
                <span className="text-emerald-400">ต่ำ {profile.stats.riskLow}%</span>{" "}
                <span className="text-amber-400">กลาง {profile.stats.riskMid}%</span>{" "}
                <span className="text-red-400">สูง {profile.stats.riskHigh}%</span>
              </div>
              <div className="text-[10px] text-zinc-500">+ เงินสด {profile.cashPct}%</div>
            </div>
            <div className="card p-3 col-span-2 md:col-span-1">
              <div className="text-[10px] text-zinc-500">แนะนำการลงเงิน</div>
              <div className="num text-lg font-bold text-zinc-50">฿{baht(Math.max(500, Math.round(budget / 12 / 100) * 100))}<span className="text-xs text-zinc-500 font-normal">/เดือน</span></div>
              <div className="text-[10px] text-zinc-500">ทยอยลง 12 เดือน (DCA) เฉลี่ยราคาให้เอง</div>
            </div>
          </div>
        </section>
      )}

      {/* ตารางจัดสรรละเอียด */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">4️⃣ รายละเอียดทุกตำแหน่ง — ซื้ออะไร เท่าไหร่ ทำไม</h2>
        {profile && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                  <th className="py-2 px-3">ตัวที่ซื้อ + ตัวเลขสำคัญ</th>
                  <th className="py-2 px-3 text-right">สัดส่วน</th>
                  <th className="py-2 px-3 text-right">ใช้เงิน</th>
                  <th className="py-2 px-3 text-right">ราคา/หน่วย</th>
                  <th className="py-2 px-3 text-right">ได้กี่หุ้น</th>
                  <th className="py-2 px-3">ความเสี่ยง</th>
                </tr>
              </thead>
              <tbody>
                {profile.positions.map((p) => {
                  const money = (budget * p.weight) / 100;
                  const units = p.priceThb ? money / p.priceThb : null;
                  const facts: string[] = [];
                  if (p.grade) facts.push(`เกรด ${p.grade}${p.scoreTotal != null ? ` · ${p.scoreTotal}/100` : ""}`);
                  if (p.pe != null) facts.push(`P/E ${p.pe.toFixed(1)}`);
                  if (p.yieldPct != null) facts.push(`ปันผล ${p.yieldPct.toFixed(1)}%/ปี`);
                  if (p.roePct != null) facts.push(`ROE ${p.roePct.toFixed(0)}%`);
                  if (p.health != null) facts.push(`งบแข็งแรง ${p.health}/100`);
                  if (p.cagr5yPct != null) facts.push(`5 ปี ${p.cagr5yPct.toFixed(1)}%/ปี`);
                  if (p.guruPct != null) facts.push(`บัฟเฟต์ถือ ${p.guruPct.toFixed(1)}%${p.guruChange ? ` (${p.guruChange})` : ""}`);
                  return (
                    <tr key={p.symbol} className="border-b border-base-700/50 align-top">
                      <td className="py-2.5 px-3">
                        <Link href={`/stock/${p.symbol}`} className="font-semibold text-zinc-100 hover:text-accent">
                          {p.symbol}
                        </Link>
                        <span className="text-zinc-500 text-xs ml-2">{p.name}</span>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {KIND_LABEL[p.kind].emoji} {KIND_LABEL[p.kind].label}
                          {` · ${p.flag ?? (p.market === "TH" ? "🇹🇭" : "🇺🇸")}`}
                          {p.changePct !== null && (
                            <span className={p.changePct >= 0 ? "text-up ml-1 num" : "text-down ml-1 num"}>
                              {p.changePct >= 0 ? "+" : ""}
                              {p.changePct.toFixed(2)}% วันนี้
                            </span>
                          )}
                        </div>
                        {facts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {facts.map((f) => (
                              <span key={f} className="chip bg-base-800 text-zinc-400 text-[10px] num">{f}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed max-w-md">{p.reason}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right num text-zinc-200">{p.weight}%</td>
                      <td className="py-2.5 px-3 text-right num text-accent font-semibold">฿{baht(money)}</td>
                      <td className="py-2.5 px-3 text-right num text-zinc-400">{p.priceThb ? `฿${baht(p.priceThb)}` : "-"}</td>
                      <td className="py-2.5 px-3 text-right num text-zinc-400">
                        {units === null
                          ? "-"
                          : p.unitThb
                            ? `${Math.floor(units)} หุ้น${units % 1 > 0.01 ? ` (เศษ ฿${baht((units % 1) * (p.priceThb ?? 0))})` : ""}`
                            : `~${units.toFixed(units < 2 ? 3 : 1)} หุ้น (เศษได้)`}
                      </td>
                      <td className="py-2.5 px-3"><span className={RISK_COLOR[p.risk]}>{p.risk}</span></td>
                    </tr>
                  );
                })}
                <tr className="border-b-0">
                  <td className="py-2.5 px-3 font-semibold text-zinc-300">💵 เงินสด (รอจังหวะดีค่อยลง)</td>
                  <td className="py-2.5 px-3 text-right num text-zinc-200">{profile.cashPct}%</td>
                  <td className="py-2.5 px-3 text-right num text-zinc-300">฿{baht((budget * profile.cashPct) / 100)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ➕ ส่งต่อ: พอร์ตตัวอย่าง → "พอร์ตของฉัน" (ต้นทุนตั้งต้น = ราคาปัจจุบัน แก้ไขได้ที่หน้าพอร์ต) */}
        {profile && (
          <div className="card p-4 mt-3 border-accent/30 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-bold text-zinc-100">ถูกใจพอร์ตนี้? เอาไปต่อที่ &ldquo;พอร์ตของฉัน&rdquo;ได้เลย</div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                ทุกตำแหน่ง (ตามงบ ฿{baht(budget)} และน้ำหนักในตาราง) จะถูกบันทึกเข้าพอร์ตของคุณ — ต้นทุนตั้งต้น = ราคาปัจจุบัน
                แก้ไข/ลบ/ติดดุม 📌 หุ้นแกน และให้ AI ช่วยปรับต่อได้ที่หน้าพอร์ต · ไม่รวมส่วนเงินสด {profile.cashPct}%
              </div>
            </div>
            <button onClick={addToPortfolio} className="btn-primary whitespace-nowrap">➕ เพิ่มลงพอร์ตของฉัน</button>
            {addedMsg && (
              <span className="text-xs text-up">
                {addedMsg} · <Link href="/portfolio" className="link">ไปดูพอร์ตของฉัน →</Link>
              </span>
            )}
          </div>
        )}
      </section>

      {/* ทบต้น — รายสัปดาห์·เดือน·ปี จนถึง 30 ปี */}
      {profile && (() => {
        const defRate = profile.stats.avgCagr5yPct != null
          ? Math.min(25, Math.max(1, Math.round(((profile.stats.avgCagr5yPct ?? 0) + (profile.stats.yieldPerYearPct ?? 0)) * 10) / 10))
          : 8;
        const rate = rateOverride ?? defRate;
        // จำลอง 2 เส้นรายสัปดาห์: (ทบต้น) vs (ดอกเบี้ยเฉพาะเงินต้น = ไม่เอาดอกเบี้ยงอกดอกเบี้ย)
        const i = Math.pow(1 + rate / 100, 1 / 52) - 1;
        const weeklyC = contribMode === "week" ? contrib : contribMode === "month" ? (contrib * 12) / 52 : contribMode === "year" ? contrib / 52 : 0;
        const MARKS: [number, string][] = [
          [4, "1 เดือน"], [13, "3 เดือน"], [26, "6 เดือน"], [52, "1 ปี"], [104, "2 ปี"],
          [156, "3 ปี"], [260, "5 ปี"], [520, "10 ปี"], [1040, "20 ปี"], [1560, "30 ปี"],
        ];
        let v = budget; // เส้นทบต้น
        let principal = budget; // เงินต้นสะสม (เส้น simple)
        let simpleInterest = 0; // ดอกเบี้ยแบบไม่ทบต้น (คิดจากเงินต้นเท่านั้น)
        let put = budget;
        const rows: { label: string; put: number; v: number; simple: number }[] = [];
        let w = 0;
        for (const [mark, label] of MARKS) {
          while (w < mark) {
            w++;
            v = v * (1 + i) + weeklyC;
            simpleInterest += principal * (rate / 100 / 52);
            principal += weeklyC;
            put += weeklyC;
          }
          rows.push({ label, put, v, simple: principal + simpleInterest });
        }
        const last = rows[rows.length - 1];
        const dcaHint = Math.max(500, Math.round(budget / 12 / 100) * 100);
        return (
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-3">5️⃣ ทบต้นแล้วจะได้เท่าไหร่ — รายสัปดาห์ · เดือน · ปี</h2>

            {/* ปุ่มควบคุม: อัตราโต + การเพิ่มเงิน */}
            <div className="card p-4 mb-3 space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>อัตราโตที่ใช้คำนวณ</span>
                  <span className="num font-bold text-accent">{rate.toFixed(1)}%/ปี</span>
                  {rateOverride == null && <span className="chip bg-base-800 text-zinc-500 text-[10px]">จากผลตอบแทน 5 ปีจริงของพอร์ตนี้ + ปันผล (ปรับได้)</span>}
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={0.5}
                  value={rate}
                  onChange={(e) => setRateOverride(Number(e.target.value))}
                  className="w-full mt-2"
                  aria-label="อัตราโตต่อปี"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-400">เพิ่มเงินประจำ:</span>
                {([
                  ["none", "ไม่เพิ่ม (ก้อนเดียว)"],
                  ["week", "สัปดาห์ละ"],
                  ["month", "เดือนละ"],
                  ["year", "ปีละ"],
                ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setContribMode(m)}
                    className={`chip ${contribMode === m ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}
                  >
                    {label}
                  </button>
                ))}
                {contribMode !== "none" && (
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={contrib}
                    onChange={(e) => setContrib(Math.max(0, Number(e.target.value) || 0))}
                    className="input num !w-28 !py-1"
                    aria-label="จำนวนเงินที่เพิ่มแต่ละงวด (บาท)"
                  />
                )}
                {contribMode === "month" && <span className="text-[10px] text-zinc-500">แนะนำ ~฿{baht(dcaHint)} (DCA)</span>}
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] text-zinc-500 border-b border-base-700">
                    <th className="py-2 px-3">อีกเมื่อไหร่</th>
                    <th className="py-2 px-3 text-right">เงินที่ลงทั้งหมด</th>
                    <th className="py-2 px-3 text-right">มูลค่าพอร์ต (ทบต้น)</th>
                    <th className="py-2 px-3 text-right">กำไร</th>
                    <th className="py-2 px-3 text-right">จากทบต้นล้วนๆ*</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const gain = r.v - r.put;
                    const compoundOnly = Math.max(0, r.v - r.simple);
                    return (
                      <tr key={r.label} className={`border-b border-base-700/40 ${r.label === "10 ปี" || r.label === "20 ปี" ? "bg-base-800/40" : ""}`}>
                        <td className="py-2 px-3 text-zinc-300 font-semibold">{r.label}</td>
                        <td className="py-2 px-3 text-right num text-zinc-400">฿{baht(r.put)}</td>
                        <td className="py-2 px-3 text-right num text-zinc-100 font-bold">฿{baht(r.v)}</td>
                        <td className={`py-2 px-3 text-right num ${gain >= 0 ? "text-up" : "text-down"}`}>
                          {gain >= 0 ? "+" : ""}฿{baht(gain)}
                        </td>
                        <td className="py-2 px-3 text-right num text-zinc-500">
                          {r.label === "1 เดือน" || r.label === "3 เดือน" ? "-" : `฿${baht(compoundOnly)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              *ส่วนที่เกิดจาก &ldquo;ดอกเบี้ยงอกดอกเบี้ย&rdquo; ล้วนๆ (มูลค่าแบบทบต้น − ถ้าคิดดอกเบี้ยเฉพาะเงินต้นโดยไม่ทบ) · คำนวณทบต้นรายสัปดาห์จากอัตราต่อปี {rate.toFixed(1)}%
              {contribMode !== "none" && ` + เพิ่มเงิน${contribMode === "week" ? "รายสัปดาห์" : contribMode === "month" ? "รายเดือน" : "รายปี"} ฿${baht(contrib)}`}
              {" "}· ตัวเลขเป็นการจำลองเพื่อการศึกษา — ตลาดจริงไม่โตเส้นตรง มีปีขึ้นปีลง ผลอดีตไม่รับประกันอนาคต
            </p>
            <div className="card p-4 mt-2 border-accent/30">
              <p className="text-sm text-zinc-300 leading-relaxed">
                🌱 <b className="text-zinc-100">พลังของทบต้น:</b> จากเงินที่ลงรวม ฿{baht(last.put)} → เป็น ฿{baht(last.v)} ใน 30 ปี
                (กำไร ฿{baht(last.v - last.put)}) — ยิ่งเริ่มเร็ว ยิ่งเวลาทำงานให้คุณนาน
              </p>
            </div>
          </section>
        );
      })()}

      {/* ไทม์แมชชีน — ถ้าเริ่มพอร์ตนี้เมื่อ N ปีก่อน วันนี้จะมีเท่าไหร่ (จากราคาจริง) */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">6️⃣ 🕰️ ไทม์แมชชีน: ถ้าเริ่มพอร์ตนี้เมื่อ N ปีก่อน วันนี้จะมีเท่าไหร่?</h2>
        <div className="card p-4">
          {btBusy && <p className="text-sm text-zinc-500 animate-pulse">⏳ กำลังย้อนเวลาไปดูราคาจริงของทุกตำแหน่ง… (~10 วิ)</p>}
          {!btBusy && !bt && <p className="text-sm text-zinc-500">ดึงข้อมูลย้อนหลังไม่สำเร็จ — ลองรีเฟรชอีกครั้ง</p>}
          {bt && (() => {
            const mark = bt.marks.find((m) => m.years === btYears && m.available);
            if (!mark || !mark.mult) {
              return <p className="text-sm text-zinc-500">พอร์ตนี้ย้อนหลังได้แค่ {bt.windowYears} ปี (ตัวหลักเพิ่งขึ้นจริงไม่นาน) — ข้อมูลยังสั้นเกินเปรียบเทียบ</p>;
            }
            const beats = mark.mult >= (mark.spyMult ?? 0);
            const vals = bt.curve.flatMap((c) => [c.v, c.spy, 1]);
            const min = Math.min(...vals), max = Math.max(...vals);
            const W = 560, H = 130;
            const X = (i: number) => (i / Math.max(1, bt.curve.length - 1)) * W;
            const Y = (val: number) => H - ((val - min) / (max - min || 1)) * (H - 10) - 5;
            const line = (key: "v" | "spy") => bt.curve.map((c, i) => `${X(i).toFixed(1)},${Y(c[key]).toFixed(1)}`).join(" ");
            const coreBudget = (budget * bt.coreSharePct) / 100;
            return (
              <div className="space-y-3">
                {/* เลือกช่วงเวลา */}
                <div className="flex flex-wrap gap-2 items-center">
                  {bt.marks.map((m) => (
                    <button
                      key={m.years}
                      onClick={() => m.available && setBtYears(m.years)}
                      disabled={!m.available}
                      title={m.available ? undefined : "พอร์ตนี้มีข้อมูลย้อนหลังไม่ถึงช่วงนี้"}
                      className={`chip num ${m.years === btYears && m.available ? "bg-accent text-zinc-950" : m.available ? "bg-base-800 text-zinc-400 border border-base-700" : "bg-base-900 text-zinc-700 border border-base-800 cursor-not-allowed"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                  <span className="text-[11px] text-zinc-600 ml-1">ข้อมูลย้อนหลัง {bt.windowYears} ปี (ตั้งแต่ {bt.windowStartTh}) · คิดจากราคาจริง {bt.asOf}</span>
                </div>

                {/* ผลลัพธ์ใหญ่ — คิดจาก "ส่วนตั้งฐาน" เท่านั้น (ตัวหมุนรายวันย้อนหลังไม่ซื่อสัตย์) */}
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <div className="text-[11px] text-zinc-500">
                      ส่วนตั้งฐาน ฿{baht(coreBudget)} ของงบ ฿{baht(budget)} ({bt.coreSharePct}%) เมื่อ {mark.label}ที่แล้ว → วันนี้
                    </div>
                    <div className={`num text-3xl font-bold ${mark.mult >= 1 ? "text-up" : "text-down"}`}>~฿{baht(coreBudget * mark.mult)}</div>
                    <div className="text-xs num text-zinc-400">
                      {((mark.mult - 1) * 100).toFixed(0)}% รวม · เฉลี่ย <b className={mark.cagrPct !== null && mark.cagrPct >= 0 ? "text-up" : "text-down"}>{mark.cagrPct}%/ปี</b>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">ถือ S&amp;P500 แทน (เงินก้อนเดียวกัน)</div>
                    <div className="num text-xl font-bold text-zinc-300">~฿{mark.spyMult !== null ? baht(coreBudget * mark.spyMult) : "—"}</div>
                    <div className={`chip !text-[10px] ${beats ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{beats ? "🏆 พอร์ตนี้เกินตลาด" : "📉 ตามหลังตลาด"} · {mark.spyCagrPct}%/ปี</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">ช่วงร่วงแรงสุด (จากข้อมูลรายสัปดาห์)</div>
                    <div className="num text-xl font-bold text-down">{bt.mddPct}%</div>
                    <div className="text-[10px] text-zinc-600 num">S&amp;P500 ช่วงเดียวกัน {bt.spyMddPct}% — เทียบว่า "ร่วง" ของพอร์ตนี้ทนไหวไหม</div>
                  </div>
                </div>

                {/* เส้นพอร์ต vs ตลาด */}
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" role="img" aria-label="กราฟมูลค่าพอร์ตย้อนหลังเทียบ S&P500">
                  <line x1="0" y1={Y(1)} x2={W} y2={Y(1)} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
                  <polyline points={line("spy")} fill="none" stroke="#71717a" strokeWidth="1.5" />
                  <polyline points={line("v")} fill="none" stroke="#facc15" strokeWidth="2" />
                </svg>
                <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500">
                  <span><span className="inline-block w-3 h-0.5 bg-accent-soft align-middle mr-1" />ส่วนตั้งฐาน {profile?.emoji} {profile?.title}</span>
                  <span><span className="inline-block w-3 h-0.5 bg-zinc-500 align-middle mr-1" />S&amp;P500</span>
                  <span><span className="inline-block w-3 border-t border-dashed border-zinc-600 align-middle mr-1" />ถือเงินสด (1.0x)</span>
                </div>

                {bt.rotating.length > 0 && (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    ✂️ ตัดออกจากการย้อนหลัง: {bt.rotating.map((r) => `${r.symbol}`).join(" · ")} ({[...new Set(bt.rotating.map((r) => r.kindTh))].join(" / ")}) — ตัวพวกนี้ระบบเพิ่งคัด "วันนี้" จากอันดับผลงานย้อนหลัง ถ้าเอาย้อนไปคำนวณจะได้ผลเกินจริงเสมอ
                  </p>
                )}
                {bt.lateStart.length > 0 && (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    ℹ️ ตัวที่เพิ่งขึ้นจริงหลังวันเริ่มต้น: {bt.lateStart.map((l) => `${l.symbol} (${l.firstDateTh}, ${l.weight}%)`).join(" · ")} — ก่อนหน้านั้นส่วนของตัวนี้ถือเป็นเงินสด
                  </p>
                )}
                <p className="text-[11px] text-zinc-600 leading-relaxed">⚠️ {bt.note}</p>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ซื้อจริงยังไง */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">7️⃣ พอใจแล้ว ซื้อยังไงต่อ?</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="font-bold text-zinc-100">🇺🇸 หุ้น/กองทุนต่างประเทศ</div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              ซื้อได้ใน <b className="text-accent">Dime</b> (เศษหุ้นเริ่ม 50฿, ค่าธรรมเนียม ~0.15%) หรือ InnovestX / Webull — เปิดบัญชี 1 วันเสร็จ ใช้แค่บัตรประชาชน+บัญชีธนาคาร
            </p>
          </div>
          <div className="card p-4">
            <div className="font-bold text-zinc-100">🇹🇭 หุ้นไทย</div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              ซื้อผ่านโบรกเกอร์ไทยที่มีบัญชี SET ทุกที่ (เช่น บัญชีที่ธนาคารของคุณเปิดให้) — กดซื้อเองได้ในแอป ไม่ต้องโทรหาใคร
            </p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          StockLens เป็นสื่อบทวิเคราะห์ ไม่ใช่โบรกเกอร์ — เราไม่มีระบบรับเงิน/ซื้อขายแทน และไม่มีส่วนแบ่งจากช่องทางใดๆ
        </p>
      </section>

      {/* คำศัพท์ 4 คำสำหรับคนไม่มีความรู้เลย */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">📚 4 คำที่มือใหม่ควรรู้ก่อนกดซื้อ</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ["🧺 กองทุนดัชนี (ETF)", "ตะกร้าที่บรรจุหุ้นหลายสิบ/ร้อยตัวไว้แล้ว — ซื้อถ้วยเดียวเท่ากับกระจายความเสี่ยงให้ตัวเองอัตโนมัติ"],
            ["💰 ปันผล", "เงินที่บริษัทแบ่งกำไรให้ผู้ถือหุ้น ปีละครั้งหรือหลายครั้ง — ได้เงินเข้าบัญชีโดยไม่ต้องขายหุ้น"],
            ["⚖️ สัดส่วน (น้ำหนัก)", "เงินก้อนนึงแบ่งให้แต่ละตัวเท่าไหร่ — ยิ่งแบ่งหลายตัว ยิ่งไม่พังทั้งพอร์ตถ้าตัวเดียวลง"],
            ["🛑 ความเสี่ยง", "ต่ำ=ราคาขยับช้า นอนหลับได้ · สูง=วันละหลายเปอร์เซ็นต์ ต้องตามข่าว — ใส่ตัวเสี่ยงสูงแค่เงินที่เสียได้ไม่เจ็บ"],
          ].map(([t, d]) => (
            <div key={t} className="card p-3">
              <div className="text-xs font-bold text-zinc-200">{t}</div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {data && (
        <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-base-700/60 pt-4">
          ⚠️ {data.note} · สงสัยตัวไหน กดสัญลักษณ์หุ้นดูข้อมูลเต็มได้ หรือถามผู้ช่วย AI (ปุ่ม 💬 มุมขวาล่าง) ได้เลย เช่น &ldquo;VOO คืออะไร&rdquo; หรือ &ldquo;ทำไมพอร์ตนี้ถึงมีทองคำ&rdquo;
        </p>
      )}
    </div>
  );
}
