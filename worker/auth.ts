import bcrypt from "bcryptjs";
import type { MiddlewareHandler } from "hono";
import { HttpError, now, objectId, type Env, type TokenPayload } from "./lib";

export const SUPER_ADMIN_ID = "656f7ac12b9d4f6c9e2b9f7d";
const ACCESS_TOKEN_TTL = 15 * 60;
const TOKEN_MAX_AGE = 10 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (ch) =>
    ch.charCodeAt(0),
  );

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function signJwt(payload: Omit<TokenPayload, "exp">, secret: string): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: now() + ACCESS_TOKEN_TTL })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string, ignoreExp = false): Promise<TokenPayload | null> {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode(`${header}.${body}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as TokenPayload;
    if (!ignoreExp && (typeof payload.exp !== "number" || payload.exp < now())) return null;
    return payload;
  } catch {
    return null;
  }
}

async function pbkdf2(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(await pbkdf2(password, salt))}`;
}

function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Accepts bcrypt hashes too, so admins imported from the old MongoDB backend can still log in.
export async function checkPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) return bcrypt.compare(password, stored);
  const [scheme, , salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  return safeEqual(await pbkdf2(password, fromB64url(salt)), fromB64url(hash));
}

export type AdminRow = {
  id: string;
  full_name: string;
  email: string;
  password: string;
  invited_by: string | null;
  date_created: number | null;
  last_updated: number | null;
};

function superAdmin(env: Env): AdminRow | null {
  if (!env.SUPER_ADMIN_EMAIL) return null;
  return {
    id: SUPER_ADMIN_ID,
    full_name: "Super Admin",
    email: env.SUPER_ADMIN_EMAIL,
    password: "",
    invited_by: null,
    date_created: null,
    last_updated: null,
  };
}

export async function getAdminById(env: Env, id: string): Promise<AdminRow | null> {
  const row = await env.DB.prepare("SELECT * FROM admins WHERE id = ?").bind(id).first<AdminRow>();
  if (row) return row;
  return id === SUPER_ADMIN_ID ? superAdmin(env) : null;
}

export async function getAdminByEmail(env: Env, email: string): Promise<AdminRow | null> {
  const row = await env.DB.prepare("SELECT * FROM admins WHERE email = ? COLLATE NOCASE").bind(email).first<AdminRow>();
  if (row) return row;
  return env.SUPER_ADMIN_EMAIL && email.toLowerCase() === env.SUPER_ADMIN_EMAIL.toLowerCase() ? superAdmin(env) : null;
}

export async function listAdmins(env: Env): Promise<AdminRow[]> {
  const { results } = await env.DB.prepare("SELECT * FROM admins ORDER BY date_created ASC LIMIT 100").all<AdminRow>();
  const sa = superAdmin(env);
  return sa ? [...results, sa] : results;
}

export async function verifyAdminPassword(env: Env, admin: AdminRow, password: string): Promise<boolean> {
  if (admin.id === SUPER_ADMIN_ID && !admin.password) {
    if (!env.SUPER_ADMIN_PASSWORD) return false;
    return safeEqual(enc.encode(password), enc.encode(env.SUPER_ADMIN_PASSWORD));
  }
  const ok = await checkPassword(password, admin.password);
  if (ok && admin.password.startsWith("$2")) {
    await env.DB.prepare("UPDATE admins SET password = ? WHERE id = ?").bind(await hashPassword(password), admin.id).run();
  }
  return ok;
}

export async function issueTokens(env: Env, userId: string) {
  const accessId = objectId();
  const refreshId = objectId();
  const ts = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO access_tokens (id, user_id, role, status, date_created) VALUES (?, ?, 'admin', 'active', ?)").bind(
      accessId,
      userId,
      ts,
    ),
    env.DB.prepare("INSERT INTO refresh_tokens (id, user_id, previous_access_token, date_created) VALUES (?, ?, ?, ?)").bind(
      refreshId,
      userId,
      accessId,
      ts,
    ),
  ]);
  const access_token = await signJwt({ accessToken: accessId, role: "admin", userId }, env.JWT_SECRET);
  return { access_token, refresh_token: refreshId };
}

export function bearer(header: string | undefined): string {
  if (!header || !header.toLowerCase().startsWith("bearer ") || !header.slice(7).trim()) {
    throw new HttpError(403, "Not authenticated");
  }
  return header.slice(7).trim();
}

export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: { admin: TokenPayload } }> = async (c, next) => {
  const payload = await verifyJwt(bearer(c.req.header("Authorization")), c.env.JWT_SECRET);
  if (!payload) throw new HttpError(401, "Access Token Expired");

  const token = await c.env.DB.prepare("SELECT * FROM access_tokens WHERE id = ?")
    .bind(payload.accessToken)
    .first<{ id: string; user_id: string; role: string; date_created: number }>();
  if (!token || token.role !== "admin") throw new HttpError(401, "Invalid admin token");
  if (now() - token.date_created > TOKEN_MAX_AGE) {
    await c.env.DB.prepare("DELETE FROM access_tokens WHERE id = ?").bind(token.id).run();
    throw new HttpError(401, "Invalid admin token");
  }
  if (!(await getAdminById(c.env, token.user_id))) throw new HttpError(401, "Invalid admin token");

  c.set("admin", payload);
  await next();
};
