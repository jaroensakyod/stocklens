"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  Handle,
  Background,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { ChainResult, EventAnalysis } from "@/lib/types";

// 🕸️ กราฟความเชื่อมโยงเหตุการณ์ — สร้างบน React Flow + dagre (auto-layout ซ้าย→ขวา)
// node เป็น HTML+Tailwind จริง: ตัวไทยเรียงสวย ใส่ chip/สี/animation ได้เต็มที่ + ลาก/ซูมได้

type FlowData = Record<string, unknown>;

const NODE_W = { event: 220, chain: 200, stock: 230 };
const NODE_H = { event: 110, chain: 86, stock: 76 };

// ---------- โหนด: เหตุการณ์ ----------
function EventNode({ data }: NodeProps) {
  const d = data as FlowData & { label: string };
  return (
    <div className="px-4 py-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border-2 border-amber-500/60 shadow-lg shadow-amber-500/10 max-w-[230px]">
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !border-amber-300" />
      <p className="text-[10px] font-bold text-amber-400 tracking-wide">⚡ เหตุการณ์</p>
      <p className="text-xs text-zinc-100 font-semibold leading-relaxed mt-1 break-words">{d.label}</p>
    </div>
  );
}

// ---------- โหนด: ตัวกลางที่กระทบ ----------
function ChainNode({ data }: NodeProps) {
  const d = data as FlowData & { label: string; reason?: string; up: boolean };
  return (
    <div className={`px-3.5 py-2.5 rounded-2xl border-2 max-w-[210px] ${d.up ? "bg-teal-500/10 border-teal-400/60" : "bg-rose-500/10 border-rose-400/60"}`}>
      <Handle type="target" position={Position.Left} className={d.up ? "!bg-teal-400" : "!bg-rose-400"} />
      <Handle type="source" position={Position.Right} className={d.up ? "!bg-teal-400" : "!bg-rose-400"} />
      <p className={`text-[10px] font-bold tracking-wide ${d.up ? "text-teal-300" : "text-rose-300"}`}>{d.up ? "▲ หนุนราคา" : "▼ แรงกดดัน"}</p>
      <p className="text-[13px] text-zinc-50 font-bold leading-snug mt-0.5">{d.label}</p>
      {d.reason && <p className="text-[10px] text-zinc-500 leading-snug mt-1 line-clamp-2">{d.reason}</p>}
    </div>
  );
}

// ---------- โหนด: หุ้น (ได้/เสียประโยชน์) ----------
function StockNode({ data }: NodeProps) {
  const d = data as FlowData & { ticker: string; reason: string; pct: number | null; price: number | null; pos: boolean; strong: boolean };
  return (
    <a
      href={`/stock/${encodeURIComponent(d.ticker)}`}
      title={d.reason}
      className={`block w-full h-full px-3 py-2 rounded-xl border transition-transform hover:scale-[1.04] ${
        d.pos ? "bg-emerald-500/10 border-emerald-400/60 hover:border-emerald-300" : "bg-rose-500/10 border-rose-400/60 hover:border-rose-300"
      }`}
    >
      <Handle type="target" position={Position.Left} className={d.pos ? "!bg-emerald-400" : "!bg-rose-400"} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold text-zinc-50 truncate">
          {d.pos ? "✅" : "❌"} {d.ticker}
        </span>
        {d.pct !== null && (
          <span className={`num text-[11px] font-extrabold shrink-0 px-1.5 py-0.5 rounded-md ${d.pct >= 0 ? "text-emerald-300 bg-emerald-500/15" : "text-rose-300 bg-rose-500/15"}`}>
            {d.pct >= 0 ? "+" : ""}{d.pct.toFixed(1)}%
          </span>
        )}
      </div>
      {d.price !== null && <span className="num text-[9.5px] text-zinc-500">{d.price.toFixed(2)}</span>}
      <p className="text-[10px] text-zinc-400 leading-tight mt-0.5 line-clamp-2">{d.reason}</p>
      {d.strong && <span className="text-[9px] text-zinc-500">ผลกระทบแรง</span>}
    </a>
  );
}

