import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { appendFile, readFile } from "node:fs/promises"
import { usageDbPath, loopUsagePath } from "./paths"

// ── Layer 1: per-loop usage.jsonl (SoT) ──

export interface UsageEntry {
  ts: string
  loopId: string
  user: string
  model: string
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
  session: number
}

export async function appendLoopUsage(loopId: string, entries: UsageEntry[]): Promise<void> {
  if (entries.length === 0) return
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n"
  await appendFile(loopUsagePath(loopId), lines)
}

export async function appendLoopUsageClear(loopId: string, session: number, ts: string): Promise<void> {
  await appendFile(loopUsagePath(loopId), JSON.stringify({ type: "clear", session, ts }) + "\n")
}

export async function readLoopUsage(loopId: string): Promise<UsageEntry[]> {
  const p = loopUsagePath(loopId)
  if (!existsSync(p)) return []
  let raw: string
  try { raw = await readFile(p, "utf8") } catch { return [] }
  const entries: UsageEntry[] = []
  for (const line of raw.split("\n")) {
    if (!line) continue
    try {
      const obj = JSON.parse(line)
      if (obj.type === "clear") continue
      entries.push(obj as UsageEntry)
    } catch {}
  }
  return entries
}

// ── Layer 2: workspace usage.db (SQLite, rebuildable from L1) ──

let _db: Database | null = null

function db(): Database {
  if (_db) return _db
  const d = new Database(usageDbPath(), { create: true })
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ts            TEXT    NOT NULL,
      loop_id       TEXT    NOT NULL,
      user          TEXT    NOT NULL,
      model         TEXT    NOT NULL,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read    INTEGER NOT NULL DEFAULT 0,
      cache_create  INTEGER NOT NULL DEFAULT 0,
      session_num   INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage(user, ts);
    CREATE INDEX IF NOT EXISTS idx_usage_loop ON usage(loop_id);
    CREATE INDEX IF NOT EXISTS idx_usage_ts   ON usage(ts);
  `)
  _db = d
  return d
}

const INSERT_SQL = `
  INSERT INTO usage (ts, loop_id, user, model, input_tokens, output_tokens, cache_read, cache_create, session_num)
  VALUES ($ts, $loopId, $user, $model, $input, $output, $cacheRead, $cacheCreate, $session)
`

export function insertUsageDb(entries: UsageEntry[]): void {
  if (entries.length === 0) return
  const d = db()
  const stmt = d.prepare(INSERT_SQL)
  const tx = d.transaction(() => {
    for (const e of entries) {
      stmt.run({
        $ts: e.ts,
        $loopId: e.loopId,
        $user: e.user,
        $model: e.model,
        $input: e.input,
        $output: e.output,
        $cacheRead: e.cacheRead,
        $cacheCreate: e.cacheCreate,
        $session: e.session,
      })
    }
  })
  tx()
}

// ── Query helpers (replace old full-scan recompute functions) ──

type TokenUsageEntry = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export function queryUserTokenUsage(userId: string): Record<string, TokenUsageEntry> {
  const rows = db().query(`
    SELECT model,
           SUM(input_tokens)  AS input,
           SUM(output_tokens) AS output,
           SUM(cache_read)    AS cacheRead,
           SUM(cache_create)  AS cacheCreate
    FROM usage WHERE user = $user
    GROUP BY model
  `).all({ $user: userId }) as Array<{ model: string; input: number; output: number; cacheRead: number; cacheCreate: number }>

  const result: Record<string, TokenUsageEntry> = {}
  for (const r of rows) {
    result[r.model] = {
      inputTokens: r.input,
      outputTokens: r.output,
      cacheReadInputTokens: r.cacheRead,
      cacheCreationInputTokens: r.cacheCreate,
    }
  }
  return result
}

export function queryWorkspaceTokenUsage(): Record<string, TokenUsageEntry> {
  const rows = db().query(`
    SELECT model,
           SUM(input_tokens)  AS input,
           SUM(output_tokens) AS output,
           SUM(cache_read)    AS cacheRead,
           SUM(cache_create)  AS cacheCreate
    FROM usage
    GROUP BY model
  `).all() as Array<{ model: string; input: number; output: number; cacheRead: number; cacheCreate: number }>

  const result: Record<string, TokenUsageEntry> = {}
  for (const r of rows) {
    result[r.model] = {
      inputTokens: r.input,
      outputTokens: r.output,
      cacheReadInputTokens: r.cacheRead,
      cacheCreationInputTokens: r.cacheCreate,
    }
  }
  return result
}

export function queryDailyTokenUsage(userId: string): Record<string, Record<string, TokenUsageEntry>> {
  const rows = db().query(`
    SELECT model,
           substr(ts, 1, 10) AS date,
           SUM(input_tokens)  AS input,
           SUM(output_tokens) AS output,
           SUM(cache_read)    AS cacheRead,
           SUM(cache_create)  AS cacheCreate
    FROM usage WHERE user = $user
    GROUP BY model, date
  `).all({ $user: userId }) as Array<{ model: string; date: string; input: number; output: number; cacheRead: number; cacheCreate: number }>

  const daily: Record<string, Record<string, TokenUsageEntry>> = {}
  for (const r of rows) {
    daily[r.model] ??= {}
    daily[r.model][r.date] = {
      inputTokens: r.input,
      outputTokens: r.output,
      cacheReadInputTokens: r.cacheRead,
      cacheCreationInputTokens: r.cacheCreate,
    }
  }
  return daily
}

export function queryLoopTokenUsage(userId: string): Array<{
  loopId: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  model: string
  lastActivity: string
}> {
  return db().query(`
    SELECT loop_id       AS loopId,
           GROUP_CONCAT(DISTINCT model) AS model,
           SUM(input_tokens)  AS inputTokens,
           SUM(output_tokens) AS outputTokens,
           SUM(cache_read)    AS cacheReadInputTokens,
           SUM(cache_create)  AS cacheCreationInputTokens,
           MAX(ts)            AS lastActivity
    FROM usage WHERE user = $user
    GROUP BY loop_id
    ORDER BY lastActivity DESC
  `).all({ $user: userId }) as any[]
}

// ── Rebuild L2 from L1 ──

export async function rebuildUsageDb(loops: Array<{ id: string }>): Promise<number> {
  const d = db()
  d.exec("DELETE FROM usage")
  let total = 0
  for (const loop of loops) {
    const entries = await readLoopUsage(loop.id)
    if (entries.length > 0) {
      insertUsageDb(entries)
      total += entries.length
    }
  }
  return total
}
