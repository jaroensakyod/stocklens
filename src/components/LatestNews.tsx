"use client";

// 📰 ข่าวล่าสุด + อัปเดตหุ้น (สไตล์ investing.com/latest-news) สำหรับหน้าแรก
// ทุกชิ้นมี Jev ตีความ: 🟢 บวก / 🔴 ลบ / ⚪ กลาง + ระดับกระทบ + "ส่งผลกระทบต่ออะไร" (กลุ่ม + หุ้นตัวแทนราคาสด)
// แท็บ "อัปเดตหุ้น" = เฉพาะข่าวที่พูดถึงหุ้นรายตัว (จับชื่อบริษัทไทยในพาดหัว + relatedTickers อเมริกา)
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import type { LatestFeed, LatestItem } from "@/lib/latestNews";
import { prettySym } from "@/lib/prettySymbol";

function timeAgo(t: number): string {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}

const AFFECT_LABELS: Record<string, string> = {
  th: "🇹🇭 หุ้นไทย/SET",
  us: "🇺🇸 หุ้นอเมริกา",
  tech: "💻 เทค/AI",
  banks: "🏦 ธนาคาร",
  energy: "🛢️ พลังงาน/น้ำมัน",
  gold: "🥇 ทอง/ลี้ภัย",
  tourism: "✈️ ท่องเที่ยว",
  agro: "🌾 อาหาร/เกษตร",
  property: "🏗️ อสังหาฯ",
  crypto: "🪙 คริปโต",
  rates: "💰 ดอกเบี้ย/พันธบัตร",
};

function SentimentBadge({ item }: { item: LatestItem }) {
  if (!item.score) return <span className="text-[10px] text-zinc-700">วิเคราะห์รอคะแนน</span>;
  const s = item.score.sentiment;
  const cfg = s === "bullish" ? { t: "บวก", c: "text-up bg-up/10 border-up/30" } : s === "bearish" ? { t: "ลบ", c: "text-down bg-down/10 border-down/30" } : { t: "กลาง", c: "text-zinc-400 bg-base-800 border-base-700" };
  const imp = item.score.impact ?? 0;
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={`chip !text-[10px] !py-0.5 border ${cfg.c}`}>
        {s === "bullish" ? "🟢" : s === "bearish" ? "🔴" : "⚪"} {cfg.t}
      </span>
      <span className="text-[9px] text-zinc-600 num" title={`ระดับกระทบ ${imp.toFixed(1)}/2`}>
        {"●".repeat(Math.max(1, Math.round(imp)))}
        {"○".repeat(Math.max(0, 2 - Math.round(imp)))} กระทบ
      </span>
    </div>
  );
}

