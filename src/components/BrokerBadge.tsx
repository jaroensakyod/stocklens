import { brokerFor } from "@/lib/markets";

// ป้ายช่องทางซื้อ (Dime / โบรกเกอร์ไทย / InnovestX)
export default function BrokerBadge({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const b = brokerFor(ticker);
  if (!b.buyable && compact) return null;
  const color =
    b.label === "Dime" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : b.label === "โบรกเกอร์ไทย" ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
    : b.label === "InnovestX" ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
    : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return (
    <span className={`chip border ${color}`} title={b.detail}>
      {b.label === "Dime" ? "✓ " : ""}
      {b.label}
    </span>
  );
}
