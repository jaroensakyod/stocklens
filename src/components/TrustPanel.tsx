"use client";

// แผง "ขอบเขตของข้อมูล" — บอกตรงๆ ว่าระบบรู้อะไร/ไม่รู้อะไร (แนวคิด trust-model)
export default function TrustPanel({ confidence }: { confidence: { score: number; coveredCount: number; totalCount: number; missing: string[]; hasTechnicals: boolean; hasNews: boolean; priceSource: string; fundamentalsSource: string } }) {
  const c = confidence;
  const tone = c.score >= 80 ? "bg-up" : c.score >= 50 ? "bg-accent" : "bg-zinc-500";
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-zinc-100 mb-2">🔍 ขอบเขตของข้อมูล (Trust)</h3>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-base-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${c.score}%` }} />
        </div>
        <span className="num text-xs text-zinc-300 font-semibold">{c.score}% ครบ</span>
      </div>
      <p className="text-[11px] text-zinc-500 num">
        งบ/อัตราส่วน {c.coveredCount}/{c.totalCount} ชิ้น · เทคนิค {c.hasTechnicals ? "✓" : "✗"} · ข่าว {c.hasNews ? "✓" : "✗"}
      </p>
      {c.missing.length > 0 && (
        <p className="text-[11px] text-amber-400/80 mt-1.5 leading-relaxed">
          ยังขาด: {c.missing.join(" · ")} — ตลาดนี้แหล่งข้อมูลให้ไม่ครบ คะแนนคำนวณจากเฉพาะข้อมูลที่มีจริง (ไม่เดา)
        </p>
      )}
      <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
        แหล่ง: {c.priceSource} · {c.fundamentalsSource}
      </p>
    </div>
  );
}
