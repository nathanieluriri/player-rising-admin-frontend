import type { Context } from "hono";

export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  SUPER_ADMIN_EMAIL?: string;
  SUPER_ADMIN_PASSWORD?: string;
  PUBLIC_BASE_URL?: string;
};

export type AppContext = Context<{ Bindings: Env; Variables: { admin: TokenPayload } }>;

export type TokenPayload = {
  accessToken: string;
  role: string;
  userId: string;
  exp: number;
};

export class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export function respond(c: Context, statusCode: number, data: unknown, detail: string, httpStatus = statusCode) {
  return c.json({ status_code: statusCode, data: data ?? null, detail }, httpStatus as 200);
}

export const now = () => Math.floor(Date.now() / 1000);

export function objectId(): string {
  const ts = now().toString(16).padStart(8, "0");
  const rand = crypto.getRandomValues(new Uint8Array(8));
  return ts + Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

export function intParam(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new HttpError(422, `Invalid integer value: ${value}`);
  return n;
}

export function range(c: Context, defaultStop: number) {
  const start = intParam(c.req.query("start"), 0);
  const stop = intParam(c.req.query("stop"), defaultStop);
  if (stop < start) throw new HttpError(400, "'stop' cannot be less than 'start'.");
  return { start, stop };
}

export function parseFilters(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    if (parsed.field === "value" && Object.keys(parsed).length === 1) return {};
    return parsed;
  } catch {
    throw new HttpError(400, "Invalid JSON format for 'filters' query parameter.");
  }
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

function column(key: string) {
  if (key === "_id" || key === "id") return "id";
  if (!KEY_RE.test(key)) throw new HttpError(400, `Unsupported filter field: ${key}`);
  return `json_extract(data, '$.${key}')`;
}

function sqlValue(v: unknown) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v as string | number | null;
}

function regexToLike(pattern: string) {
  let p = pattern.replace(/[%_]/g, "");
  const anchoredStart = p.startsWith("^");
  const anchoredEnd = p.endsWith("$");
  p = p.replace(/^\^/, "").replace(/\$$/, "").replace(/\\(.)/g, "$1");
  return `${anchoredStart ? "" : "%"}${p}${anchoredEnd ? "" : "%"}`;
}

// Translates the subset of MongoDB query syntax that clients send into SQL over the JSON `data` column.
export function buildWhere(filter: Record<string, unknown>): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$or" || key === "$and") {
      if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, `${key} expects a non-empty array`);
      const subs = value.map((v) => buildWhere(v as Record<string, unknown>));
      parts.push(`(${subs.map((s) => `(${s.sql})`).join(key === "$or" ? " OR " : " AND ")})`);
      subs.forEach((s) => params.push(...s.params));
      continue;
    }
    const col = column(key);
    const isOps =
      value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).some((k) => k.startsWith("$"));
    if (!isOps) {
      if (value === null) parts.push(`${col} IS NULL`);
      else {
        parts.push(`${col} = ?`);
        params.push(sqlValue(value));
      }
      continue;
    }
    for (const [op, v] of Object.entries(value as Record<string, unknown>)) {
      switch (op) {
        case "$eq":
          parts.push(`${col} = ?`);
          params.push(sqlValue(v));
          break;
        case "$ne":
          parts.push(`(${col} IS NULL OR ${col} != ?)`);
          params.push(sqlValue(v));
          break;
        case "$gt":
        case "$gte":
        case "$lt":
        case "$lte": {
          const sym = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op];
          parts.push(`${col} ${sym} ?`);
          params.push(sqlValue(v));
          break;
        }
        case "$in":
        case "$nin": {
          if (!Array.isArray(v)) throw new HttpError(400, `${op} expects an array`);
          if (v.length === 0) {
            parts.push(op === "$in" ? "0" : "1");
            break;
          }
          parts.push(`${col} ${op === "$in" ? "IN" : "NOT IN"} (${v.map(() => "?").join(", ")})`);
          params.push(...v.map(sqlValue));
          break;
        }
        case "$exists":
          parts.push(`${col} IS ${v ? "NOT " : ""}NULL`);
          break;
        case "$regex":
          parts.push(`${col} LIKE ?`);
          params.push(regexToLike(String(v)));
          break;
        case "$options":
          break;
        default:
          throw new HttpError(400, `Unsupported filter operator: ${op}`);
      }
    }
  }
  return { sql: parts.length ? parts.join(" AND ") : "1", params };
}

const SORT_FIELDS = new Set(["date_created", "last_updated", "publishDate", "title"]);