const NODE_TYPES = { event: EventNode, chain: ChainNode, stock: StockNode };

// ---------- dagre: จัด layout อัตโนมัติ ซ้าย→ขวา ----------
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 110, nodesep: 18, edgesep: 24, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W[n.type as keyof typeof NODE_W], height: NODE_H[n.type as keyof typeof NODE_H] });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } };
  });
}

export default function ImpactGraph({ result }: { result: EventAnalysis }) {
  const { nodes, edges } = useMemo(() => {
    const chains = result.chains.filter((c) => c.stocks.length > 0);
    const nodes: Node<FlowData>[] = [];
    const edges: Edge[] = [];

    const eventText = result.input.length > 110 ? result.input.slice(0, 107) + "…" : result.input;
    nodes.push({
      id: "event",
      type: "event",
      position: { x: 0, y: 0 },
      data: { label: eventText },
      draggable: true,
    });

    chains.forEach((c, ci) => {
      const up = c.stocks.filter((s) => s.direction === "positive").length >= c.stocks.length / 2;
      const cid = `chain-${ci}`;
      nodes.push({
        id: cid,
        type: "chain",
        position: { x: 0, y: 0 },
        data: { label: c.name, reason: c.reason, up },
        draggable: true,
      });
      edges.push({
        id: `e-${ci}`,
        source: "event",
        target: cid,
        style: { stroke: up ? "#2dd4bf" : "#fb7185", strokeWidth: 2, opacity: 0.8 },
      });

      // จัดกลุ่มให้สวย: ได้ประโยชน์ ✅ ก่อน เสียประโยชน์ ❌ แล้วเรียงตามความแรง (แรง→เบา)
      const sorted = [...c.stocks].sort((a, b) => {
        if (a.direction !== b.direction) return a.direction === "positive" ? -1 : 1;
        const w = { strong: 0, medium: 1, weak: 2 } as const;
        return w[a.strength] - w[b.strength];
      });
      sorted.forEach((s, si) => {
        const sid = `s-${ci}-${si}`;
        const pct = s.quote && isFinite(s.quote.changePct) ? s.quote.changePct : null;
        nodes.push({
          id: sid,
          type: "stock",
          position: { x: 0, y: 0 },
          data: { ticker: s.ticker, reason: s.reason, pct, price: s.quote && isFinite(s.quote.price) ? s.quote.price : null, pos: s.direction === "positive", strong: s.strength === "strong" },
          draggable: true,
        });
        edges.push({
          id: `se-${ci}-${si}`,
          source: cid,
          target: sid,
          style: {
            stroke: s.direction === "positive" ? "#34d399" : "#fb7185",
            strokeWidth: s.strength === "strong" ? 2.4 : s.strength === "medium" ? 1.6 : 1.1,
            opacity: 0.75,
            strokeDasharray: s.strength === "weak" ? "5 5" : undefined,
          },
        });
      });
    });

    return { nodes: layoutNodes(nodes, edges), edges };
  }, [result]);

  if (nodes.length <= 1) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <h3 className="text-sm font-bold text-zinc-100">🕸️ กราฟความเชื่อมโยง — เหตุการณ์ส่งผลถึงใคร</h3>
        <span className="text-[10px] text-zinc-600">ลากโหนดได้ · ซูมด้วยล้อเมาส์/นิ้ว · คลิกหุ้นเข้าหน้าวิเคราะห์</span>
      </div>
      <div className="h-[560px] rounded-xl overflow-hidden bg-base-900/40">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.6}
          nodesConnectable={false}
          defaultEdgeOptions={{ type: "smoothstep" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#27272a" />
        </ReactFlow>
      </div>
      <p className="text-[10px] text-zinc-600 mt-1.5">
        เส้นหนา = ผลกระทบแรง · เส้นประ = เบา · % คือราคาหุ้นวันนี้ (delay ~15 นาที) · เหตุผลเต็มเห็นตอนเอาเมาส์ชี้หุ้น
      </p>
    </div>
  );
}
