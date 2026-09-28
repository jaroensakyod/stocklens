"use client";

// 🎨 Content Studio (/admin/studio) — โรงงานการ์ดคอนเทนต์สำหรับเจ้าของเว็บ
// 3 ประเภทการ์ด 1080×1350 (IG 4:5): จัดพอร์ต / ปันผลต่อเนื่อง / ตำนาน XD — คำนวณจากข้อมูลจริง → ดาวน์โหลด PNG โพสต์ได้เลย
// Gemini ร่างข้อความ + Jev ตรวจโทน/ตัวเลข ก่อนนำไปใช้
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PortfolioCard, { type CardCopy } from "@/components/PortfolioCard";
import DividendStreakCard from "@/components/DividendStreakCard";
import XdMythCard from "@/components/XdMythCard";
import type { PortfolioCardData } from "@/lib/portfolioCard";
import type { DividendStreakData, XdMythData } from "@/lib/dividendCard";

interface Row {
  symbol: string;
  weight: string;
}

type CardType = "portfolio" | "streak" | "xd";

const CARD_TYPES: { id: CardType; label: string }[] = [
  { id: "portfolio", label: "📊 จัดพอร์ต" },
  { id: "streak", label: "💰 ปันผลต่อเนื่อง" },
  { id: "xd", label: "📅 ตำนาน XD" },
];

const PRESETS: { id: string; label: string; oldP: Row[]; newP: Row[] }[] = [
  {
    id: "thai-vs-world",
    label: "🇹🇭 ไทยล้วน vs กระจายโลก",
    oldP: [
      { symbol: "PTT.BK", weight: "40" },
      { symbol: "KBANK.BK", weight: "35" },
      { symbol: "AOT.BK", weight: "25" },
    ],
    newP: [
      { symbol: "VOO", weight: "40" },
      { symbol: "QQQ", weight: "15" },
      { symbol: "TDEX.BK", weight: "25" },
      { symbol: "GLD", weight: "20" },
    ],
  },
  {
    id: "bank-vs-mix",
    label: "🏦 หุ้นไทยพื้นบ้าน vs ผสมกองทุน",
    oldP: [
      { symbol: "SCB.BK", weight: "33" },
      { symbol: "CPF.BK", weight: "33" },
      { symbol: "LH.BK", weight: "34" },
    ],
    newP: [
      { symbol: "TDEX.BK", weight: "40" },
      { symbol: "VOO", weight: "40" },
      { symbol: "GLD", weight: "20" },
    ],
  },
];

const XD_QUICK = ["PTT.BK", "KBANK.BK", "AOT.BK", "ADVANC.BK", "SCC.BK"];

const EMPTY_COPY: CardCopy = { headline: "", sub: "", bullets: ["", "", "", ""], caption: "", hashtags: "" };

