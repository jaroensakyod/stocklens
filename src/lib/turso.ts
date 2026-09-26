// ===== Turso (libSQL/SQLite) — "คลังข้อมูลถาวรของเรา" เพื่อพัฒนา AI =====
// ต่างจาก Redis (แคชเพื่อเสิร์ฟเร็ว): ที่นี่เก็บถาวรเป็นระเบียบ SQL เพื่อวิเคราะห์ย้อนหลัง/เทรนโมเดล
// ตาราง: prices_daily (OHLCV+close) · scores_daily (Score 6 เสา) · news (ข่าว+คะแนน Jev สะสม) · themes_daily (heat/mood ธีม)
// ทุกฟังก์ชัน "เงียบสำเร็จ" — Turso ล่ม/ไม่ได้ตั้ง env = ไม่กระทบเว็บ แค่ไม่สะสมข้อมูลวันนั้น
import { createClient } from "@libsql/client";

function client() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return null;
  return createClient({ url, authToken: token });
}

let schemaReady = false;

/** สร้างตารางครั้งแรก (idempotent) */
export async function ensureSchema(): Promise<boolean> {
  if (schemaReady) return true;
  const c = client();
  if (!c) return false;
  try {
    await c.execute(`CREATE TABLE IF NOT EXISTS prices_daily (
      date TEXT NOT NULL, symbol TEXT NOT NULL,
      open REAL, high REAL, low REAL, close REAL, volume INTEGER, chg_pct REAL,
      PRIMARY KEY (date, symbol))`);
    await c.execute(`CREATE TABLE IF NOT EXISTS scores_daily (
      date TEXT NOT NULL, symbol TEXT NOT NULL,
      total INTEGER, quality INTEGER, valuation INTEGER, momentum INTEGER, news INTEGER, street INTEGER, safety INTEGER,
      confidence INTEGER,
      PRIMARY KEY (date, symbol))`);
    await c.execute(`CREATE TABLE IF NOT EXISTS news (
      headline_hash TEXT PRIMARY KEY,
      title TEXT NOT NULL, source TEXT, link TEXT, pub_time INTEGER, lang TEXT,
      theme_id TEXT, jev_sentiment TEXT, jev_impact REAL,
      jev_substantive INTEGER, jev_suspicious INTEGER, heuristic_risk INTEGER, credibility TEXT,
      fetched_at INTEGER)`);
    await c.execute(`CREATE TABLE IF NOT EXISTS themes_daily (
      date TEXT NOT NULL, theme_id TEXT NOT NULL,
      heat INTEGER, mood TEXT, mood_score REAL, news_count INTEGER,
      PRIMARY KEY (date, theme_id))`);
    schemaReady = true;
    return true;
  } catch {
    return false;
  }
}

export interface PriceRow { date: string; symbol: string; open?: number | null; high?: number | null; low?: number | null; close?: number | null; volume?: number | null; chgPct?: number | null }

/** บันทึกราคารายวัน (upsert — วันเดียวกันซ้ำ = ทับด้วยของใหม่กว่า) */
export async function savePrices(rows: PriceRow[]): Promise<number> {
  if (!rows.length) return 0;
  if (!(await ensureSchema())) return 0;
  const c = client();
  if (!c) return 0;
  try {
    const SQL = `INSERT INTO prices_daily (date, symbol, open, high, low, close, volume, chg_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (date, symbol) DO UPDATE SET open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume, chg_pct=excluded.chg_pct`;
    await c.batch(
      rows.map((r) => ({ sql: SQL, args: [r.date, r.symbol, r.open ?? null, r.high ?? null, r.low ?? null, r.close ?? null, r.volume ?? null, r.chgPct ?? null] })),
      "write"
    );
    return rows.length;
  } catch {
    return 0;
  }
}

export interface ScoreRow { date: string; symbol: string; total: number; quality: number | null; valuation: number | null; momentum: number | null; news: number | null; street: number | null; safety: number | null; confidence: number }

