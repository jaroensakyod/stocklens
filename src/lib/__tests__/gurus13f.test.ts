import { describe, expect, it } from "vitest";
import { parse13fXml, buildHoldings } from "../gurus13f";

// fixture สองสไตล์จริงจาก SEC: (1) มี namespace ns1: + <value> หน่วยพัน (Klarman)
// (2) ไม่มี namespace + <value> เป็นดอลลาร์เต็ม (Berkshire) — บั๊กหน่วยที่เคยเจอจริง
const NS_XML = `<?xml version="1.0"?>
<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <ns1:infoTable>
    <ns1:nameOfIssuer>ALPHABET INC</ns1:nameOfIssuer>
    <ns1:value>484744</ns1:value>
    <ns1:shrsOrPrnAmt><ns1:sshPrnamt>1371931</ns1:sshPrnamt></ns1:shrsOrPrnAmt>
  </ns1:infoTable>
  <ns1:infoTable>
    <ns1:nameOfIssuer>STATE STR SPDR S&amp;P 500 ETF T</ns1:nameOfIssuer>
    <ns1:value>8900</ns1:value>
    <ns1:shrsOrPrnAmt><ns1:sshPrnamt>26000</ns1:sshPrnamt></ns1:shrsOrPrnAmt>
  </ns1:infoTable>
</ns1:informationTable>`;

const PLAIN_XML = `<?xml version="1.0"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <infoTable>
    <nameOfIssuer>APPLE INC</nameOfIssuer>
    <value>65954000000</value>
    <shrsOrPrnAmt><sshPrnamt>1000000000</sshPrnamt></shrsOrPrnAmt>
  </infoTable>
</informationTable>`;

describe("parse13fXml", () => {
  it("parse ได้ทั้งแบบมี namespace (ns1:) และแบบธรรมดา", () => {
    const a = parse13fXml(NS_XML);
    expect(a).toHaveLength(2);
    expect(a[0].issuer).toBe("ALPHABET INC");
    expect(a[0].value).toBe(484744);
    expect(a[0].shares).toBe(1371931);
    const b = parse13fXml(PLAIN_XML);
    expect(b[0].issuer).toBe("APPLE INC");
    expect(b[0].value).toBe(65954000000);
  });

  it("decode XML entities: S&amp;P → S&P", () => {
    const a = parse13fXml(NS_XML);
    expect(a[1].issuer).toContain("S&P");
  });
});

describe("buildHoldings — normalize หน่วย + QoQ", () => {
  it("filer ส่ง value เป็น 'หน่วยพัน' (ราคาแฝง <1) → คูณ 1000 ให้อัตโนมัติ", () => {
    const entries = parse13fXml(NS_XML); // ทุกแถว implied price <1 (0.35 และ 0.34) → ค่ากลาง <1 → หน่วยพัน
    const { holdings, total } = buildHoldings({ entries, prevEntries: [] }, {}, 20);
    // รวม = (484744 + 8900) × 1000
    expect(total).toBe(493644 * 1000);
    expect(holdings[0].pct).toBeGreaterThan(0);
    expect(holdings.reduce((acc, h) => acc + h.pct, 0)).toBeCloseTo(100, 0);
  });

  it("filer ส่ง value เป็น 'ดอลลาร์เต็ม' (ราคาแฝง ~66) → ไม่คูณ", () => {
    const entries = parse13fXml(PLAIN_XML); // 65.95B/1B หุ้น ≈ $66 → ดอลลาร์
    const { total } = buildHoldings({ entries, prevEntries: [] }, {}, 20);
    expect(total).toBe(65954000000);
  });

  it("QoQ: ซื้อใหม่ / เพิ่ม >5% / ลด >5% / เท่าเดิม + ขายออกพร้อม prevPct จริง", () => {
    const cur = parse13fXml(NS_XML);
    const prev = parse13fXml(NS_XML).map((e) => ({ ...e }));
    // STATE STR: 26000 → 52000 หุ้น = +100% = increased
    prev[1].shares = 13000;
    // แล้วเพิ่ม "ออกไปแล้วตัวหนึ่ง" ใน prev: SOLDOUT มูลค่า 200000 (of prev total)
    const prevWithExited = [...prev, { issuer: "SOLDOUT INC", value: 200000, shares: 1000 }];
    const { holdings, qoq } = buildHoldings({ entries: cur, prevEntries: prevWithExited }, {}, 20);
    const spy = holdings.find((h) => h.issuer.includes("STATE STR"));
    expect(spy?.change?.type).toBe("increased");
    expect(spy?.change?.deltaPct).toBe(100);
    const googl = holdings.find((h) => h.issuer === "ALPHABET INC");
    expect(googl?.change?.type).toBe("same"); // หุ้นเท่าเดิม
    expect(qoq).toBeTruthy();
    expect(qoq!.exited).toHaveLength(1);
    expect(qoq!.exited[0].issuer).toBe("SOLDOUT INC");
    // prevPct คำนวณจากมูลค่าจริงของ prev (ไม่ใช่ 0 แบบเดิม)
    expect(qoq!.exited[0].prevPct).toBeGreaterThan(0);
  });

  it("ไม่มี prev = ทุกตัวเป็น 'new' และไม่มี qoq", () => {
    const entries = parse13fXml(PLAIN_XML);
    const { holdings, qoq } = buildHoldings({ entries, prevEntries: [] }, {}, 20);
    expect(holdings[0].change?.type).toBe("new");
    expect(qoq).toBeUndefined();
  });
});
