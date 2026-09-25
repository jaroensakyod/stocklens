import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/yahoo";
import { THEMES, getNode } from "@/lib/radar";
import { adminCode } from "@/lib/admin";

export const dynamic = "force-dynamic";

// จับคู่ข่าว→ธีม/โหนด โดยไม่ดึงราคา (เบา) — สำหรับ Flash Monitor
function matchHeadline(text: string): { themes: string[]; nodes: string[] } {
  const lower = " " + text.toLowerCase() + " ";
  const themesHit: string[] = [];
  const nodeIds = new Set<string>();
  for (const t of THEMES) {
    let hits = 0;
    for (const k of t.keys) if (lower.includes(k.toLowerCase())) hits += 1;
    for (const id of t.impactIds) {
      const node = getNode(id);
      if (!node) continue;
      const names = [node.name];
      for (const alias of node.name.split("/")) names.push(alias.trim());
      if (names.some((n) => n.length >= 3 && lower.includes(n.toLowerCase()))) hits += 1.5;
    }
    if (hits >= 1) {
      themesHit.push(t.emoji + " " + t.name);
      for (const id of t.impactIds) nodeIds.add(id);
    }
  }
  return { themes: themesHit, nodes: [...nodeIds] };
}

// POST /api/admin/flash-scan — สแกนข่าวใหม่หาเหตุการณ์ที่เข้าเกณฑ์ Flash Report
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-code") !== adminCode()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const queries = ["stock market", "oil", "gold", "federal reserve", "china"];
  const seen = new Set<string>();
  const items: { title: string; publisher: string; link: string; time: number; themes: string[]; nodes: string[] }[] = [];
  await Promise.all(
    queries.map(async (q) => {
      try {
        const news = await getNews(q, 10, 12 * 3600_000);
        for (const n of news) {
          if (seen.has(n.title)) continue;
          seen.add(n.title);
          const m = matchHeadline(n.title);
          if (m.themes.length) items.push({ title: n.title, publisher: n.publisher, link: n.link, time: n.time, themes: m.themes, nodes: m.nodes });
        }
      } catch {}
    })
  );
  items.sort((a, b) => b.time - a.time);
  return NextResponse.json({ scanned: seen.size, matched: items.length, items: items.slice(0, 12) });
}
