"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { FactorScores } from "@/lib/types";

const DIMS: { key: keyof FactorScores; label: string }[] = [
  { key: "valuation", label: "Valuation" },
  { key: "growth", label: "Growth" },
  { key: "profitability", label: "Profit" },
  { key: "momentum", label: "Momentum" },
  { key: "health", label: "Health" },
];

export default function FactorRadar({ factors }: { factors: FactorScores }) {
  const data = DIMS.map((d) => ({ dim: d.label, score: factors[d.key] as number }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="dim" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <Radar dataKey="score" stroke="#eab308" fill="#eab308" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
