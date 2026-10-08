import type { Context } from "hono";
import { HttpError, objectId, type Env } from "./lib";

export type StoredFile = { url: string; name: string; contentType: string; mediaType: "image" | "video" };

export function mediaTypeOf(contentType: string): "image" | "video" | null {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";
  return null;
}

export async function formFile(c: Context): Promise<{ file: File; form: FormData }> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HttpError(422, "Expected multipart/form-data with a 'file' field");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(422, "Field 'file' is required");
  return { file, form };
}

function baseUrl(c: Context<any>) {
  return (c.env.PUBLIC_BASE_URL || new URL(c.req.url).origin).replace(/\/+$/, "");
}

export async function storeFile(c: Context<any>, file: File): Promise<StoredFile> {
  const contentType = file.type || "application/octet-stream";
  const mediaType = mediaTypeOf(contentType);
  if (!mediaType) throw new HttpError(400, `Unsupported file type: ${contentType}`);
  const id = objectId();
  await c.env.MEDIA.put(`media/${id}`, file, {
    httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { filename: file.name },
  });
  return { url: `${baseUrl(c)}/${mediaType}s/${id}`, name: file.name, contentType, mediaType };
}

const OWN_FILE_RE = /\/(?:videos|images)\/([0-9a-f]{24})$/;

export async function deleteStoredFile(env: Env, url: unknown) {
  const match = typeof url === "string" ? url.match(OWN_FILE_RE) : null;
  if (match) await env.MEDIA.delete(`media/${match[1]}`);
}

export async function serveFile(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id") ?? "";
  if (!/^[0-9a-f]{24}$/.test(id)) throw new HttpError(404, "Video not found");
  const obj = await c.env.MEDIA.get(`media/${id}`, { range: c.req.raw.headers, onlyIf: c.req.raw.headers });
  if (!obj) throw new HttpError(404, "Video not found");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers });

  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (r && c.req.header("range")) {
    const offset = r.suffix !== undefined ? obj.size - r.suffix : (r.offset ?? 0);
    const length = r.suffix !== undefined ? r.suffix : (r.length ?? obj.size - offset);
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { headers });
}

export function mediaOut(doc: Record<string, any>, extra: Record<string, unknown> = {}) {
  return {
    mediaType: doc.mediaType,
    category: doc.category,
    requestUrl: doc.requestUrl ?? null,
    url: doc.url,
    name: doc.name,
    dateCreated: doc.date_created ?? null,
    lastUpdated: doc.last_updated ?? null,
    id: doc.id,
    ...extra,
  };
}

const https = (v: unknown) => (typeof v === "string" && v.startsWith("http://") ? "https://" + v.slice(7) : v);

export function mediaOutUser(doc: Record<string, any>, itemIndex: number) {
  const out = mediaOut(doc, { itemIndex }) as Record<string, unknown>;
  for (const k of Object.keys(out)) out[k] = https(out[k]);
  return out;
}
