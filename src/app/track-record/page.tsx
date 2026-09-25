import trackJson from "@/data/track-record.json";
import Link from "next/link";

export default function TrackRecordPage() {
  const entries = (trackJson as { entries: { id: string; date: string; thesis: string; tickers: string[]; stance: string; status: string; resultPct?: number; note?: string }[] }).entries;
  const closed = entries.filter((e) => e.status !== "open");
  const wins = closed.filter((e) => e.status === "win").length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  const statusStyle: Record<string, string> = {
    open: "bg-zinc-500/15 text-zinc-400",
    win: "bg-emerald-500/15 text-emerald-400",
    loss: "bg-rose-500/15 text-rose-400",
    flat: "bg-amber-500/15 text-amber-400",
  };
  const statusLabel: Record<string, string> = { open: "ยังเปิดอยู่", win: "ถูก", loss: "ผิด", flat: "เที่ยว" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">🏆 Track Record สาธารณะ</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          เราบันทึกทุกสมมติฐานที่เคยเขียนไว้ — ถูกก็บอกว่าถูก ผิดก็บอกว่าผิด ไม่ลบ ไม่แก้ นี่คือเหตุผลที่คุณควรเชื่อ (หรือไม่เชื่อ) เรา
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-zinc-50">{entries.length}</div>
          <div className="text-xs text-zinc-500">สมมติฐานทั้งหมด</div>
        </div>
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-accent-soft">{closed.length ? winRate + "%" : "—"}</div>
          <div className="text-xs text-zinc-500">Win rate (ที่ปิดแล้ว)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="num text-2xl font-bold text-zinc-50">{entries.filter((e) => e.status === "open").length}</div>
          <div className="text-xs text-zinc-500">กำลังติดตาม</div>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-xs text-zinc-500">{e.date}</span>
              <span className={`chip ${statusStyle[e.status]}`}>{statusLabel[e.status]}</span>
              <span className={`chip ${e.stance === "bullish" ? "bg-up/10 text-up" : e.stance === "bearish" ? "bg-down/10 text-down" : "bg-zinc-500/10 text-zinc-400"}`}>
                {e.stance === "bullish" ? "มองบวก" : e.stance === "bearish" ? "มองลบ" : "กลาง"}
              </span>
              {e.resultPct !== undefined && (
                <span className={`num text-sm font-bold ${e.resultPct >= 0 ? "text-up" : "text-down"}`}>
                  {e.resultPct >= 0 ? "+" : ""}{e.resultPct}%
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-200 mt-2 leading-relaxed">{e.thesis}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {e.tickers.map((t) => (
                <Link key={t} href={`/stock/${t}`} className="chip bg-base-800 text-zinc-300 border border-base-700 hover:text-zinc-50">{t}</Link>
              ))}
            </div>
            {e.note && <p className="text-xs text-zinc-600 mt-2">{e.note}</p>}
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600">
        * รายการที่ระบุ &ldquo;ตัวอย่างสาธิต&rdquo; เป็นข้อมูลตัวอย่างสำหรับโชว์รูปแบบ — ลบออกได้ที่ src/data/track-record.json
        เมื่อเริ่มบันทึกจริง · ผลวัดจากราคาปิดวันประกาศเทียบวันติดตามผล ไม่รวมค่าธรรมเนียม
      </p>
    </div>
  );
}
