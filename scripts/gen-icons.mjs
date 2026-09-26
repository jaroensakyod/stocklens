// สร้างไอคอน PWA (PNG ล้วนด้วย zlib — ไม่ต้องพึ่ง dependency) — รัน: node scripts/gen-icons.mjs
// ดีไซน์: พื้นเข้ม + แท่งเทียน 3 เขียว 1 แดง (ครอบคลุม safe-zone สำหรับ maskable)
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size, draw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const px = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = y * (size * 4 + 1) + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  };
  draw(px, size);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const rect = (px, x0, y0, w, h, color) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(x, y, color); };

const BG = [11, 14, 20, 255];
const TEAL = [45, 212, 191, 255];
const ROSE = [251, 113, 133, 255];

function drawCandles(scale = 1) {
  return (px, size) => {
    rect(px, 0, 0, size, size, BG);
    const u = size / 512;
    const bars = [
      { x: 96, y: 300, h: 116, c: TEAL },
      { x: 196, y: 240, h: 176, c: TEAL },
      { x: 296, y: 160, h: 256, c: TEAL },
      { x: 396, y: 220, h: 150, c: ROSE },
    ];
    for (const b of bars) {
      const x = Math.round(b.x * u * scale + (size * (1 - scale)) / 2);
      const y = Math.round(b.y * u * scale + (size * (1 - scale)) / 2);
      rect(px, x, y, Math.round(48 * u * scale), Math.round(b.h * u * scale), b.c);
      rect(px, x, y, Math.round(48 * u * scale), Math.round(10 * u * scale), [255, 255, 255, 40]); // ไฮไลต์หัวแท่ง
    }
    rect(px, Math.round(80 * u), Math.round(430 * u), Math.round(352 * u), Math.round(6 * u), [255, 255, 255, 60]); // เส้นฐาน
  };
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, drawCandles(1)));
writeFileSync("public/icons/icon-512.png", png(512, drawCandles(1)));
writeFileSync("public/icons/icon-maskable-512.png", png(512, drawCandles(0.72))); // เว้น safe-zone 20% รอบ maskable
console.log("✅ สร้าง public/icons/icon-192.png, icon-512.png, icon-maskable-512.png");
