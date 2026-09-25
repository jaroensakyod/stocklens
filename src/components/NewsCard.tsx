"use client";

import { useState } from "react";

export default function NewsCard({ title, publisher, link, time, aiAvailable }: { title: string; publisher: string; link: string; time: number; aiAvailable: boolean }) {
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
        body: JSON.stringify({ title, publisher }),
      });
      const json = await res.json();
      setSummary(json.summary || (aiAvailable ? "สรุปไม่สำเร็จชั่วคราว" : "🔒 ต้องตั้ง AI key ก่อน (.env.local) จึงสรุปข่าวเป็นไทยได้"));
    } catch {
      setSummary("เกิดข้อผิดพลาด");
    }
    setLoading(false);
  };

  const dateStr = time ? new Date(time).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="card card-hover p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">{publisher}</span>
        {dateStr && <span>· {dateStr}</span>}
      </div>
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-100 leading-snug hover:text-accent-soft">
        {title}
      </a>
      <div className="mt-auto flex items-center gap-2">
        <button className="btn-ghost !py-1 !px-2.5 text-xs" onClick={summarize}>
          {loading ? "กำลังสรุป…" : "🇹🇭 สรุปไทย"}
        </button>
        {open && summary && <p className="text-xs text-zinc-400 leading-relaxed">{summary}</p>}
      </div>
    </div>
  );
}
