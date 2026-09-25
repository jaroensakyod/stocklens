"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StarButton from "@/components/StarButton";
import BrokerBadge from "@/components/BrokerBadge";
import { useAlerts, usePortfolio, useWatchlist } from "@/lib/store";
import impactJson from "@/data/impact-map.json";
import themesJson from "@/data/radar-themes.json";
import type { Quote } from "@/lib/types";
import PortfolioAdvisor from "@/components/PortfolioAdvisor";
import TickerPicker from "@/components/TickerPicker";

type Tab = "watchlist" | "portfolio" | "advisor" | "alerts";
interface RadarThemeInfo {
  id: string; name: string; emoji: string; heat: number;
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("watchlist");
  const { list: watchlist, toggle } = useWatchlist();
  const { holdings, upsert, remove: removeHolding } = usePortfolio();
  const { alerts, add: addAlert, remove: removeAlert, reset: resetAlert } = useAlerts();

  const allSymbols = useMemo(
    () => [...new Set([...watchlist, ...holdings.map((h) => h.ticker), ...alerts.map((a) => a.ticker)])],
    [watchlist, holdings, alerts]
  );
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [usdThb, setUsdThb] = useState<number | null>(null);
  const [themes, setThemes] = useState<RadarThemeInfo[]>([]);

  const load = useCallback(async () => {
    if (!allSymbols.length) return;
    try {
      const res = await fetch("/api/quote?s=" + allSymbols.join(","));
      const json = await res.json();
      const map: Record<string, Quote> = {};
      for (const q of json.quotes ?? []) if (isFinite(q.price)) map[q.symbol] = q;
      setQuotes(map);
      if (json.usdThb) setUsdThb(json.usdThb);
    } catch {}
  }, [allSymbols]);

  useEffect(() => {
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    fetch("/api/radar").then((r) => r.json()).then((j) => setThemes(j.themes ?? [])).catch(() => {});
  }, []);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "watchlist", label: "⭐ Watchlist", count: watchlist.length },
    { id: "portfolio", label: "💼 พอร์ตของฉัน", count: holdings.length },
    { id: "advisor", label: "🤖 AI ปรับพอร์ต", count: 0 },
    { id: "alerts", label: "🔔 แจ้งเตือน", count: alerts.filter((a) => !a.triggeredAt).length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">พอร์ต & Watchlist ของฉัน</h1>
        <p className="text-sm text-zinc-400 mt-1">
          เก็บในเครื่องคุณเอง (ไม่ต้องสมัครสมาชิก) — เพิ่มหุ้นด้วยปุ่ม ★ ที่หน้ารายตัว แล้วมาดูราคา/กำไร/เหตุการณ์ที่กระทบที่นี่ทุกวัน
        </p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t.id ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
          >
            {t.label} {t.count > 0 && <span className="num opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "watchlist" && <WatchlistTab watchlist={watchlist} quotes={quotes} toggle={toggle} />}
      {tab === "portfolio" && <PortfolioTab holdings={holdings} quotes={quotes} usdThb={usdThb} upsert={upsert} remove={removeHolding} themes={themes} />}
      {tab === "advisor" && <PortfolioAdvisor />}
      {tab === "alerts" && <AlertsTab alerts={alerts} quotes={quotes} add={addAlert} remove={removeAlert} reset={resetAlert} />}
    </div>
  );
}