export async function saveScore(r: ScoreRow): Promise<void> {
  if (!(await ensureSchema())) return;
  const c = client();
  if (!c) return;
  try {
    await c.execute({
      sql: `INSERT INTO scores_daily (date, symbol, total, quality, valuation, momentum, news, street, safety, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (date, symbol) DO UPDATE SET total=excluded.total, quality=excluded.quality, valuation=excluded.valuation, momentum=excluded.momentum, news=excluded.news, street=excluded.street, safety=excluded.safety, confidence=excluded.confidence`,
      args: [r.date, r.symbol, r.total, r.quality, r.valuation, r.momentum, r.news, r.street, r.safety, r.confidence],
    });
  } catch {
    // เงียบ — ไม่กระทบเว็บ
  }
}

export interface NewsRow {
  title: string; source?: string; link?: string; pubTime?: number; lang?: string; themeId?: string;
  jevSentiment?: string; jevImpact?: number; jevSubstantive?: boolean; jevSuspicious?: boolean;
  heuristicRisk?: number; credibility?: string;
}

import { createHash } from "crypto";
const hashTitle = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 20);

/** เก็บข่าว (ข้าวซ้ำอัตโนมัติ — headline ซ้ำข้ามวันไม่เพิ่ม) */
export async function saveNews(items: NewsRow[]): Promise<number> {
  if (!items.length) return 0;
  if (!(await ensureSchema())) return 0;
  const c = client();
  if (!c) return 0;
  try {
    const SQL = `INSERT INTO news (headline_hash, title, source, link, pub_time, lang, theme_id, jev_sentiment, jev_impact, jev_substantive, jev_suspicious, heuristic_risk, credibility, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (headline_hash) DO NOTHING`;
    await c.batch(
      items.map((n) => ({
        sql: SQL,
        args: [
          hashTitle(n.title), n.title, n.source ?? null, n.link ?? null, n.pubTime ?? null, n.lang ?? null,
          n.themeId ?? null, n.jevSentiment ?? null, n.jevImpact ?? null,
          n.jevSubstantive === undefined ? null : n.jevSubstantive ? 1 : 0,
          n.jevSuspicious === undefined ? null : n.jevSuspicious ? 1 : 0,
          n.heuristicRisk ?? null, n.credibility ?? null, Date.now(),
        ],
      })),
      "write"
    );
    return items.length;
  } catch {
    return 0;
  }
}

export async function saveThemeDay(date: string, themeId: string, heat: number, mood: string | null, moodScore: number | null, newsCount: number): Promise<void> {
  if (!(await ensureSchema())) return;
  const c = client();
  if (!c) return;
  try {
    await c.execute({
      sql: `INSERT INTO themes_daily (date, theme_id, heat, mood, mood_score, news_count) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (date, theme_id) DO UPDATE SET heat=excluded.heat, mood=excluded.mood, mood_score=excluded.mood_score, news_count=excluded.news_count`,
      args: [date, themeId, heat, mood, moodScore, newsCount],
    });
  } catch {
    // เงียบ
  }
}

/** สถิติคลัง — ใช้ใน /api/admin/data-status */
export async function dataStats(): Promise<Record<string, unknown> | null> {
  if (!(await ensureSchema())) return null;
  const c = client();
  if (!c) return null;
  try {
    const q = async (sql: string) => Number(((await c.execute(sql)).rows[0] as { n?: number | bigint })?.n ?? 0);
    const p = await c.execute(`SELECT COUNT(*) n, MIN(date) a, MAX(date) b FROM prices_daily`);
    const s = await c.execute(`SELECT COUNT(*) n, MIN(date) a, MAX(date) b FROM scores_daily`);
    const n = await c.execute(`SELECT COUNT(*) n FROM news`);
    const t = await c.execute(`SELECT COUNT(*) n, MIN(date) a, MAX(date) b FROM themes_daily`);
    const row = (r: { rows: Record<string, unknown>[] }) => ({ rows: Number(r.rows[0]?.n ?? 0), from: r.rows[0]?.a ?? null, to: r.rows[0]?.b ?? null });
    return { prices: row(p), scores: row(s), news: { rows: Number(n.rows[0]?.n ?? 0) }, themes: row(t) };
  } catch {
    return null;
  }
}
