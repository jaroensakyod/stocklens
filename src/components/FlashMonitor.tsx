// Flash Monitor — สแกนข่าวสด 12 ชม. → จับคู่ธีม Radar → แนะนำเหตุการณ์ที่ควรออก Flash Report
import { useState } from "react";

interface Item { title: string; publisher: string; link: string; time: number; themes: string[]; nodes: string[] }

export default function FlashMonitor() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");

  const scan = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/flash-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": sessionStorage.getItem("sl-admin") || "" },
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error || "สแกนไม่สำเร็จ");
      else setItems(j.items ?? []);
    } catch {
      setErr("สแกนไม่สำเร็จ");
    }
    setBusy(false);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-bold text-zinc-100">📡 Flash Monitor — สแกนข่าวหาเหตุการณ์ที่ควรออก Flash</h3>
        <button className="btn-primary !py-1.5 !px-3 text-xs shrink-0" onClick={scan} disabled={busy}>
          {busy ? "กำลังสแกน…" : "📡 สแกนข่าวตอนนี้"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">ดึงข่าวสด 12 ชม. → จับคู่กับธีม Radar → รายการที่โผล่คือ "เหตุการณ์ที่เข้าเกณฑ์ Flash Report" — กดเปิดรายงานแล้วพิมพ์ PDF ส่งกลุ่ม Pro ได้เลย</p>
      {err && <p className="text-xs text-down">{err}</p>}
      {items && items.length === 0 && <p className="text-xs text-zinc-500">12 ชม.ล่าสุดไม่มีข่าวที่เข้าเกณฑ์ — สบายใจได้</p>}
      {items && items.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((it) => (
            <div key={it.title} className="bg-base-850 rounded-lg p-3">
              <div className="text-xs text-zinc-200 leading-snug">{it.title}</div>
              <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {it.themes.slice(0, 3).map((t) => (
                    <span key={t} className="chip bg-accent/10 text-accent-soft !text-[10px]">{t}</span>
                  ))}
                  <span className="text-[10px] text-zinc-600">{it.publisher}</span>
                </div>
                <a
                  className="btn-ghost !py-1 !px-2.5 !text-[11px]"
                  href={`/report/print?type=flash&ev=${encodeURIComponent(it.title)}&tier=pro`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ⚡ เปิด Flash Report
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
