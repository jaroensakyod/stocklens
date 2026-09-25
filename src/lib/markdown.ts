// แปลง markdown ขั้นต้ำ (หัวข้อ/ลิสต์/ตัวหนา) เป็น HTML — ใช้ทั้งหน้าเว็บและหน้ารายงาน PDF
export function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let inList = false;
  const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);
    if (h2) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${bold(h2[1])}</h2>`);
    } else if (h3) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${bold(h3[1])}</h3>`);
    } else if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${bold(li[1])}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${bold(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}
