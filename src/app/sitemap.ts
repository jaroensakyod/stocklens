import type { MetadataRoute } from "next";

// 🗺️ sitemap — หน้าสาธารณะหลัก (หน้าส่วนตัว/รายงานสมาชิกไม่ใส่)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();
  const pages: [string, number /* priority */, boolean /* frequent */][] = [
    ["/", 1, true],
    ["/starter", 0.9, true],
    ["/pricing", 0.9, false],
    ["/screener", 0.8, false],
    ["/radar", 0.8, true],
    ["/calendar", 0.8, true],
    ["/earnings", 0.8, true],
    ["/dividend", 0.8, true],
    ["/politics", 0.7, true],
    ["/surge", 0.7, true],
    ["/value", 0.7, false],
    ["/model-portfolio", 0.7, true],
    ["/track-record", 0.7, false],
    ["/about", 0.5, false],
    ["/privacy", 0.3, false],
    ["/terms", 0.3, false],
  ];
  return pages.map(([p, priority, frequent]) => ({
    url: base + p,
    lastModified: now,
    changeFrequency: frequent ? ("daily" as const) : ("weekly" as const),
    priority,
  }));
}
