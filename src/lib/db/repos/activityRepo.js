import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const KEEP = 5000;
const PRUNE_EVERY = 100;
let inserts = 0;

const toEvent = (r) => ({
  id: r.id, ts: r.ts, type: r.type, actor: r.actor,
  target: r.target ?? null, summary: r.summary, meta: parseJson(r.meta, null),
});

export async function insertActivity({ type, actor, target = null, summary, meta = null }) {
  const db = await getAdapter();
  db.run(
    `INSERT INTO activityLog(ts, type, actor, target, summary, meta) VALUES(?, ?, ?, ?, ?, ?)`,
    [Date.now(), String(type), String(actor || "master"), target == null ? null : String(target), String(summary), meta ? stringifyJson(meta) : null]
  );
  if (++inserts % PRUNE_EVERY === 0) pruneActivity();
}

export async function pruneActivity(keep = KEEP) {
  const db = await getAdapter();
  db.run(`DELETE FROM activityLog WHERE id NOT IN (SELECT id FROM activityLog ORDER BY id DESC LIMIT ?)`, [keep]);
}

// type: exact ("key.created") or prefix ("key" matches "key.*").
export async function listActivity({ limit = 200, beforeId, type } = {}) {
  const db = await getAdapter();
  const n = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
  const where = [];
  const args = [];
  if (beforeId != null && beforeId !== "" && Number.isFinite(Number(beforeId))) { where.push("id < ?"); args.push(Number(beforeId)); }
  if (type) { where.push("(type = ? OR type LIKE ? ESCAPE '\\')"); args.push(type, `${String(type).replace(/[\\%_]/g, "\\$&")}.%`); }
  const sql = `SELECT * FROM activityLog${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
  const rows = db.all(sql, [...args, n + 1]);
  return { events: rows.slice(0, n).map(toEvent), hasMore: rows.length > n };
}

export async function clearActivity() {
  const db = await getAdapter();
  db.run(`DELETE FROM activityLog`);
}
