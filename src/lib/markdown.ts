// แปลง markdown ขั้นต่ำ (หัวข้อ/ลิสต์/ตัวหนา/ตาราง) เป็น HTML — ใช้ทั้งหน้าเว็บและหน้ารายงาน PDF
export function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let inList = false;
  const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  const splitRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const isSep = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ตาราง: บล็อกบรรทัดขึ้นต้น `|` ที่บรรทัดที่ 2 เป็น |---|---|
    if (line.trim().startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        block.push(lines[i]);
        i++;
      }
      closeList();
      if (block.length >= 2 && isSep(block[1])) {
        const header = splitRow(block[0]);
        const rows = block.slice(2).map(splitRow);
        const thead = `<thead><tr>${header.map((c) => `<th>${bold(c)}</th>`).join("")}</tr></thead>`;
        const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${bold(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
        out.push(`<table class="md-table">${thead}${tbody}</table>`);
      } else {
        out.push(`<p>${block.map((b) => bold(b.trim())).join("<br>")}</p>`);
      }
      continue;
    }

    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);
    if (h2) {
      closeList();
      out.push(`<h2>${bold(h2[1])}</h2>`);
    } else if (h3) {
      closeList();
      out.push(`<h3>${bold(h3[1])}</h3>`);
    } else if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${bold(li[1])}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p>${bold(line)}</p>`);
    }
    i++;
  }
  closeList();
  return out.join("");
}