function StockChips({ item, highlight }: { item: LatestItem; highlight?: boolean }) {
  if (!item.stocks.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {item.affect && !highlight && <span className="chip bg-base-850 text-zinc-400 border border-base-700 !text-[10px] !py-0.5">{AFFECT_LABELS[item.affect] ?? item.affect}</span>}
      {item.stocks.map((s) => {
        const linked = /^[A-Za-z0-9.\-]+$/.test(s.t) && !s.t.startsWith("^");
        const up = (s.chgPct ?? 0) >= 0;
        const inner = (
          <>
            <span className="num font-semibold">{prettySym(s.t)}</span>
            {s.chgPct != null && (
              <span className={`num ml-1 ${up ? "text-up" : "text-down"}`}>
                {up ? "+" : ""}
                {s.chgPct.toFixed(1)}%
              </span>
            )}
          </>
        );
        return linked ? (
          <Link key={s.t} href={`/stock/${s.t}`} className={`chip !text-[10px] !py-0.5 border ${highlight ? "bg-accent/10 border-accent/30 hover:bg-accent/20" : "bg-base-800 border-base-700 hover:text-zinc-100"}`}>
            {inner}
          </Link>
        ) : (
          <span key={s.t} className="chip bg-base-800 border border-base-700 !text-[10px] !py-0.5">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

function Row({ item, i, aiAvailable, tier }: { item: LatestItem; i: number; aiAvailable: boolean; tier: string }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const summarize = async () => {
    setOpen(true);
    if (summary || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/news-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, publisher: item.source }),
      });
      const j = await res.json();
      setSummary(j.summary || (aiAvailable ? "สรุปไม่สำเร็จชั่วคราว" : "🔒 ต้องตั้ง AI key ก่อนจึงสรุปข่าวเป็นไทยได้"));
    } catch {
      setSummary("เกิดข้อผิดพลาด");
    }
    setLoading(false);
  };

  return (
    <div className={`px-4 py-3 hover:bg-base-800/40 transition-colors ${i === 0 ? "border-l-2 border-l-accent/70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-[74px]">
          <SentimentBadge item={item} />
        </div>
        <div className="min-w-0 flex-1">
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[13.5px] text-zinc-100 font-medium leading-snug hover:text-accent-soft line-clamp-2">
            {item.title}
          </a>
          <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className={item.lang === "th" ? "text-zinc-500" : "text-zinc-600"}>{item.lang === "th" ? "🇹🇭" : "🌍"} {item.source}</span>
            <span>· {timeAgo(item.time)}</span>
            {item.score?.suspicious && <span className="text-amber-500" title={item.score.verifiable === false ? "อ้างอิงไม่ชัด — รอยืนยันจากแหล่งทางการ" : ""}>· ⚠️ อ่านอย่างมีวิจารณญาณ</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StockChips item={item} highlight={item.matched.length > 0} />
            {item.matched.length > 0 && <span className="text-[9px] text-zinc-600">← ข่าวพูดถึงหุ้นนี้</span>}
          </div>
          <div className="mt-1.5">
            <button
              className="btn-ghost !py-0.5 !px-2 text-[10px]"
              onClick={() => {
                if (tier === "free") {
                  setOpen(true);
                  setSummary("🔒 สรุปข่าวเป็นไทยเป็นฟีเจอร์ VIP — สมัครเพื่อใช้งาน");
                  return;
                }
                summarize();
              }}
            >
              {loading ? "กำลังสรุป…" : "🇹🇭 สรุปไทย"}
            </button>
            {open && summary && <p className="text-xs text-zinc-300 leading-relaxed mt-1.5 bg-base-850 rounded-lg p-2.5 border border-base-700/60">{summary}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LatestNews({ usdThb }: { usdThb?: number }) {
  const { tier } = useAuth();
  const [feed, setFeed] = useState<LatestFeed | null>(null);
  const [tab, setTab] = useState<"latest" | "stocks">("latest");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [aiAvailable, setAiAvailable] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch("/api/news/latest")
        .then((r) => r.json())
        .then((j: LatestFeed & { aiAvailable?: boolean }) => {
          if (j.items?.length) {
            setFeed(j);
            setUpdatedAt(Date.now());
          }
          if (typeof j.aiAvailable === "boolean") setAiAvailable(j.aiAvailable);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 120_000); // สดแบบ investing.com: ดึงใหม่ทุก 2 นาที (server cache 5 นาทีกันยิงรัว)
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, []);

  if (!feed) {
    return (
      <section>
        <h2 className="text-sm font-bold text-zinc-400 mb-3">📰 ข่าวล่าสุด</h2>
        <div className="card p-6 flex items-center justify-center gap-2 text-sm text-zinc-500">
          <span className="animate-pulse">📡</span> กำลังดึงข่าวล่าสุด…
        </div>
      </section>
    );
  }

  const items = tab === "latest" ? feed.items : feed.stockItems;
  const mood = feed.mood;

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-zinc-400">📰 ข่าวล่าสุด</h2>
          {mood && (
            <span className={`chip !text-[10px] !py-0.5 border ${mood.dir === "bullish" ? "bg-up/10 text-up border-up/30" : mood.dir === "bearish" ? "bg-down/10 text-down border-down/30" : "bg-base-800 text-zinc-400 border-base-700"}`}>
              ภาพรวม {mood.dir === "bullish" ? "เอียงบวก" : mood.dir === "bearish" ? "เอียงลบ" : "สมดุล"} {feed.jevOn ? "· 🧠 Jev" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[10px] chip bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              🔴 สด · {Math.max(0, Math.round((now - updatedAt) / 1000))} วิที่แล้ว
            </span>
          )}
          {usdThb != null && <span className="text-xs text-zinc-600 num">USD/THB {usdThb.toFixed(2)}</span>}
        </div>
      </div>

      <div className="flex gap-1.5 mb-2">
        <button onClick={() => setTab("latest")} className={`chip !text-[11px] ${tab === "latest" ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
          ⚡ ล่าสุด ({feed.items.length})
        </button>
        <button onClick={() => setTab("stocks")} className={`chip !text-[11px] ${tab === "stocks" ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 border border-base-700"}`}>
          📈 อัปเดตหุ้น ({feed.stockItems.length})
        </button>
      </div>

      <div className="card divide-y divide-base-700/50">
        {items.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">{tab === "stocks" ? "ยังไม่มีข่าวที่พูดถึงหุ้นรายตัวในฟีดนี้ — ลองอีกครู่" : "ยังไม่มีข่าวใหม่ในช่วงนี้"}</p>
        )}
        {items.slice(0, 12).map((n, i) => (
          <Row key={n.link + n.time} item={n} i={i} aiAvailable={aiAvailable} tier={tier} />
        ))}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[9px] text-zinc-700">
            คะแนนบวก/ลบ + กลุ่มที่กระทบ โดย Jev · ราคาหุ้น delay ~15 นาที · ข่าวมาจาก Google News/Yahoo Finance
          </span>
          <a href="https://news.google.com/search?q=ตลาดหุ้น&hl=th&gl=TH&ceid=TH:th" target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 hover:text-accent-soft shrink-0">
            ดูทั้งหมด →
          </a>
        </div>
      </div>
    </section>
  );
}
