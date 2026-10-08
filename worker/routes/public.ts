import { Hono } from "hono";
import { blogFullPublic, blogSummaryPublic } from "../blogs";
import {
  ACTIVE_CATEGORY_SLUGS,
  CATEGORY_NAMES,
  HttpError,
  findDocs,
  getDoc,
  intParam,
  isObjectId,
  parseFilters,
  range,
  respond,
  type Env,
} from "../lib";
import { mediaOut, mediaOutUser } from "../media";

const PUBLISHED = { state: "published" };

const BLOG_TYPE_MAP: Record<string, string> = {
  "hero-section": "hero section",
  "editors-pick": "editors pick",
  featured: "featured story",
  normal: "normal",
};

const SORT_MAP: Record<string, { field: string; order: 1 | -1 }> = {
  newest: { field: "date_created", order: -1 },
  oldest: { field: "date_created", order: 1 },
  mostRecentlyUpdated: { field: "last_updated", order: -1 },
  leastRecentlyUpdated: { field: "last_updated", order: 1 },
  latestPublished: { field: "publishDate", order: -1 },
  earliestPublished: { field: "publishDate", order: 1 },
};

function sortParam(value: string | undefined) {
  const sort = SORT_MAP[value ?? "newest"];
  if (!sort) throw new HttpError(422, `sort must be one of: ${Object.keys(SORT_MAP).join(", ")}`);
  return sort;
}

async function publishedBlogs(c: any, filter: Record<string, unknown>, defaultStop: number) {
  const { start, stop } = range(c, defaultStop);
  const sort = sortParam(c.req.query("sort"));
  const { docs } = await findDocs(c.env.DB, "blogs", { ...filter, ...PUBLISHED }, {
    start,
    limit: stop - start,
    sortField: sort.field,
    sortOrder: sort.order,
  });
  return docs;
}

const listOf = (docs: Record<string, any>[]) => ({
  totalItems: docs.length,
  blogs: docs.map((d, i) => blogSummaryPublic(d, i + 1)),
});

// Club photos hosted in our own R2 bucket; credits are listed in the blog footer.
const CATEGORY_IMAGES: Record<string, string> = {
  arsenal: "https://api.theplayersrising.com/images/6ac7ddbe827f6e463a077c1c",
  "manchester-united": "https://api.theplayersrising.com/images/6ac7db450d277290a3596f25",
  "olympique-de-marseille": "https://api.theplayersrising.com/images/6ac7db4660c428784c0e4ec7",
  "napoli-fc": "https://api.theplayersrising.com/images/6ac7db4745d1c76fe34c4583",
};

export const articles = new Hono<{ Bindings: Env }>();

articles.get("/content/categories", (c) => {
  const listOfCategories = ACTIVE_CATEGORY_SLUGS.map((slug, i) => ({
    imageUrl: CATEGORY_IMAGES[slug] ?? null,
    itemIndex: i + 1,
    name: CATEGORY_NAMES[slug],
    slug,
  }));
  return respond(c, 200, { listOfCategories, totalItems: listOfCategories.length }, "Successfully retrieved all categories.");
});

articles.get("/content/by-blog-type/:type", async (c) => {
  const type = c.req.param("type");
  if (!BLOG_TYPE_MAP[type]) throw new HttpError(422, `blog_type must be one of: ${Object.keys(BLOG_TYPE_MAP).join(", ")}`);
  const docs = await publishedBlogs(c, { blogType: BLOG_TYPE_MAP[type] }, 50);
  return respond(c, 200, listOf(docs), `Fetched published blogs with type '${type}'`);
});

articles.get("/content/by-category-slug/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!CATEGORY_NAMES[slug]) throw new HttpError(422, "Unknown category slug");
  const docs = await publishedBlogs(c, { "category.slug": slug }, 50);
  return respond(
    c,
    200,
    { ...listOf(docs), category: docs[0]?.category?.name ?? null },
    `Fetched published blogs with category slug '${slug}'`,
  );
});

articles.get("/content/by-author-name", async (c) => {
  const author = c.req.query("author_name");
  if (!author) throw new HttpError(422, "Query parameter 'author_name' is required");
  const docs = await publishedBlogs(c, { "author.name": author }, 50);
  return respond(c, 200, listOf(docs), `Fetched published blogs by author '${author}'`);
});

articles.get("/content/search", async (c) => {
  const title = c.req.query("title")?.trim();
  const author = c.req.query("author")?.trim();
  if (!title && !author) throw new HttpError(400, "Search query 'title' and 'author' parameter cannot be empty.");
  const skip = intParam(c.req.query("start"), 0);
  const limit = intParam(c.req.query("stop"), 100);

  const filter: Record<string, unknown> = { ...PUBLISHED };
  if (title) filter.title = { $regex: title };
  if (author) filter["author.name"] = { $regex: author };
  const { docs } = await findDocs(c.env.DB, "blogs", filter, { start: skip, limit });
  const blogs = docs.map((d, i) => blogSummaryPublic(d, skip + i + 1));
  return respond(c, 200, { totalItems: blogs.length, blogs }, `Found ${blogs.length} matching blog items.`);
});

articles.get("/content", async (c) => {
  const docs = await publishedBlogs(c, {}, 100);
  return respond(c, 200, listOf(docs), "Fetched published blogs successfully");
});

articles.get("/content/:id", async (c) => {
  const id = c.req.param("id");
  if (!isObjectId(id)) throw new HttpError(400, "Invalid blog ID format");
  const doc = await getDoc(c.env.DB, "blogs", id);
  if (!doc) throw new HttpError(404, "Blog not found");
  if (doc.state !== "published") throw new HttpError(404, "Blog not found or is not published");
  return respond(c, 200, blogFullPublic(doc), "blog item fetched");
});

export const publicMedia = new Hono<{ Bindings: Env }>();

async function listPublicMedia(c: any, base: Record<string, unknown>, defaultStop: number, detail: string, useFilters = true) {
  const { start, stop } = range(c, defaultStop);
  const filters = { ...(useFilters ? parseFilters(c.req.query("filters")) : {}), ...base };
  const { docs } = await findDocs(c.env.DB, "media", filters, { start, limit: stop - start });
  const listOfMedia = docs.map((d, i) => mediaOutUser(d, i + 1));
  return respond(c, 200, { totalItems: listOfMedia.length, listOfMedia }, detail);
}

publicMedia.get("/by-type/:type", (c) => {
  const type = c.req.param("type");
  if (type !== "video" && type !== "image") throw new HttpError(422, "media_type must be 'video' or 'image'");
  return listPublicMedia(c, { mediaType: type }, 50, `Fetched media with type '${type}'`, false);
});

publicMedia.get("/by-category/:category", (c) => {
  const slug = c.req.param("category");
  if (!ACTIVE_CATEGORY_SLUGS.includes(slug)) throw new HttpError(422, "Unknown category slug");
  return listPublicMedia(c, { category: CATEGORY_NAMES[slug] }, 50, `Fetched media with category'${slug}'`);
});

publicMedia.get("/recent", (c) => listPublicMedia(c, {}, 50, "Fetched media sorted by most recent"));
publicMedia.get("/", (c) => listPublicMedia(c, {}, 100, "Fetched media successfully"));

publicMedia.get("/:id", async (c) => {
  const doc = await getDoc(c.env.DB, "media", c.req.param("id"));
  if (!doc) throw new HttpError(404, "Media item not found");
  return respond(c, 200, mediaOut(doc), "Media item fetched");
});
