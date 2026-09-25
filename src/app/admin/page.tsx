"use client";

import { useCallback, useEffect, useState } from "react";
import FlashMonitor from "@/components/FlashMonitor";
import StoryCardGen from "@/components/StoryCardGen";
import type { Member } from "@/lib/types";

type MemberRow = Member & { daysLeft: number };

export default function AdminPage() {
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [brief, setBrief] = useState<{ thDate: string; fbStarter: string; fbPro: string } | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", tier: "starter", paidUntil: "", lineUserId: "", watch: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async (c: string) => {
    const res = await fetch("/api/admin/members", { headers: { "x-admin-code": c } });
    if (res.ok) {
      const j = await res.json();
      setMembers(j.members ?? []);
      setAuthed(true);
    } else {
      setAuthed(false);
      setMsg("รหัสไม่ถูกต้อง");
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("sl-admin");
    if (saved) {
      setCode(saved);
      load(saved);
    }
  }, [load]);

  useEffect(() => {
    if (authed) fetch("/api/brief").then((r) => r.json()).then(setBrief).catch(() => {});
  }, [authed]);

  const login = () => {
    sessionStorage.setItem("sl-admin", code);
    load(code);
  };

  const addMember = async () => {
    if (!form.name.trim()) return;
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({
        ...form,
        watch: form.watch.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      }),
    });
    if (res.ok) {
      setForm({ name: "", contact: "", tier: "starter", paidUntil: "", lineUserId: "", watch: "" });
      load(code);
      setMsg("เพิ่มสมาชิกแล้ว ✓");
    }
  };

  const renew = async (m: MemberRow, days: number) => {
    const d = new Date(Math.max(Date.now(), new Date(m.paidUntil).getTime()) + days * 864e5).toISOString().slice(0, 10);
    await fetch("/api/admin/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ id: m.id, paidUntil: d }),
    });
    load(code);
  };

  // ออกรหัสสมาชิก (SL-XXXXXX) — ส่งรหัสนี้ให้สมาชิกคนนั้น login ผ่าน /login
  const issueCode = async (m: MemberRow) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const c = "SL-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    await fetch("/api/admin/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ id: m.id, accessCode: c }),
    });
    load(code);
    setMsg(`รหัสของ ${m.name}: ${c} (คัดลอกส่งให้เขาแล้วกดคัดลอกอีกครั้งจากตาราง)`);
  };

  const remove = async (id: string) => {
    if (!confirm("ลบสมาชิกคนนี้?")) return;
    await fetch(`/api/admin/members?id=${id}`, { headers: { "x-admin-code": code }, method: "DELETE" });
    load(code);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto py-20 space-y-4">
        <h1 className="text-xl font-bold text-zinc-50 text-center">🔐 Admin Console</h1>
        <input className="input" type="password" placeholder="รหัสผ่านแอดมิน (ADMIN_CODE)" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
        <button className="btn-primary w-full" onClick={login}>เข้าสู่ระบบ</button>
        {msg && <p className="text-xs text-down text-center">{msg}</p>}
        <p className="text-[11px] text-zinc-600 text-center">ค่าเริ่มต้น: stocklens-admin — เปลี่ยนได้ที่ .env.local</p>
      </div>
    );
  }

  const expiringSoon = members.filter((m) => m.daysLeft <= 7);
  const starter = members.filter((m) => m.tier === "starter").length;
  const pro = members.filter((m) => m.tier === "pro").length;
  const mrr = starter * 129 + pro * 399;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-zinc-50">🔐 Admin Console</h1>
        <div className="flex gap-2">
          <a className="btn-ghost text-xs" href="/report/print?type=brief&tier=starter" target="_blank">📄 Daily Brief (Starter)</a>
          <a className="btn-ghost text-xs" href="/report/print?type=brief&tier=pro" target="_blank">📄 Daily Brief (Pro)</a>
        </div>
      </div>

      {/* สรุป */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat k="สมาชิกทั้งหมด" v={String(members.length)} />
        <Stat k="Starter / Pro" v={`${starter} / ${pro}`} />
        <Stat k="รายได้โดยประมาณ/เดือน" v={mrr.toLocaleString() + " ฿"} />
        <Stat k="ใกล้หมดอายุ (≤7 วัน)" v={String(expiringSoon.length)} warn={expiringSoon.length > 0} />
      </div>

      <DailyOps members={members} code={code} />

      {brief && (
        <div className="grid md:grid-cols-2 gap-4">
          <FBPost title="🥉 โพสต์ลงกลุ่ม Starter (พร้อมคัดลอก)" text={brief.fbStarter} />
          <FBPost title="🥇 โพสต์ลงกลุ่ม Pro (พร้อมคัดลอก)" text={brief.fbPro} />
        </div>
      )}

      <StoryCardGen />

      <FlashMonitor />

      <LineBroadcast />

      <div className="grid md:grid-cols-2 gap-4">
        <GeoWeekly />
        <FlashBuilder />
      </div>

      {/* เพิ่มสมาชิก */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">➕ เพิ่มสมาชิกใหม่ (หลังเช็คสลิป PromptPay)</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="input" placeholder="ชื่อ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="FB/ติดต่อ" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <select className="input" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
          </select>
          <input className="input" type="date" value={form.paidUntil} onChange={(e) => setForm({ ...form, paidUntil: e.target.value })} />
          <input className="input" placeholder="LINE User ID (U...) — ถ้ามี" value={form.lineUserId} onChange={(e) => setForm({ ...form, lineUserId: e.target.value })} />
          <input className="input" placeholder="หุ้นที่ติดตาม คั่นด้วย , เช่น MU,PTT.BK" value={form.watch} onChange={(e) => setForm({ ...form, watch: e.target.value })} />
          <button className="btn-primary md:col-span-3" onClick={addMember}>บันทึก</button>
        </div>
        {msg && <p className="text-xs text-up mt-2">{msg}</p>}
      </div>

      <LineVip members={members} code={code} onSaved={() => load(code)} />

      {/* ตารางสมาชิก */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-base-700/60">
              <th className="text-left px-4 py-2">ชื่อ</th>
              <th className="text-left px-4 py-2">ติดต่อ</th>
              <th className="text-left px-4 py-2">แพ็กเกจ</th>
              <th className="text-left px-4 py-2">ชำระถึง</th>
              <th className="text-left px-4 py-2">เหลือ</th>
              <th className="text-right px-4 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-base-700/30">
                <td className="px-4 py-2 text-zinc-100">{m.name}</td>
                <td className="px-4 py-2 text-zinc-400 text-xs">
                  {m.contact || "—"} {m.lineUserId && <span className="chip bg-green-500/15 text-green-400 text-[10px] ml-1">LINE ✓</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`chip ${m.tier === "pro" ? "bg-accent/15 text-accent-soft" : "bg-zinc-500/15 text-zinc-300"}`}>{m.tier === "pro" ? "🥇 Pro" : "🥉 Starter"}</span>
                </td>
                <td className="px-4 py-2 num text-zinc-300">{m.paidUntil}</td>
                <td className={`px-4 py-2 num ${m.daysLeft <= 7 ? "text-down font-bold" : "text-zinc-400"}`}>{m.daysLeft} วัน</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {m.accessCode ? (
                    <span className="chip bg-emerald-500/10 text-emerald-400 text-[10px] mr-1 num" title="รหัส login ของสมาชิก (ส่งให้เขาครั้งเดียว)">{m.accessCode}</span>
                  ) : (
                    <button className="btn-ghost !py-1 !px-2 text-[10px] mr-1" onClick={() => issueCode(m)} title="ออกรหัสสมาชิกส่งให้เขาเพื่อ login">🔑 ออกรหัส</button>
                  )}
                  <button className="btn-ghost !py-1 !px-2 text-xs mr-1" onClick={() => renew(m, 30)}>+30 วัน</button>
                  <button className="btn-ghost !py-1 !px-2 text-xs mr-1" onClick={() => renew(m, 365)}>+1 ปี</button>
                  <button className="btn-ghost !py-1 !px-2 text-xs !text-down" onClick={() => remove(m.id)}>ลบ</button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">ยังไม่มีสมาชิก — เพิ่มคนแรกได้เลยด้านบน</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ✅ เช็คลิสต์ประจำวัน — แอดมินเปิดมาเจอ "วันนี้ต้องทำอะไร" ครบในกล่องเดียว ไม่ต้องไล่หา
function DailyOps({ members, code }: { members: MemberRow[]; code: string }) {
  const expiring = members.filter((m) => m.daysLeft <= 7);
  const proNoLine = members.filter((m) => m.tier === "pro" && !m.lineUserId);
  const [testLine, setTestLine] = useState("");
  const [lineState, setLineState] = useState("");

  const exportCsv = () => {
    const head = "name,contact,tier,startedAt,paidUntil,daysLeft,lineUserId,watch\n";
    const rows = members
      .map((m) => [m.name, m.contact, m.tier, m.startedAt, m.paidUntil, m.daysLeft, m.lineUserId ?? "", (m.watch ?? []).join(" ")]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + head + rows], { type: "text/csv;charset=utf-8" }); // BOM เพื่อให้ Excel เปิดไทยถูก
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stocklens-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendTestLine = async () => {
    if (!testLine.trim().startsWith("U")) { setLineState("กรอก LINE User ID ของตัวเอง (ขึ้นต้น U)"); return; }
    setLineState("กำลังส่ง…");
    try {
      const res = await fetch("/api/admin/line-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ mode: "flash", message: "🧪 ทดสอบการเชื่อมต่อ StockLens × LINE — ถ้าข้อความนี้ถึงคุณ ระบบพร้อมใช้งาน ✓", _testTo: testLine.trim() }),
      });
      const j = await res.json();
      setLineState(res.ok && j.ok ? "ส่งสำเร็จ ✓ ดูข้อความใน LINE" : `ไม่สำเร็จ: ${j.error || "ไม่ทราบ"}`);
    } catch { setLineState("ส่งไม่สำเร็จ (network)"); }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-zinc-100">✅ วันนี้ต้องทำอะไรบ้าง</h3>
        <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={exportCsv}>📥 ส่งออกสมาชิก CSV</button>
      </div>
      <div className="grid md:grid-cols-2 gap-2 text-xs">
        <a className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-850 border border-base-700/50 hover:border-accent/40" href="/report/print?type=brief&tier=starter" target="_blank">
          <span className="text-zinc-300">📄 Daily Brief Starter — ออกแล้วหรือยัง?</span><span className="text-accent-soft">ไปทำ →</span>
        </a>
        <a className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-850 border border-base-700/50 hover:border-accent/40" href="/report/print?type=brief&tier=pro" target="_blank">
          <span className="text-zinc-300">📄 Daily Brief Pro</span><span className="text-accent-soft">ไปทำ →</span>
        </a>
        <a className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-850 border border-base-700/50 hover:border-accent/40" href="/" target="_blank">
          <span className="text-zinc-300">🎯 เช็ค Daily Picks วันนี้ (โพสต์อ้างอิงได้)</span><span className="text-accent-soft">ดู →</span>
        </a>
        <a className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-850 border border-base-700/50 hover:border-accent/40" href="#members">
          <span className={expiring.length ? "text-amber-400" : "text-zinc-300"}>
            {expiring.length ? `⚠️ ต่ออายุ ${expiring.length} คน: ${expiring.map((m) => m.name).join(", ")}` : "✓ ไม่มีใครใกล้หมดอายุ"}
          </span><span className="text-accent-soft">{expiring.length ? "ไปต่ออายุ →" : "ดู →"}</span>
        </a>
      </div>
      {proNoLine.length > 0 && (
        <p className="text-[11px] text-amber-500 mt-2">📲 Pro ยังไม่ได้ผูก LINE (ไม่ได้รับ Flash): {proNoLine.map((m) => m.name).join(", ")}</p>
      )}
      <div className="flex gap-2 mt-3 flex-wrap items-center">
        <input className="input !py-1.5 text-xs max-w-56" placeholder="LINE User ID ตัวเอง (U…)" value={testLine} onChange={(e) => setTestLine(e.target.value)} />
        <button className="btn-ghost !py-1.5 !px-2.5 text-xs" onClick={sendTestLine}>🧪 ทดสอบส่ง LINE หาตัวเอง</button>
        {lineState && <span className={`text-[11px] ${lineState.includes("✓") ? "text-up" : "text-down"}`}>{lineState}</span>}
      </div>
    </div>
  );
}

// สร้าง Geopolitical Weekly — Deep Dive มุมภูมิรัฐศาสตร์ (อ.ทวีสุข + Zeihan/Dalio/Brzezinski) พร้อม PDF
function GeoWeekly() {
  const [ticker, setTicker] = useState("");
  const suggestions = ["TSM", "NVDA", "XOM", "NVO", "ASML", "RIO"];
  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">🌍 Geopolitical Weekly (คอนเทนต์เฉพาะ Pro)</h3>
      <p className="text-[11px] text-zinc-500 mb-3">เลือกหุ้น 1 ตัว/สัปดาห์ → สร้าง Deep Dive มุมภูมิรัฐศาสตร์ (5 ชั้น: ช่องแคบ · ห่วงโซ่อุปทาน · คว่ำบัตร · ผลประโยชน์ชาติ · ดอลลาร์/ทอง) → พิมพ์เป็น PDF ส่งกลุ่ม Pro</p>
      <div className="flex gap-2 flex-wrap mb-2">
        {suggestions.map((s) => (
          <button key={s} className="chip bg-base-800 text-zinc-400 border border-base-700 hover:text-zinc-100" onClick={() => setTicker(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="หรือพิมพ์ ticker เอง เช่น UBER" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
        <a
          className="btn-primary shrink-0"
          href={ticker ? `/report/print?type=deepdive&t=${encodeURIComponent(ticker)}&tier=pro&persona=geo` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ticker}
          style={ticker ? undefined : { opacity: 0.5, pointerEvents: "none" }}
        >
          สร้าง PDF
        </a>
      </div>
    </div>
  );
}

// Flash Builder — พิมพ์เหตุการณ์ → ดูห่วงโซ่ → เปิด Flash Report พิมพ์ PDF (ส่งกลุ่ม Pro ใน 24 ชม.)
function FlashBuilder() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { headline: string; engine: string; chains: { name: string; stocks: { ticker: string; direction: string }[] }[] }>(null);

  const analyze = async () => {
    if (text.trim().length < 4) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/radar/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await res.json();
      setResult({ headline: j.headline, engine: j.engine, chains: j.chains ?? [] });
    } catch {}
    setBusy(false);
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">⚡ Flash Builder (เหตุการณ์ใหญ่ → รายงานใน 24 ชม.)</h3>
      <div className="flex gap-2">
        <input className="input" placeholder="เล่าเหตุการณ์ เช่น อิสราเอลโจมตีโรงกลั่นอิหร่าน" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} />
        <button className="btn-primary shrink-0" onClick={analyze} disabled={busy}>
          {busy ? "กำลังวิเคราะห์…" : "วิเคราะห์"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-zinc-300 leading-snug">{result.headline}</p>
          {result.chains.map((c) => (
            <p key={c.name} className="text-[11px] text-zinc-500">
              <span className="text-zinc-300 font-semibold">{c.name}</span>: {c.stocks.filter((s) => s.direction === "positive").slice(0, 4).map((s) => s.ticker).join(", ") || "-"} ↑ / {c.stocks.filter((s) => s.direction === "negative").slice(0, 4).map((s) => s.ticker).join(", ") || "-"} ↓
            </p>
          ))}
          <a
            className="btn-ghost text-xs !py-1.5 inline-block"
            href={`/report/print?type=flash&ev=${encodeURIComponent(text)}&tier=pro`}
            target="_blank"
            rel="noopener noreferrer"
          >
            📄 เปิด Flash Report (พิมพ์ PDF)
          </a>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className={`card p-4 ${warn ? "border-down/40" : ""}`}>
      <div className={`num text-xl font-bold ${warn ? "text-down" : "text-zinc-50"}`}>{v}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{k}</div>
    </div>
  );
}

function FBPost({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        <button
          className="btn-ghost !py-1 !px-2.5 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
        </button>
      </div>
      <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto bg-base-850 rounded-lg p-3">{text}</pre>
    </div>
  );
}

// 📲 LINE ส่วนตัว VIP — Flash หา Pro ทุกคน (multicast) + สรุปวอตช์ลิสต์รายคน (push)
// ความต่างจาก Broadcast: ตรงตัวผู้รับ สมาชิกรู้สึกได้เฉพาะตัว = เหตุผลที่เขาจ่ายค่า Pro
function LineVip({ members, code, onSaved }: { members: MemberRow[]; code: string; onSaved: () => void }) {
  const [flashText, setFlashText] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [watchDraft, setWatchDraft] = useState<Record<string, string>>({});

  const withLine = members.filter((m) => m.lineUserId);
  const proNoLine = members.filter((m) => m.tier === "pro" && !m.lineUserId);

  const send = async (mode: "flash" | "digest") => {
    setBusy(mode);
    setResult("");
    try {
      const res = await fetch("/api/admin/line-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ mode, message: flashText }),
      });
      const j = await res.json();
      setResult(res.ok && j.ok ? `ส่งสำเร็จ ✓ (ถึง ${j.sent} คน)` : `ไม่สำเร็จ: ${j.error || (j.errors || []).join(" / ") || "ไม่ทราบสาเหตุ"}`);
    } catch {
      setResult("ส่งไม่สำเร็จ (network)");
    }
    setBusy("");
  };

  const saveWatch = async (m: MemberRow) => {
    const watch = (watchDraft[m.id] ?? (m.watch || []).join(", "))
      .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    await fetch("/api/admin/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ id: m.id, watch }),
    });
    onSaved();
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-1">📲 LINE ส่วนตัว VIP (Flash หา Pro · สรุปวอตช์รายคน)</h3>
      <p className="text-[11px] text-zinc-500 mb-3">
        ผูก LINE User ID ของสมาชิก: ให้เขาทัก LINE Official Account ของเรา → เปิด LINE OA Manager → แชท → คลิกชื่อเขา → คัดลอก User ID (ขึ้นต้น U…) มาใส่ในตาราง
      </p>

      <div className="space-y-2 mb-3">
        <textarea className="input min-h-20" placeholder="ข้อความ Flash ส่งหา Pro ทุกคน เช่น ⚡ อิสราเอลโจมตีโรงกลั่น… น้ำมัน +4% หุ้นที่ได้ประโยชน์…" value={flashText} onChange={(e) => setFlashText(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary !py-1.5 text-xs" onClick={() => send("flash")} disabled={busy !== ""}>
            {busy === "flash" ? "กำลังส่ง…" : "⚡ ส่ง Flash หา Pro"}
          </button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => send("digest")} disabled={busy !== ""}>
            {busy === "digest" ? "กำลังส่ง…" : "📲 ส่งสรุปวอตช์ลิสต์ส่วนตัว"}
          </button>
          {result && <span className={`text-xs self-center ${result.includes("✓") ? "text-up" : "text-down"}`}>{result}</span>}
        </div>
      </div>

      {proNoLine.length > 0 && (
        <p className="text-[11px] text-amber-500 mb-2">⚠️ สมาชิก Pro ยังไม่ได้ผูก LINE: {proNoLine.map((m) => m.name).join(", ")}</p>
      )}

      {withLine.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">แก้หุ้นที่ติดตามต่อคน (Enter เพื่อบันทึก) — ใช้ในการส่งสรุปส่วนตัว</p>
          {withLine.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className={`chip ${m.tier === "pro" ? "bg-accent/15 text-accent-soft" : "bg-zinc-500/15 text-zinc-300"} text-[10px] shrink-0`}>{m.tier === "pro" ? "🥇" : "🥉"} {m.name}</span>
              <input
                className="input !py-1 text-xs"
                value={watchDraft[m.id] ?? (m.watch || []).join(", ")}
                placeholder="MU, PTT.BK"
                onChange={(e) => setWatchDraft({ ...watchDraft, [m.id]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && saveWatch(m)}
                onBlur={() => (watchDraft[m.id] ?? (m.watch || []).join(", ")) !== (m.watch || []).join(", ") && saveWatch(m)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600">ยังไม่มีสมาชิกที่ผูก LINE User ID — เพิ่มได้ตอนเพิ่มสมาชิก หรือแจ้ง ID มาภายหลัง</p>
      )}
    </div>
  );
}

// ส่งข้อความ Broadcast ผ่าน LINE Official Account (ต้องใส่ token ที่ .env.local ก่อน)
function LineBroadcast() {  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/admin/line", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": sessionStorage.getItem("sl-admin") || "" },
        body: JSON.stringify({ message: text }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setState("ok");
        setMsg("ส่ง Broadcast แล้ว ✓");
      } else {
        setState("error");
        setMsg(j.error || "ส่งไม่สำเร็จ");
      }
    } catch {
      setState("error");
      setMsg("ส่งไม่สำเร็จ");
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">📣 LINE Broadcast (ส่งถึงผู้ติดตามทุกคน)</h3>
      <textarea
        className="input min-h-24"
        placeholder="วางข้อความ เช่น Daily Brief ย่อ หรือ Flash Alert… (LINE ตัด 4000 ตัวอักษร)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3 mt-2">
        <button className="btn-primary" onClick={send} disabled={state === "sending" || !text.trim()}>
          {state === "sending" ? "กำลังส่ง…" : "ส่ง LINE"}
        </button>
        {msg && <span className={`text-xs ${state === "ok" ? "text-up" : "text-down"}`}>{msg}</span>}
      </div>
      <p className="text-[10px] text-zinc-600 mt-2">
        ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน .env.local (สร้าง LINE Official Account → เปิด Messaging API → คัดลอก Channel access token) — ดูวิธีละเอียดใน README
      </p>
    </div>
  );
}
