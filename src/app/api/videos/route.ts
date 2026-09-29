import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/videos — วิดีโอล่าสุดจากช่อง YouTube ของเรา (ผ่าน RSS สาธารณะ ไม่ต้องใช้ API key)
// ตั้งค่า: NEXT_PUBLIC_YT_CHANNEL_ID=UC... ใน .env.local — ไม่ตั้ง = คืน list ว่างให้หน้าเว็บแสดง empty state
export async function GET() {
  const channelId = process.env.NEXT_PUBLIC_YT_CHANNEL_ID || "";
  if (!channelId) return NextResponse.json({ videos: [], configured: false });
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const videos = [...xml.matchAll(/<entry>[\s\S]*?<yt:videoId>([\w-]+)<\/yt:videoId>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<published>([^<]+)<\/published>/g)]
      .slice(0, 12)
      .map((m) => ({ id: m[1], title: m[2].trim(), publishedAt: m[3] }));
    return NextResponse.json({ videos, configured: true });
  } catch (e) {
    return NextResponse.json({ videos: [], configured: true, error: (e as Error).message.slice(0, 100) });
  }
}
