import { Hono } from "hono";
import {
  SUPER_ADMIN_ID,
  bearer,
  getAdminByEmail,
  getAdminById,
  hashPassword,
  issueTokens,
  listAdmins,
  requireAdmin,
  verifyAdminPassword,
  verifyJwt,
  type AdminRow,
} from "../auth";
import { HttpError, now, objectId, readJson, respond, type Env, type TokenPayload } from "../lib";

const admins = new Hono<{ Bindings: Env; Variables: { admin: TokenPayload } }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminOut(a: AdminRow, tokens?: { access_token: string; refresh_token: string }) {
  const out: Record<string, unknown> = { id: a.id, full_name: a.full_name, email: a.email };
  if (a.date_created != null) out.date_created = a.date_created;
  if (a.last_updated != null) out.last_updated = a.last_updated;
  if (tokens) Object.assign(out, tokens);
  return out;
}

function requireString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || !v) throw new HttpError(422, `Field '${key}' is required`);
  return v;
}

admins.post("/login", async (c) => {
  const body = await readJson(c);
  const email = requireString(body, "email");
  const password = requireString(body, "password");
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "value is not a valid email address");

  const admin = await getAdminByEmail(c.env, email);
  if (!admin) throw new HttpError(404, "Admin not found");
  if (!(await verifyAdminPassword(c.env, admin, password))) {
    throw new HttpError(401, "Unathorized, Invalid Login credentials");
  }
  return respond(c, 200, adminOut(admin, await issueTokens(c.env, admin.id)), "Fetched successfully");
});

admins.post("/refresh", async (c) => {
  const payload = await verifyJwt(bearer(c.req.header("Authorization")), c.env.JWT_SECRET, true);
  if (!payload) throw new HttpError(401, "Invalid token");
  const refreshToken = requireString(await readJson(c), "refresh_token");

  const refresh = await c.env.DB.prepare("SELECT * FROM refresh_tokens WHERE id = ?")
    .bind(refreshToken)
    .first<{ id: string; user_id: string; previous_access_token: string }>();
  if (!refresh || refresh.previous_access_token !== payload.accessToken) {
    throw new HttpError(404, "Invalid refresh token ");
  }
  const admin = await getAdminById(c.env, refresh.user_id);
  if (!admin) throw new HttpError(404, "Invalid refresh token ");

  const tokens = await issueTokens(c.env, admin.id);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM access_tokens WHERE id = ?").bind(payload.accessToken),
    c.env.DB.prepare("DELETE FROM refresh_tokens WHERE id = ?").bind(refresh.id),
  ]);
  return respond(c, 200, adminOut(admin, tokens), "admins items fetched");
});

admins.get("/me", requireAdmin, async (c) => {
  const admin = await getAdminById(c.env, c.get("admin").userId);
  if (!admin) throw new HttpError(404, "Admin not found");
  return respond(c, 200, adminOut(admin), "admins items fetched");
});

admins.post("/signup", requireAdmin, async (c) => {
  const body = await readJson(c);
  const full_name = requireString(body, "full_name");
  const email = requireString(body, "email");
  const password = requireString(body, "password");
  if (!EMAIL_RE.test(email)) throw new HttpError(422, "value is not a valid email address");
  if (await getAdminByEmail(c.env, email)) throw new HttpError(409, "Admin Already exists");

  const ts = now();
  const admin: AdminRow = {
    id: objectId(),
    full_name,
    email,
    password: await hashPassword(password),
    invited_by: c.get("admin").userId,
    date_created: ts,
    last_updated: ts,
  };
  await c.env.DB.prepare(
    "INSERT INTO admins (id, full_name, email, password, invited_by, date_created, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(admin.id, admin.full_name, admin.email, admin.password, admin.invited_by, ts, ts)
    .run();
  return respond(c, 200, adminOut(admin, await issueTokens(c.env, admin.id)), "Fetched successfully");
});

admins.delete("/account", requireAdmin, async (c) => {
  const userId = c.get("admin").userId;
  if (userId === SUPER_ADMIN_ID) throw new HttpError(400, "The super admin account cannot be deleted");
  const res = await c.env.DB.prepare("DELETE FROM admins WHERE id = ?").bind(userId).run();
  if (!res.meta.changes) throw new HttpError(404, "Admin not found");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM access_tokens WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").bind(userId),
  ]);
  return respond(c, 200, null, "Admin deleted successfully");
});

admins.get("/:start/:stop", requireAdmin, async (c) => {
  const list = await listAdmins(c.env);
  return respond(c, 200, list.map((a) => adminOut(a)), "Fetched successfully");
});

export default admins;