export function orderBy(field = "date_created", order: 1 | -1 = -1) {
  if (!SORT_FIELDS.has(field)) throw new HttpError(400, `Unsupported sort field: ${field}`);
  return `ORDER BY json_extract(data, '$.${field}') ${order === 1 ? "ASC" : "DESC"}, id ${order === 1 ? "ASC" : "DESC"}`;
}

export async function findDocs(
  db: D1Database,
  table: "blogs" | "media",
  filter: Record<string, unknown>,
  opts: { start: number; limit: number; sortField?: string; sortOrder?: 1 | -1; withTotal?: boolean },
) {
  const where = buildWhere(filter);
  const limit = Math.max(opts.limit, 0);
  const stmt = db
    .prepare(`SELECT id, data FROM ${table} WHERE ${where.sql} ${orderBy(opts.sortField, opts.sortOrder)} LIMIT ? OFFSET ?`)
    .bind(...where.params, limit, Math.max(opts.start, 0));
  const totalStmt = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where.sql}`).bind(...where.params);
  const [rows, total] = opts.withTotal
    ? await db.batch<{ id: string; data: string; n: number }>([stmt, totalStmt])
    : [await stmt.all<{ id: string; data: string; n: number }>(), null];
  return {
    docs: rows.results.map((r) => ({ id: r.id, ...JSON.parse(r.data) })) as Array<Record<string, any>>,
    total: total ? (total.results[0]?.n ?? 0) : 0,
  };
}

export async function getDoc(db: D1Database, table: "blogs" | "media", id: string) {
  const row = await db.prepare(`SELECT id, data FROM ${table} WHERE id = ?`).bind(id).first<{ id: string; data: string }>();
  return row ? ({ id: row.id, ...JSON.parse(row.data) } as Record<string, any>) : null;
}

export async function putDoc(db: D1Database, table: "blogs" | "media", id: string, doc: Record<string, unknown>) {
  const { id: _ignored, ...data } = doc;
  await db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`).bind(id, JSON.stringify(data)).run();
}

export const CATEGORY_NAMES: Record<string, string> = {
  "manchester-united": "Manchester United",
  "manchester-city": "Manchester City",
  arsenal: "Arsenal",
  chelsea: "Chelsea",
  liverpool: "Liverpool",
  "tottenham-hotspur": "Tottenham Hotspur",
  "leicester-city": "Leicester City",
  "everton-fc": "Everton FC",
  "west-ham-united": "West Ham United",
  "newcastle-united": "Newcastle United",
  "fc-barcelona": "FC Barcelona",
  "real-madrid": "Real Madrid",
  "atletico-madrid": "Atlético Madrid",
  "sevilla-fc": "Sevilla FC",
  "valencia-cf": "Valencia CF",
  "bayern-munich": "Bayern Munich",
  "borussia-dortmund": "Borussia Dortmund",
  "rb-leipzig": "RB Leipzig",
  "schalke-04": "Schalke 04",
  juventus: "Juventus",
  "inter-milan": "Inter Milan",
  "ac-milan": "AC Milan",
  "napoli-fc": "Napoli FC",
  "as-roma": "AS Roma",
  "paris-saint-germain": "Paris Saint-Germain",
  "olympique-lyonnais": "Olympique Lyonnais",
  "olympique-de-marseille": "Olympique de Marseille",
  "afc-ajax": "AFC Ajax",
  "fc-porto": "FC Porto",
  "sl-benfica": "SL Benfica",
  "celtic-fc": "Celtic FC",
  "rangers-fc": "Rangers FC",
};

export const ACTIVE_CATEGORY_SLUGS = ["arsenal", "manchester-united", "olympique-de-marseille", "napoli-fc"];

const ACTIVE_BY_NAME = new Map(ACTIVE_CATEGORY_SLUGS.map((s) => [CATEGORY_NAMES[s], s]));

export function validateCategory(category: unknown) {
  const cat = category as { name?: string; slug?: string } | null;
  if (!cat || typeof cat !== "object" || !cat.name || !ACTIVE_BY_NAME.has(cat.name)) {
    throw new HttpError(422, "category.name must be one of: " + [...ACTIVE_BY_NAME.keys()].join(", "));
  }
  if (ACTIVE_BY_NAME.get(cat.name) !== cat.slug) {
    throw new HttpError(422, `Category '${cat.name}' must use slug '${ACTIVE_BY_NAME.get(cat.name)}'`);
  }
  return cat;
}

const ALL_NAMES = new Set(Object.values(CATEGORY_NAMES));

export function validateCategoryName(name: unknown): string {
  if (typeof name !== "string" || !ALL_NAMES.has(name)) {
    throw new HttpError(422, "category must be one of: " + [...ALL_NAMES].join(", "));
  }
  return name;
}

export async function readJson(c: Context): Promise<Record<string, any>> {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(422, "Request body must be a JSON object");
  }
}
