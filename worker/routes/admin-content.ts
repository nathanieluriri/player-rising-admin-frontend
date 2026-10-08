import { Hono } from "hono";
import { requireAdmin } from "../auth";
import { blogFullAdmin, blogSummaryAdmin, buildBlogUpdate, buildNewBlog, mediaBlock } from "../blogs";
import {
  HttpError,
  findDocs,
  getDoc,
  isObjectId,
  now,
  objectId,
  parseFilters,
  putDoc,
  range,
  readJson,
  respond,
  validateCategoryName,
  type Env,
  type TokenPayload,
} from "../lib";
import { deleteStoredFile, formFile, mediaOut, storeFile } from "../media";

type App = { Bindings: Env; Variables: { admin: TokenPayload } };

export const blogs = new Hono<App>();
blogs.use("*", requireAdmin);

function blogId(id: string) {
  if (!isObjectId(id)) throw new HttpError(400, "Invalid blog ID format");
  return id;
}

blogs.get("/recent", async (c) => {
  const { start, stop } = range(c, 50);
  const filters = parseFilters(c.req.query("filters"));
  const { docs, total } = await findDocs(c.env.DB, "blogs", filters, { start, limit: stop - start, withTotal: true });
  let detail = `Fetched blogs ${start} to ${stop} sorted by most recent`;
  if (Object.keys(filters).length) detail += " (with filters applied)";
  return respond(c, 200, docs.map((d, i) => blogSummaryAdmin(d, total, i + 1)), detail);
});

blogs.get("/", async (c) => {
  const { start, stop } = range(c, 100);
  const filters = parseFilters(c.req.query("filters"));
  const { docs, total } = await findDocs(c.env.DB, "blogs", filters, { start, limit: stop - start, withTotal: true });
  return respond(c, 200, docs.map((d, i) => blogSummaryAdmin(d, total, i + 1)), "Fetched successfully");
});

blogs.get("/:id", async (c) => {
  const doc = await getDoc(c.env.DB, "blogs", blogId(c.req.param("id")));
  if (!doc) throw new HttpError(404, "Blog not found");
  return respond(c, 200, blogFullAdmin(doc), "blog item fetched");
});

blogs.post("/", async (c) => {
  const blog = buildNewBlog(await readJson(c));
  const id = objectId();
  await putDoc(c.env.DB, "blogs", id, blog);
  return respond(c, 201, blogFullAdmin({ id, ...blog }), "Blog created successfully");
});

blogs.patch("/:id", async (c) => {
  const id = blogId(c.req.param("id"));
  const body = await readJson(c);
  if (Array.isArray(body.currentPageBody) && body.currentPageBody.length === 0) {
    throw new HttpError(202, "No update made");
  }
  const update = buildBlogUpdate(body);
  const doc = await getDoc(c.env.DB, "blogs", id);
  if (!doc) throw new HttpError(404, "Blog not found or update failed");
  const merged = { ...doc, ...update };
  await putDoc(c.env.DB, "blogs", id, merged);
  return respond(c, 200, blogFullAdmin(merged), "Blog updated successfully");
});

blogs.delete("/:id", async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM blogs WHERE id = ?").bind(blogId(c.req.param("id"))).run();
  if (!res.meta.changes) throw new HttpError(404, "Blog not found");
  return respond(c, 200, null, "Blog deleted successfully");
});

export const media = new Hono<App>();
media.use("*", requireAdmin);

media.post("/upload-media", async (c) => {
  const { file } = await formFile(c);
  const stored = await storeFile(c, file);
  const label = stored.mediaType === "image" ? "Image" : "Video";
  return respond(c, 201, { url: stored.url }, `${label} uploaded successfully`);
});

media.post("/upload-image", async (c) => {
  const { file } = await formFile(c);
  if (!file.type.startsWith("image/")) throw new HttpError(400, `Unsupported file type: ${file.type}`);
  return respond(c, 201, { url: (await storeFile(c, file)).url }, "Image uploaded successfully");
});

