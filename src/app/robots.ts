import type { MetadataRoute } from "next";

// 🤖 robots.txt — อนุญาต search engine ปกติ (Google/Bing/DuckDuckGo) แต่ห้าม AI crawler/scraper ทุกตัว
// (ป้องกันการนำเนื้อหาไปเทรนโมเดล — บังคับจริงร่วมกับการบล็อก UA ใน middleware)
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const aiBots = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-Web", "Claude-SearchBot", "anthropic-ai",
    "CCBot", "Google-Extended", "Google-Extended-AI",
    "Bytespider", "Amazonbot", "PerplexityBot", "Perplexity-User",
    "Diffbot", "YouBot", "Omgilibot", "OMGI", "ImagesiftBot",
    "cohere-ai", "Applebot-Extended", "meta-externalagent", "FacebookBot",
    "VelenPublicWebCrawler", "DuckAssistBot", "Timpibot", "iaskspider",
    "Panscient", "Rowsagent",
  ];
  return {
    rules: [
      // ห้าม AI bot ทุกตัวทั้งเว็บ
      ...aiBots.map((ua) => ({ userAgent: ua, disallow: "/" })),
      // search engine ปกติเข้าได้ ยกเว้นหน้าส่วนตัว
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/report/", "/login", "/portfolio", "/offline"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
