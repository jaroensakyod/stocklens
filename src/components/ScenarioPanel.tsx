import type { Scenarios } from "@/lib/scenarios";

// การ์ดสถานการณ์ Bull/Base/Bear พร้อมราคาเป้าหมายจากงบจริง
export default function ScenarioPanel({ scenarios, price, currency }: { scenarios: Scenarios; price: number; currency: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-zinc-100 mb-1">🎯 สถานการณ์ 12 เดือน (สมมติ)</h3>
      <p className="text-[10px] text-zinc-600 mb-3 leading-snug">{scenarios.method}</p>
      <div className="space-y-2">
        {scenarios.scenarios.map((s) => {
          const tone = s.name === "bull" ? "border-up/30 bg-up/5" : s.name === "bear" ? "border-down/30 bg-down/5" : "border-base-600 bg-base-850";
          return (
            <div key={s.name} className={`rounded-lg border px-3 py-2 ${tone}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-zinc-100">{s.label}</span>
                <span className="text-right">
                  <span className="num text-sm font-bold text-zinc-50">{s.targetPrice.toFixed(1)} {currency}</span>{" "}
                  <span className={`num text-xs font-bold ${s.upsidePct >= 0 ? "text-up" : "text-down"}`}>
                    ({s.upsidePct >= 0 ? "+" : ""}{s.upsidePct.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5 num">{s.assumptions} · ปัจจุบัน {price.toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