media.post("/upload-video", async (c) => {
  const { file } = await formFile(c);
  if (!file.type.startsWith("video/")) throw new HttpError(400, `Unsupported file type: ${file.type}`);
  return respond(c, 201, { url: (await storeFile(c, file)).url }, "Video uploaded successfully");
});

media.post("/", async (c) => {
  const { file, form } = await formFile(c);
  const category = validateCategoryName(form.get("category"));
  const stored = await storeFile(c, file);
  const ts = now();
  const id = objectId();
  await putDoc(c.env.DB, "media", id, {
    mediaType: stored.mediaType,
    category,
    requestUrl: stored.mediaType === "video" ? new URL(c.req.url).origin : null,
    url: stored.url,
    name: stored.name,
    date_created: ts,
    last_updated: ts,
  });
  const label = stored.mediaType === "image" ? "Image" : "Video";
  return respond(c, 201, id, `${label} Job uploaded successfully`);
});

async function listMedia(c: any, base: Record<string, unknown>, defaultStop: number, detail: (s: number, e: number) => string) {
  const { start, stop } = range(c, defaultStop);
  const filters = { ...parseFilters(c.req.query("filters")), ...base };
  const { docs, total } = await findDocs(c.env.DB, "media", filters, { start, limit: stop - start, withTotal: true });
  return respond(c, 200, docs.map((d, i) => mediaOut(d, { totalItems: total, itemIndex: i + 1 })), detail(start, stop));
}

media.get("/by-type/:type", (c) =>
  listMedia(c, { mediaType: c.req.param("type") }, 50, () => `Fetched media with type '${c.req.param("type")}'`),
);
media.get("/by-category/:category", (c) =>
  listMedia(c, { category: c.req.param("category") }, 50, () => `Fetched media with category '${c.req.param("category")}'`),
);
media.get("/recent", (c) => listMedia(c, {}, 50, (s, e) => `Fetched media ${s} to ${e} sorted by most recent`));
media.get("/", (c) => listMedia(c, {}, 100, () => "Fetched media successfully"));

media.get("/:id", async (c) => {
  const doc = await getDoc(c.env.DB, "media", c.req.param("id"));
  if (!doc) throw new HttpError(404, "Media item not found");
  return respond(c, 200, mediaOut(doc), "Media item fetched");
});

media.patch("/:id", async (c) => {
  const category = validateCategoryName((await readJson(c)).category);
  const doc = await getDoc(c.env.DB, "media", c.req.param("id"));
  if (!doc) throw new HttpError(404, "Media item not found");
  const updated = { ...doc, category, last_updated: now() };
  await putDoc(c.env.DB, "media", doc.id, updated);
  return respond(c, 200, mediaOut(updated), "Media item updated");
});

media.delete("/:id", async (c) => {
  const doc = await getDoc(c.env.DB, "media", c.req.param("id"));
  if (!doc) throw new HttpError(404, "Media item not found");
  await c.env.DB.prepare("DELETE FROM media WHERE id = ?").bind(doc.id).run();
  await deleteStoredFile(c.env, doc.url);
  return respond(c, 200, "acknowledged: True delete count: 1", "Media item fetched");
});

// Uploads a file and appends it as an image/video block to the end of the blog body.
media.post("/:blogId", async (c) => {
  const id = blogId(c.req.param("blogId"));
  const { file, form } = await formFile(c);
  const caption = form.get("caption");
  if (typeof caption !== "string") throw new HttpError(422, "Field 'caption' is required");
  const doc = await getDoc(c.env.DB, "blogs", id);
  if (!doc) throw new HttpError(404, "Blog Id Is Invalid because the blog you want to update couldn't be found");

  const stored = await storeFile(c, file);
  const body = [...(doc.currentPageBody ?? []), mediaBlock(stored.url, caption, stored.mediaType)];
  const updated = { ...doc, ...buildBlogUpdate({ currentPageBody: body }) };
  await putDoc(c.env.DB, "blogs", id, updated);
  const label = stored.mediaType === "image" ? "Image" : "Video";
  return respond(c, 201, blogFullAdmin(updated), `${label} uploaded successfully`);
});
