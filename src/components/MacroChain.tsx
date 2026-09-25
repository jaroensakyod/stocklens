import Link from "next/link";
import BrokerBadge from "./BrokerBadge";
import type { ChainResult, EventAnalysis } from "@/lib/types";

function StrengthTag({ s }: { s: string }) {
  const map: Record<string, string> = {
    strong: "แรง",
    medium: "ปานกลาง",
    weak: "เบา",
  };
  const color: Record<string, string> = {
    strong: "bg-zinc-100/10 text-zinc-200",
    medium: "bg-zinc-100/5 text-zinc-400",
    weak: "bg-transparent text-zinc-500",
  };
  return <span className={`text-[10px] rounded px-1.5 ${color[s]}`}>ผลกระทบ{map[s] ?? s}</span>;
}

export default function MacroChain({ result }: { result: EventAnalysis }) {
  return (
    <div className="space-y-6 animate-fadeUp">
      <div className="card p-4 border-l-4 border-l-accent">
        <p className="text-sm font-semibold text-zinc-100">{result.headline}</p>
        {result.narrative && <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{result.narrative}</p>}
        <p className="text-[11px] text-zinc-600 mt-2">
          เครื่องยนต์: {result.engine === "ai" ? "AI (LLM) + ฐานความรู้ StockLens" : "คีย์เวิร์ด + ฐานความรู้ (โหมดไม่ใช้ AI)"} · {result.note}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3">
        {result.chains.length === 0 && (
          <div className="card p-6 text-center text-sm text-zinc-500">
            ไม่พบห่วงโซ่ที่ตรงกับข้อความนี้ — ลองระบุชื่อสินค้า/ประเทศ/บริษัทให้ชัดขึ้น
          </div>
        )}
        {result.chains.map((chain) => (
          <ChainBlock key={chain.eventId + chain.name} chain={chain} />
        ))}
      </div>
    </div>
  );
}

function ChainBlock({ chain }: { chain: ChainResult }) {
  const q = (chain as ChainResult & { quote?: { price: number; changePct: number } }).quote;
  const pos = chain.stocks.filter((s) => s.direction === "positive");
  const neg = chain.stocks.filter((s) => s.direction === "negative");
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <span className="font-bold text-zinc-50">{chain.name}</span>
        {q && isFinite(q.price) && (
          <span className={`num text-sm font-semibold ${q.changePct >= 0 ? "text-up" : "text-down"}`}>
            {q.price.toFixed(2)} ({q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}% วันนี้)
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{chain.reason}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <StockList title="✅ ได้ประโยชน์" stocks={pos} tone="up" />
        <StockList title="❌ เสียประโยชน์" stocks={neg} tone="down" />
      </div>
    </div>
  );
}

function StockList({ title, stocks, tone }: { title: string; stocks: ChainResult["stocks"]; tone: "up" | "down" }) {
  if (!stocks.length) return null;
  return (
    <div>
      <h4 className={`text-xs font-bold mb-1.5 ${tone === "up" ? "text-up" : "text-down"}`}>{title}</h4>
      <div className="space-y-1.5">
        {stocks.map((s) => (
          <div key={s.ticker} className="bg-base-850 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/stock/${s.ticker}`} className="font-semibold text-sm text-zinc-100 hover:text-accent-soft">
                  {s.ticker}
                </Link>
                <BrokerBadge ticker={s.ticker} compact />
                <StrengthTag s={s.strength} />
                {s.quote && isFinite(s.quote.price) && (
                  <span className={`num text-xs ${s.quote.changePct >= 0 ? "text-up" : "text-down"}`}>
                    {s.quote.changePct >= 0 ? "+" : ""}{s.quote.changePct.toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{s.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