// ================= Watchlist =================
function WatchlistTab({ watchlist, quotes, toggle }: { watchlist: string[]; quotes: Record<string, Quote>; toggle: (t: string) => void }) {
  const [add, setAdd] = useState("");
  if (!watchlist.length) {
    return (
      <div className="card p-10 text-center">
        <p className="text-3xl mb-2">⭐</p>
        <p className="text-zinc-300 font-semibold">ยังไม่มีหุ้นใน Watchlist</p>
        <p className="text-xs text-zinc-500 mt-1">กดปุ่มดาว ★ ที่หน้าวิเคราะห์หุ้น (เช่น <Link href="/stock/NVDA" className="link">NVDA</Link>) เพื่อเพิ่มมาไว้ที่นี่</p>
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 border-b border-base-700/60">
            <th className="text-left px-4 py-2 w-8"></th>
            <th className="text-left px-4 py-2">หุ้น</th>
            <th className="text-right px-4 py-2">ราคา</th>
            <th className="text-right px-4 py-2">% วันนี้</th>
            <th className="text-right px-4 py-2 hidden sm:table-cell">ช่องทางซื้อ</th>
            <th className="text-right px-4 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((t) => {
            const q = quotes[t];
            return (
              <tr key={t} className="border-b border-base-700/30 hover:bg-base-800/60">
                <td className="px-4 py-2"><StarButton ticker={t} /></td>
                <td className="px-4 py-2">
                  <Link href={`/stock/${t}`} className="font-bold text-zinc-100 hover:text-accent-soft">{t}</Link>
                  <span className="text-zinc-500 text-xs ml-2">{q?.name}</span>
                </td>
                <td className="px-4 py-2 text-right num text-zinc-200">{q ? q.price.toFixed(2) : "…"}</td>
                <td className={`px-4 py-2 text-right num font-semibold ${q ? (q.changePct >= 0 ? "text-up" : "text-down") : ""}`}>
                  {q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : ""}
                </td>
                <td className="px-4 py-2 text-right hidden sm:table-cell"><BrokerBadge ticker={t} compact /></td>
                <td className="px-4 py-2 text-right">
                  <button className="text-zinc-600 hover:text-down" onClick={() => toggle(t)} aria-label="ลบ">✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 text-[11px] text-zinc-600">{add ? "" : "อัปเดตราคาอัตโนมัติทุก 90 วินาที (delay ~15 นาทีตามแหล่งข้อมูล)"}</div>
    </div>
  );
}

// ================= Portfolio =================
function PortfolioTab({
  holdings, quotes, usdThb, upsert, remove, themes,
}: {
  holdings: { ticker: string; qty: number; avgCost: number }[];
  quotes: Record<string, Quote>;
  usdThb: number | null;
  upsert: (t: string, q: number, c: number) => void;
  remove: (t: string) => void;
  themes: RadarThemeInfo[];
}) {
  const [form, setForm] = useState({ ticker: "", qty: "", avgCost: "" });

  const rows = holdings.map((h) => {
    const q = quotes[h.ticker];
    const price = q?.price ?? NaN;
    const value = isFinite(price) ? price * h.qty : NaN;
    const cost = h.avgCost * h.qty;
    const pl = isFinite(value) ? value - cost : NaN;
    return { ...h, q, price, value, cost, pl, plPct: isFinite(pl) ? (pl / cost) * 100 : NaN };
  });
  const totalValue = rows.reduce((a, r) => a + (isFinite(r.value) ? r.value : 0), 0);
  const totalCost = rows.reduce((a, r) => a + r.cost, 0);
  const totalPL = totalValue - totalCost;
  const thb = usdThb && rows.every((r) => !r.q || r.q.currency === "USD") ? usdThb : null;

  // Radar ที่กระทบหุ้นในพอร์ต (จาก impact-map + ความร้อนธีมล่าสุด)
  const impactByTheme = useMemo(() => {
    const nodes = (impactJson as { nodes: { id: string; name: string; stocks: { ticker: string; direction: string; reason: string }[] }[] }).nodes;
    const heldSet = new Set(holdings.map((h) => h.ticker));
    const result: { theme: RadarThemeInfo; hits: { ticker: string; direction: string; reason: string }[] }[] = [];
    for (const theme of themes) {
      const themeInfo = (themesJson as { themes: { id: string; impactIds: string[] }[] }).themes.find((t) => t.id === theme.id);
      const hits: { ticker: string; direction: string; reason: string }[] = [];
      for (const nid of themeInfo?.impactIds ?? []) {
        const node = nodes.find((n) => n.id === nid);
        if (!node) continue;
        for (const s of node.stocks) {
          if (heldSet.has(s.ticker)) hits.push({ ticker: s.ticker, direction: s.direction, reason: `${node.name}: ${s.reason}` });
        }
      }
      if (hits.length) result.push({ theme, hits });
    }
    return result.sort((a, b) => b.theme.heat - a.theme.heat);
  }, [themes, holdings]);

  return (
    <div className="space-y-5">
      {/* ฟอร์มเพิ่ม */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">➕ เพิ่ม Position (ถืออะไรไว้บ้าง)</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <TickerPicker
            placeholder="🔍 ค้นหาหุ้น แล้วกดเลือก"
            onSelect={(symbol) => setForm((f) => ({ ...f, ticker: symbol }))}
          />
          <input className="input num" type="number" placeholder="จำนวนหุ้น (รับเศ้าได้ เช่น 0.5)" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          <input className="input num" type="number" placeholder="ราคาซื้อเฉลี่ย (สกุลของหุ้น)" value={form.avgCost} onChange={(e) => setForm({ ...form, avgCost: e.target.value })} />
          <button
            className="btn-primary"
            disabled={!form.ticker || !(Number(form.qty) > 0) || !(Number(form.avgCost) > 0)}
            title={!form.ticker ? "เลือกหุ้นจากรายการค้นหาก่อน" : undefined}
            onClick={() => {
              const qty = Number(form.qty), cost = Number(form.avgCost);
              if (form.ticker && qty > 0 && cost > 0) upsert(form.ticker, qty, cost);
              setForm({ ticker: "", qty: "", avgCost: "" });
            }}
          >
            บันทึก
          </button>
        </div>
      </div>

      {/* สรุปพอร์ต */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat k="มูลค่าพอร์ต" v={`$${totalValue.toFixed(0)}`} sub={thb ? `≈ ${(totalValue * thb).toLocaleString("th-TH", { maximumFractionDigits: 0 })} ฿` : undefined} />
          <Stat k="ต้นทุนรวม" v={`$${totalCost.toFixed(0)}`} />
          <Stat k="กำไร/ขาดทุน" v={`${totalPL >= 0 ? "+" : ""}$${totalPL.toFixed(0)}`} tone={totalPL >= 0 ? "up" : "down"} sub={thb ? `${totalPL >= 0 ? "+" : ""}${(totalPL * thb).toLocaleString("th-TH", { maximumFractionDigits: 0 })} ฿` : undefined} />
          <Stat k="% รวม" v={`${totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : "0"}%`} tone={totalPL >= 0 ? "up" : "down"} />
        </div>
      )}

      {/* ตาราง */}
      {holdings.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">💼</p>
          <p className="text-zinc-300 font-semibold">ยังไม่มี Position</p>
          <p className="text-xs text-zinc-500 mt-1">ใส่หุ้นที่ถืออยู่ (แม้แค่เศษหุ้น 0.1 ตัวจาก Dime!) แล้วระบบจะคำนวณกำไรและบอกว่าเหตุการณ์โลกกระทบพอร์ตคุณตรงไหน</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-base-700/60">
                <th className="text-left px-4 py-2">หุ้น</th>
                <th className="text-right px-4 py-2">จำนวน</th>
                <th className="text-right px-4 py-2">ราคาซื้อเฉลี่ย</th>
                <th className="text-right px-4 py-2">ราคาตอนนี้</th>
                <th className="text-right px-4 py-2">มูลค่า</th>
                <th className="text-right px-4 py-2">กำไร/ขาดทุน</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-b border-base-700/30">
                  <td className="px-4 py-2">
                    <Link href={`/stock/${r.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft">{r.ticker}</Link>
                    <span className="text-zinc-500 text-xs ml-2">{r.q?.name}</span>
                  </td>
                  <td className="px-4 py-2 text-right num text-zinc-300">{r.qty}</td>
                  <td className="px-4 py-2 text-right num text-zinc-400">{r.avgCost.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right num text-zinc-200">{isFinite(r.price) ? r.price.toFixed(2) : "…"}</td>
                  <td className="px-4 py-2 text-right num text-zinc-200">{isFinite(r.value) ? `$${r.value.toFixed(0)}` : "—"}</td>
                  <td className={`px-4 py-2 text-right num font-semibold ${r.pl >= 0 ? "text-up" : "text-down"}`}>
                    {isFinite(r.pl) ? `${r.pl >= 0 ? "+" : ""}$${r.pl.toFixed(0)} (${r.plPct >= 0 ? "+" : ""}${r.plPct.toFixed(1)}%)` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-zinc-600 hover:text-down" onClick={() => remove(r.ticker)} aria-label="ลบ">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Radar ที่กระทบพอร์ต */}
      {impactByTheme.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3">🌍 เหตุการณ์โลกที่กระทบพอร์ตคุณ (เรียงตามความร้อนของธีมวันนี้)</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {impactByTheme.map(({ theme, hits }) => (
              <Link key={theme.id} href="/radar" className="card card-hover p-4 block">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-zinc-100">{theme.emoji} {theme.name}</span>
                  <span className={`num text-sm font-bold ${theme.heat >= 60 ? "text-down" : theme.heat >= 35 ? "text-accent" : "text-zinc-500"}`}>{theme.heat}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {hits.slice(0, 3).map((h, i) => (
                    <p key={i} className="text-xs leading-snug">
                      <span className={`font-bold ${h.direction === "positive" ? "text-up" : "text-down"}`}>{h.ticker}</span>{" "}
                      <span className="text-zinc-500">{h.direction === "positive" ? "ได้ประโยชน์หากธีมนี้รุนแรงขึ้น" : "เสียประโยชน์หากธีมนี้รุนแรงขึ้น"}</span>
                    </p>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ================= Alerts =================
function AlertsTab({
  alerts, quotes, add, remove, reset,
}: {
  alerts: { id: string; ticker: string; direction: "above" | "below"; target: number; createdAt: number; triggeredAt?: number }[];
  quotes: Record<string, Quote>;
  add: (t: string, d: "above" | "below", target: number) => void;
  remove: (id: string) => void;
  reset: (id: string) => void;
}) {
  const [form, setForm] = useState({ ticker: "", direction: "above", target: "" });
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  const active = alerts.filter((a) => !a.triggeredAt);
  const fired = alerts.filter((a) => a.triggeredAt);

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <h2 className="text-sm font-bold text-zinc-100 mb-3">➕ ตั้งแจ้งเตือนราคา</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <TickerPicker
            placeholder="🔍 ค้นหาหุ้น แล้วกดเลือก"
            onSelect={(symbol) => setForm((f) => ({ ...f, ticker: symbol }))}
          />
          <select className="input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="above">ขึ้นถึง (≥)</option>
            <option value="below">ลงถึง (≤)</option>
          </select>
          <input className="input num" type="number" placeholder="ราคาเป้าหมาย" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          <button
            className="btn-primary"
            disabled={!form.ticker || !(Number(form.target) > 0)}
            onClick={() => {
              const target = Number(form.target);
              if (form.ticker && target > 0) add(form.ticker, form.direction as "above" | "below", target);
              setForm({ ticker: "", direction: "above", target: "" });
            }}
          >
            ตั้งแจ้งเตือน
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {perm !== "granted" && (
            <button
              className="btn-ghost !py-1 !px-3 text-xs"
              onClick={async () => {
                if (typeof Notification !== "undefined") {
                  const p = await Notification.requestPermission();
                  setPerm(p);
                }
              }}
            >
              🔔 เปิดการแจ้งเตือนเบราว์เซอร์ (แนะนำ)
            </button>
          )}
          <span className="text-[11px] text-zinc-600">ระบบเช็คราคาทุก 90 วินาทีระหว่างที่เปิดเว็บไว้ (ราคา delay ~15 นาที)</span>
        </div>
      </div>

      {active.length === 0 && fired.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🔔</p>
          <p className="text-zinc-300 font-semibold">ยังไม่มีการแจ้งเตือน</p>
          <p className="text-xs text-zinc-500 mt-1">ตั้งไว้เลย เช่น "NVDA ลงถึง 200 บอกฉัน" — พอราคาถึงเป้าเบราว์เซอร์จะแจ้งทันที</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="card divide-y divide-base-700/40">
          <div className="px-4 py-2 text-xs text-zinc-500">⏳ กำลังเฝ้าระวัง</div>
          {active.map((a) => {
            const q = quotes[a.ticker];
            const distance = q && isFinite(q.price) ? ((a.target - q.price) / q.price) * 100 : NaN;
            return (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <Link href={`/stock/${a.ticker}`} className="font-bold text-zinc-100 hover:text-accent-soft text-sm">{a.ticker}</Link>
                  <span className="text-xs text-zinc-400 ml-2 num">
                    {a.direction === "above" ? "≥" : "≤"} {a.target.toFixed(2)} · ตอนนี้ {q ? q.price.toFixed(2) : "…"}
                    {isFinite(distance) && <span className={distance >= 0 ? "text-zinc-500" : "text-zinc-500"}> (ห่าง {Math.abs(distance).toFixed(1)}%)</span>}
                  </span>
                </div>
                <button className="text-zinc-600 hover:text-down" onClick={() => remove(a.id)}>ลบ</button>
              </div>
            );
          })}
        </div>
      )}

      {fired.length > 0 && (
        <div className="card divide-y divide-base-700/40 border-up/30">
          <div className="px-4 py-2 text-xs text-up">✅ แจ้งเตือนแล้ว (ถึงเป้าหมาย)</div>
          {fired.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-bold text-zinc-100">{a.ticker}</span>
                <span className="text-xs text-zinc-400 ml-2 num">{a.direction === "above" ? "≥" : "≤"} {a.target.toFixed(2)} · ตรงเป้า {new Date(a.triggeredAt!).toLocaleString("th-TH")}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={() => reset(a.id)}>เฝ้าใหม่</button>
                <button className="text-zinc-600 hover:text-down" onClick={() => remove(a.id)}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="card p-4">
      <div className={`num text-xl font-bold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-zinc-50"}`}>{v}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{k}</div>
      {sub && <div className="num text-[11px] text-zinc-600">{sub}</div>}
    </div>
  );
}