export default function StudioPage() {
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [cardType, setCardType] = useState<CardType>("portfolio");

  // --- จัดพอร์ต ---
  const [oldRows, setOldRows] = useState<Row[]>(PRESETS[0].oldP);
  const [newRows, setNewRows] = useState<Row[]>(PRESETS[0].newP);
  const [years, setYears] = useState(5);
  const [initialThb, setInitialThb] = useState(100000);
  const [dcaThb, setDcaThb] = useState(10000);
  const [pData, setPData] = useState<PortfolioCardData | null>(null);

  // --- ปันผลต่อเนื่อง ---
  const [market, setMarket] = useState<"TH" | "US" | "CUSTOM">("TH");
  const [minYears, setMinYears] = useState(10);
  const [customSyms, setCustomSyms] = useState("");
  const [sData, setSData] = useState<DividendStreakData | null>(null);

  // --- ตำนาน XD ---
  const [xdSym, setXdSym] = useState("PTT.BK");
  const [xData, setXData] = useState<XdMythData | null>(null);

  const [copy, setCopy] = useState<CardCopy>(EMPTY_COPY);
  const [jevText, setJevText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "compute" | "copy" | "png">("");
  const [err, setErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("sl-admin");
    if (saved) {
      setCode(saved);
      setAuthed(true);
    }
  }, []);

  const login = () => {
    sessionStorage.setItem("sl-admin", code);
    setAuthed(true);
  };

  const post = (payload: Record<string, unknown>, endpoint = "/api/admin/portfolio-card") =>
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-code": code }, body: JSON.stringify(payload) }).then(async (res) => {
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "ผิดพลาด");
      return j;
    });

  async function compute() {
    setBusy("compute");
    setErr(null);
    try {
      if (cardType === "portfolio") {
        const j = await post({
          action: "compute",
          years,
          initialThb,
          dcaThb,
          oldPositions: oldRows.filter((r) => r.symbol.trim()).map((r) => ({ symbol: r.symbol.trim().toUpperCase(), weight: Number(r.weight) || 0 })),
          newPositions: newRows.filter((r) => r.symbol.trim()).map((r) => ({ symbol: r.symbol.trim().toUpperCase(), weight: Number(r.weight) || 0 })),
        });
        setPData(j.data);
      } else if (cardType === "streak") {
        const j = await post({ action: "compute", market, minYears, symbols: customSyms.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) }, "/api/admin/dividend-card");
        setSData(j.data);
      } else {
        const j = await post({ action: "compute", kind: "xd", symbol: xdSym }, "/api/admin/dividend-card");
        setXData(j.data);
      }
      setCopy(EMPTY_COPY);
      setJevText(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function aiCopy() {
    const payload =
      cardType === "portfolio"
        ? { action: "copy", data: pData }
        : cardType === "streak"
          ? { action: "copy", kind: "streak", data: sData }
          : { action: "copy", kind: "xd", data: xData };
    const hasData = cardType === "portfolio" ? pData : cardType === "streak" ? sData : xData;
    if (!hasData) return;
    setBusy("copy");
    setErr(null);
    try {
      const j = await post(payload, cardType === "portfolio" ? "/api/admin/portfolio-card" : "/api/admin/dividend-card");
      setCopy({ ...EMPTY_COPY, ...j.copy, bullets: [...(j.copy.bullets ?? []), "", "", "", ""].slice(0, 4) });
      setJevText(j.jevText ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI ร่างไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function downloadPng() {
    if (!cardRef.current) return;
    setBusy("png");
    setErr(null);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, {
        width: 1080,
        height: 1350,
        pixelRatio: 2,
        backgroundColor: "#09090b",
        style: { transform: "none", transformOrigin: "top left" }, // ยกเอฟเฟกต์ scale ของ preview ออกตอน export
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `stocklens-${cardType}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "สร้าง PNG ไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  const rowEditor = (rows: Row[], setRows: (r: Row[]) => void, label: string, hue: string) => (
    <div className="card p-3">
      <div className="text-xs font-bold mb-2" style={{ color: hue }}>
        {label}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              className="input !py-1 text-sm"
              value={r.symbol}
              placeholder="VOO / PTT.BK"
              onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, symbol: e.target.value.toUpperCase() } : x)))}
            />
            <input
              className="input !py-1 !w-16 text-sm num"
              value={r.weight}
              inputMode="numeric"
              onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, weight: e.target.value } : x)))}
            />
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label={`ลบแถว ${i + 1}`}>
              ✕
            </button>
          </div>
        ))}
      </div>
      {rows.length < 6 && (
        <button className="btn-ghost !py-1 !px-2 text-xs mt-2" onClick={() => setRows([...rows, { symbol: "", weight: "20" }])}>
          + เพิ่มสินทรัพย์
        </button>
      )}
      <div className="text-[10px] text-zinc-600 mt-1 num">น้ำหนักรวม {rows.reduce((a, r) => a + (Number(r.weight) || 0), 0)}% (ระบบ normalize ให้เอง)</div>
    </div>
  );

  if (!authed) {
    return (
      <div className="max-w-xs mx-auto pt-20 space-y-3 text-center">
        <h1 className="text-xl font-bold text-zinc-50">🎨 Content Studio</h1>
        <input className="input" type="password" placeholder="รหัส admin" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
        <button className="btn-primary w-full" onClick={login}>
          เข้าสู่ระบบ
        </button>
        <p className="text-[11px] text-zinc-600">ใช้รหัสเดียวกับหน้า /admin</p>
      </div>
    );
  }

  const previewScale = 0.33;
  const hasData = cardType === "portfolio" ? pData : cardType === "streak" ? sData : xData;

  const computeBtnLabel =
    cardType === "portfolio" ? "📊 คำนวณจากราคาจริง" : cardType === "streak" ? "🔍 สแกนประวัติปันผลจริง" : "📅 หางวด XD ล่าสุด";

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-zinc-50">🎨 Content Studio</h1>
        <Link href="/admin" className="btn-ghost text-xs">
          ← Admin Console
        </Link>
      </div>

      {/* ประเภทการ์ด */}
      <div className="flex gap-1.5 flex-wrap">
        {CARD_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setCardType(t.id);
              setErr(null);
            }}
            className={`chip ${cardType === t.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== ฟอร์มตามประเภท ===== */}
      {cardType === "portfolio" && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {rowEditor(oldRows, setOldRows, "พอร์ตเดิม (แดง)", "#f43f5e")}
            {rowEditor(newRows, setNewRows, "พอร์ตจัดใหม่ (เขียว)", "#10b981")}
          </div>
          <div className="card p-3 flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">เงินต้น (บาท)</div>
              <input className="input num !w-32 !py-1" value={initialThb} inputMode="numeric" onChange={(e) => setInitialThb(Number(e.target.value) || 0)} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">DCA/เดือน (บาท)</div>
              <input className="input num !w-28 !py-1" value={dcaThb} inputMode="numeric" onChange={(e) => setDcaThb(Number(e.target.value) || 0)} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">ระยะเวลา</div>
              <div className="flex gap-1">
                {[3, 5, 10].map((y) => (
                  <button key={y} onClick={() => setYears(y)} className={`chip num ${years === y ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
                    {y} ปี
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-200 text-[11px]"
                  onClick={() => {
                    setOldRows(p.oldP);
                    setNewRows(p.newP);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {cardType === "streak" && (
        <div className="card p-3 space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            สแกนประวัติ "วันขึ้นเครื่องหมาย XD" จริงย้อนหลัง 10 ปี (Yahoo Finance) → คัดหุ้นที่จ่ายปันผลต่อเนื่อง ≥ เกณฑ์ → ได้ yield/ความถี่จากของจริง
            ตอบกระแฟนคลิป "หุ้นปันผล 10 ปีต่อเนื่อง / จ่ายทุกเดือน" แบบมีข้อมูลยืนยัน
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">ตลาด</div>
              <div className="flex gap-1">
                {([["TH", "🇹🇭 ไทย (~40 ตัว)"], ["US", "🇺🇸 อเมริกา (~20 ตัว)"], ["CUSTOM", "✏️ รายชื่อเอง"]] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setMarket(m)} className={`chip ${market === m ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">เกณฑ์จ่ายติดกัน ≥</div>
              <div className="flex gap-1">
                {[5, 8, 10].map((y) => (
                  <button key={y} onClick={() => setMinYears(y)} className={`chip num ${minYears === y ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
                    {y} ปี
                  </button>
                ))}
              </div>
            </div>
            {market === "CUSTOM" && (
              <div className="flex-1 min-w-[240px]">
                <div className="text-[10px] text-zinc-500 mb-1">สัญลักษณ์ (คั่นด้วยเว้นวรรค/จุลภาค สูงสุด 30 ตัว)</div>
                <input className="input !py-1 text-sm" placeholder="PTT.BK KBANK.BK O MAIN SCHD" value={customSyms} onChange={(e) => setCustomSyms(e.target.value.toUpperCase())} />
              </div>
            )}
          </div>
        </div>
      )}

      {cardType === "xd" && (
        <div className="card p-3 space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            เลือกหุ้นไทย (.BK) → ระบบหางวดปันผลล่าสุดที่ขึ้น XD ไปแล้ว + ราคารายวันรอบวันนั้น → โชว์ว่า "ราคาอ้างอิงวัน XD = ปิดวันก่อน − ปันผล" (ตลาด SET ปรับอัตโนมัติ)
            — ไขตำนาน "ซื้อก่อน XD รับปันผลฟรี"
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">หุ้น (.BK เท่านั้น)</div>
              <input className="input !py-1 text-sm !w-40" value={xdSym} onChange={(e) => setXdSym(e.target.value.toUpperCase())} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {XD_QUICK.map((s) => (
                <button key={s} onClick={() => setXdSym(s)} className={`chip num !text-[11px] ${xdSym === s ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button className="btn-primary" onClick={compute} disabled={busy !== ""}>
        {busy === "compute" ? "⏳ กำลังคำนวณ…" : computeBtnLabel}
      </button>

      {err && <p className="text-sm text-down">{err}</p>}

      {hasData && (
        <div className="grid lg:grid-cols-[1fr_370px] gap-4 items-start">
          {/* Preview การ์ด */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-zinc-400">พรีวิวการ์ด 1080×1350 (แสดงย่อ {Math.round(previewScale * 100)}%)</div>
              <button className="btn-primary text-xs" onClick={downloadPng} disabled={busy !== ""}>
                {busy === "png" ? "⏳ กำลังสร้าง…" : "⬇️ ดาวน์โหลด PNG (2160×2700)"}
              </button>
            </div>
            <div className="overflow-auto rounded-xl border border-base-700" style={{ height: 1350 * previewScale + 16 }}>
              <div style={{ width: 1080 * previewScale, height: 1350 * previewScale }}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  {cardType === "portfolio" && pData && <PortfolioCard data={pData} copy={copy} cardRef={cardRef} />}
                  {cardType === "streak" && sData && <DividendStreakCard data={sData} copy={copy} cardRef={cardRef} />}
                  {cardType === "xd" && xData && <XdMythCard data={xData} copy={copy} cardRef={cardRef} />}
                </div>
              </div>
            </div>
          </div>

          {/* ข้อความ + AI */}
          <div className="space-y-3">
            <div className="card p-3 space-y-2">
              <button className="btn-primary w-full text-xs" onClick={aiCopy} disabled={busy !== ""}>
                {busy === "copy" ? "⏳ Gemini กำลังร่าง…" : "✍️ ให้ Gemini ร่างข้อความ + Jev ตรวจ"}
              </button>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">หัวเรื่อง (≤60 ตัวอักษร)</div>
                <input className="input !py-1 text-sm" value={copy.headline} maxLength={80} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">คำโปรย</div>
                <input className="input !py-1 text-sm" value={copy.sub} maxLength={140} onChange={(e) => setCopy({ ...copy, sub: e.target.value })} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 mb-1">อ่านตรงนี้ (4 ข้อ)</div>
                {copy.bullets.map((b, i) => (
                  <input
                    key={i}
                    className="input !py-1 text-sm mb-1"
                    value={b}
                    placeholder={`ข้อ ${i + 1}`}
                    onChange={(e) => setCopy({ ...copy, bullets: copy.bullets.map((x, k) => (k === i ? e.target.value : x)) })}
                  />
                ))}
              </div>
            </div>

            <div className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-zinc-500">แคปชันสำหรับโพสต์ (ไม่อยู่บนการ์ด)</div>
                <button
                  className="btn-ghost !py-0.5 !px-2 text-[10px]"
                  onClick={() => navigator.clipboard?.writeText(`${copy.caption}\n\n${copy.hashtags}`).catch(() => {})}
                >
                  📋 คัดลอก
                </button>
              </div>
              <textarea className="input text-sm" rows={7} value={copy.caption} onChange={(e) => setCopy({ ...copy, caption: e.target.value })} />
              <input className="input !py-1 text-xs mt-1" value={copy.hashtags} onChange={(e) => setCopy({ ...copy, hashtags: e.target.value })} placeholder="#หุ้น #ลงทุน" />
              {jevText && <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{jevText}</p>}
            </div>

            <p className="text-[10px] text-zinc-600 leading-relaxed">
              ตัวเลขทั้งหมดคำนวณจากข้อมูลจริง (ประวัติ XD/ราคา Yahoo Finance) · cache 6 ชม. ต่อชุด · ก่อนโพสต์แนะนำไล่อ่านตัวเลขอีกรอบ — ดิสเคลมเมอร์อยู่ท้ายการ์ดแล้ว
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
