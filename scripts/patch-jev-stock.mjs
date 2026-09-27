// ① AIAnalysis + ② XrayPanel — เสียบ Jev (เวอร์ชันไฟล์ กัน heredoc พัง)
import { readFileSync, writeFileSync } from "node:fs";

// ---------- AIAnalysis ----------
const p = "src/components/AIAnalysis.tsx";
let s = readFileSync(p, "utf8");
if (!s.includes("jev-check")) {
  s = s.replace(
    'const [persona, setPersona] = useState("");',
    'const [persona, setPersona] = useState("");\n  const [jev, setJev] = useState<{ verdictTh: string | null; verdictCls: string; blindSpotTh: string | null; stance: number | null } | null>(null);'
  );
  s = s.replace(
    "const boxRef = useRef<HTMLDivElement>(null);",
    "const boxRef = useRef<HTMLDivElement>(null);\n  const textRef = useRef(\"\");"
  );
  s = s.replace(
    "        setText((t) => t + dec.decode(value, { stream: true }));",
    "        setText((t) => { textRef.current = t + dec.decode(value, { stream: true }); return textRef.current; });"
  );
  s = s.replace(
    '      setMode("done");',
    [
      '      setMode("done");',
      "      // 🧠 Jev มุมมองที่สอง (fire-and-forget)",
      "      setJev(null);",
      '      fetch("/api/ai/jev-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker, text: textRef.current }) })',
      "        .then(r => r.json()).then(j => { if (j && j.text) setJev(j); }).catch(() => {});",
    ].join("\n")
  );
  const boxLine = '<div ref={boxRef} className="ai-md max-h-[560px] overflow-y-auto text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />';
  const extra = [
    boxLine,
    '          {mode === "done" && !jev && <p className="text-[11px] text-zinc-600 mt-2">🧠 Jev กำลังตรวจบทวิเคราะห์เป็นมุมมองที่สอง…</p>}',
    "          {jev && (",
    '            <div className="mt-3 rounded-xl bg-base-900 border border-base-700 px-3 py-2.5">',
    '              <div className="text-xs font-bold text-zinc-200">🧠 มุมมองที่สองจาก Jev</div>',
    '              <p className={"text-[12px] mt-1 font-semibold " + jev.verdictCls}>{jev.verdictTh}</p>',
    '              {jev.blindSpotTh && <p className="text-[11px] text-zinc-500 mt-0.5">จุดที่ควรเช็กเพิ่ม: {jev.blindSpotTh}{jev.stance !== null ? " · โทนบทวิเคราะห์ " + (jev.stance >= 3.5 ? "เอียงบวก" : jev.stance <= 1.5 ? "เอียงลบ" : "ค่อนข้างกลาง") + " (" + jev.stance.toFixed(1) + "/4)" : ""}</p>}',
    "            </div>",
    "          )}",
  ].join("\n");
  if (!s.includes(boxLine)) { console.log("❌ AIAnalysis box line not found"); process.exit(1); }
  s = s.replace(boxLine, extra);
  writeFileSync(p, s);
  console.log("✓ AIAnalysis patched");
}

// ---------- XrayPanel ----------
const xp = "src/components/XrayPanel.tsx";
let x = readFileSync(xp, "utf8");
if (!x.includes("jevPosture")) {
  x = x.replace(
    /const \[res, setRes\] = useState/,
    "const [jevPosture, setJevPosture] = useState<{ verdictTh: string | null; blindSpotTh: string | null } | null>(null)\n  const [res, setRes] = useState"
  );
  const m = x.match(/const\s+(\w+)\s*=\s*await res\.json\(\)/);
  const varName = m?.[1] ?? "data";
  x = x.replace(
    new RegExp(`const ${varName} = await res\\.json\\(\\)`),
    [
      `const ${varName} = await res.json()`,
      "      // 🧠 Jev ประเมิน posture พอร์ตจากผล X-ray (fire-and-forget)",
      '      const summary = JSON.stringify({ holdings: ' + varName + '.holdings?.slice(0, 12), risk: ' + varName + '.risk, concentration: ' + varName + '.concentration, warnings: ' + varName + '.warnings, factors: ' + varName + '.factors }).slice(0, 2000);',
      '      fetch("/api/ai/jev-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: "PORTFOLIO X-RAY", text: summary }) })',
      "        .then(r => r.json()).then(j => { if (j && j.verdictTh) setJevPosture({ verdictTh: j.verdictTh, blindSpotTh: j.blindSpotTh }); }).catch(() => {});",
    ].join("\n")
  );
  // render: หา container หลักของผลลัพธ์ — เพิ่มแผงท้ายสุดของ component (ก่อนปิด div รากสุดท้าย)
  // ใช้จุด: แทรกก่อนปิดท้าย — หา "</div>\n  );\n}" ตัวสุดท้าย
  const tail = x.lastIndexOf("</div>\n  );\n}");
  if (tail < 0) { console.log("❌ XrayPanel tail not found"); process.exit(1); }
  const panel = [
    "      {jevPosture && (",
    '        <div className="mt-4 rounded-xl bg-base-900 border border-base-700 px-3 py-2.5">',
    '          <div className="text-xs font-bold text-zinc-200">🧠 Jev ประเมินพอร์ตนี้</div>',
    '          <p className="text-[12px] mt-1 font-semibold text-zinc-200">{jevPosture.verdictTh}</p>',
    '          {jevPosture.blindSpotTh && <p className="text-[11px] text-zinc-500 mt-0.5">จุดบอดที่ควรเช็กเพิ่ม: {jevPosture.blindSpotTh}</p>',
    "        </div>",
    "      )}",
    "    </div>\n  );\n}",
  ].join("\n");
  x = x.slice(0, tail) + panel;
  writeFileSync(xp, x);
  console.log("✓ XrayPanel patched");
}
