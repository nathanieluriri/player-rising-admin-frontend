import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpError, respond, type Env, type TokenPayload } from "./lib";
import { serveFile } from "./media";
import admins from "./routes/admins";
import { blogs, media } from "./routes/admin-content";
import { articles, publicMedia } from "./routes/public";

const app = new Hono<{ Bindings: Env; Variables: { admin: TokenPayload } }>({ strict: false });

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] }));

app.onError((err, c) => {
  if (err instanceof HttpError) return respond(c, err.status, null, err.detail as string);
  console.error(err);
  return respond(c, 500, null, `Internal server error: ${err.message}`);
});

app.notFound((c) => respond(c, 404, null, "Not Found"));

async function healthServices(env: Env) {
  const services: Record<string, { status: string; latency_ms: number; message: string }> = {};
  const check = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await fn();
      services[name] = { status: "healthy", latency_ms: Date.now() - t, message: "Ping successful" };
    } catch (e) {
      services[name] = { status: "unhealthy", latency_ms: Date.now() - t, message: String(e) };
    }
  };
  await Promise.all([check("d1", () => env.DB.prepare("SELECT 1").first()), check("r2", () => env.MEDIA.head("health-check"))]);
  const status = Object.values(services).every((s) => s.status === "healthy") ? "healthy" : "unhealthy";
  return { status, timestamp: new Date().toISOString().replace(/\.\d+Z$/, "Z"), services };
}

app.get("/health", async (c) => {
  const data = await healthServices(c.env);
  return respond(c, data.status === "healthy" ? 200 : 207, data, `Health check completed with status: ${data.status}`);
});
app.get("/health-detailed", async (c) => {
  const data = await healthServices(c.env);
  return respond(c, data.status === "healthy" ? 200 : 207, data, `Health check completed with status: ${data.status}`);
});

// Uploads now complete inside the request, so any task id a client still polls for is already done.
app.get("/task/:id", (c) => c.json({ task_id: c.req.param("id"), state: "SUCCESS", ready: true, result: c.req.param("id") }));

app.get("/videos/:id", serveFile);
app.get("/images/:id", serveFile);

app.route("/v1/admins", admins);
app.route("/v1/blogs", blogs);
app.route("/v1/media", media);
app.route("/api/v1/articles", articles);
app.route("/api/v1/media", publicMedia);

export default app;
