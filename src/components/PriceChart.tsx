"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/types";

const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"] as const;

export default function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1Y");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);
  const volRef = useRef<ReturnType<IChartApi["addHistogramSeries"]> | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr("");
    fetch(`/api/chart?s=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.candles?.length) setCandles(j.candles);
        else setErr("ไม่พบข้อมูลกราฟสำหรับสัญลักษณ์นี้");
      })
      .catch(() => setErr("โหลดกราฟไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [symbol, range]);

  useEffect(() => {
    if (!ref.current || !candles.length) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a1a1aa", fontFamily: "inherit" },
      grid: { vertLines: { color: "rgba(63,63,70,0.3)" }, horzLines: { color: "rgba(63,63,70,0.3)" } },
      width: ref.current.clientWidth,
      height: 360,
      timeScale: { borderColor: "rgba(63,63,70,0.6)" },
      rightPriceScale: { borderColor: "rgba(63,63,70,0.6)" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: "#10b981", downColor: "#f43f5e", borderVisible: false, wickUpColor: "#10b981", wickDownColor: "#f43f5e",
    });
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    series.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
    );
    vol.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)",
      }))
    );
    seriesRef.current = series;
    volRef.current = vol;
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles]);

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${range === r ? "bg-accent text-zinc-950" : "bg-base-800 text-zinc-400 hover:bg-base-700"}`}
          >
            {r}
          </button>
        ))}
        {loading && <span className="text-xs text-zinc-500 self-center ml-2">กำลังโหลด…</span>}
      </div>
      <div className="card p-2">
        {err ? (
          <div className="h-[360px] flex items-center justify-center text-zinc-500 text-sm">{err}</div>
        ) : (
          <div ref={ref} className="w-full" />
        )}
      </div>
    </div>
  );
}
