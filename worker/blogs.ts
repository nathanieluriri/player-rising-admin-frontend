import { HttpError, now, validateCategory } from "./lib";

type Block = { content?: unknown };

export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled-blog";
}

export function generateExcerpt(body: unknown, maxLength = 200): string {
  if (!Array.isArray(body)) return "";
  const texts: string[] = [];
  for (const block of body as Block[]) {
    if (!Array.isArray(block?.content)) continue;
    for (const item of block.content as Array<{ type?: string; text?: string }>) {
      if (item?.type === "text") texts.push(item.text ?? "");
    }
  }
  const full = texts.join(" ").trim();
  return full.length > maxLength ? full.slice(0, maxLength).trimEnd() + "..." : full;
}

const BLOG_TYPES = ["editors pick", "featured story", "hero section", "normal"];

function validateAuthor(author: unknown) {
  const a = author as { name?: unknown; affiliation?: unknown } | null;
  if (!a || typeof a !== "object" || typeof a.name !== "string" || typeof a.affiliation !== "string") {
    throw new HttpError(422, "author must include 'name' and 'affiliation'");
  }
  return author;
}

function validateFeatureImage(img: unknown) {
  if (img == null) return null;
  const i = img as { url?: unknown; altText?: unknown };
  if (typeof i !== "object" || typeof i.url !== "string" || typeof i.altText !== "string") {
    throw new HttpError(422, "featureImage must include 'url' and 'altText'");
  }
  return img;
}

function validateBlogType(t: unknown) {
  if (t == null) return "normal";
  if (typeof t !== "string" || !BLOG_TYPES.includes(t)) {
    throw new HttpError(422, `blogType must be one of: ${BLOG_TYPES.join(", ")}`);
  }
  return t;
}

function validatePages(pages: unknown) {
  if (pages == null) return null;
  if (!Array.isArray(pages) || pages.some((p) => typeof p?.pageNumber !== "number" || !Array.isArray(p?.pageBody))) {
    throw new HttpError(422, "pages must be a list of { pageNumber, pageBody }");
  }
  return pages;
}

function validateBody(body: unknown) {
  if (body == null) return null;
  if (!Array.isArray(body)) throw new HttpError(422, "currentPageBody must be a list of blocks");
  return body;
}

export function buildNewBlog(input: Record<string, any>) {
  if (typeof input.title !== "string") throw new HttpError(422, "Field 'title' is required");
  const pages = validatePages(input.pages);
  const currentPageBody = validateBody(input.currentPageBody);
  if (pages && currentPageBody) throw new HttpError(422, "You must provide EITHER 'pages' OR 'currentPageBody', not both.");
  if (!pages && !currentPageBody) throw new HttpError(422, "You must provide one of: 'pages' OR 'currentPageBody'.");

  const ts = now();
  return {
    title: input.title,
    author: validateAuthor(input.author),
    category: validateCategory(input.category),
    blogType: validateBlogType(input.blogType),
    featureImage: validateFeatureImage(input.featureImage),
    pages,
    currentPageBody,
    state: "draft",
    slug: input.title ? generateSlug(input.title) : "invalid-slug",
    excerpt: generateExcerpt(currentPageBody),
    date_created: ts,
    last_updated: ts,
  };
}

export function buildBlogUpdate(input: Record<string, any>) {
  const update: Record<string, unknown> = {};
  if (input.state != null) {
    if (input.state !== "published" && input.state !== "draft") throw new HttpError(422, "state must be 'published' or 'draft'");
    update.state = input.state;
  }
  if (input.title != null) {
    if (typeof input.title !== "string") throw new HttpError(422, "title must be a string");
    update.title = input.title;
  }
  if (input.author != null) update.author = validateAuthor(input.author);
  if (input.category != null) update.category = validateCategory(input.category);
  if (input.featureImage != null) update.featureImage = validateFeatureImage(input.featureImage);
  if (input.blogType != null) update.blogType = validateBlogType(input.blogType);
  if (input.publishDate != null) update.publishDate = input.publishDate;

  const pages = validatePages(input.pages);
  const body = validateBody(input.currentPageBody);
  if (pages && body) throw new HttpError(422, "You must provide EITHER 'pages' OR 'currentPageBody', not both.");
  if (pages) update.pages = pages;
  if (body) update.currentPageBody = body;

  const excerpt = input.excerpt || (body ? generateExcerpt(body) : null);
  if (excerpt) update.excerpt = excerpt;
  if (update.state === "published" && !update.publishDate) update.publishDate = now();
  update.last_updated = now();
  return update;
}

const EMPTY_EXCERPT = "Article content is currently empty.";

function base(doc: Record<string, any>) {
  let slug = doc.slug;
  if ((!slug && doc.title) || slug === "invalid-slug") slug = generateSlug(doc.title ?? "");
  if (!slug) slug = "invalid-slug";
  let excerpt = doc.excerpt;
  if (!excerpt || excerpt === EMPTY_EXCERPT) excerpt = generateExcerpt(doc.currentPageBody);
  return {
    title: doc.title,
    author: doc.author,
    category: doc.category,
    blogType: doc.blogType ?? "normal",
    featureImage: doc.featureImage ?? null,
    state: doc.state ?? "draft",
    dateCreated: doc.date_created ?? null,
    lastUpdated: doc.last_updated ?? null,
    slug,
    excerpt,
  };
}

export const blogSummaryAdmin = (doc: Record<string, any>, totalItems: number, itemIndex: number) => ({
  _id: doc.id,
  ...base(doc),
  totalItems,
  itemIndex,
});

export const blogFullAdmin = (doc: Record<string, any>) => ({
  _id: doc.id,
  ...base(doc),
  pages: doc.pages ?? null,
  currentPageBody: doc.currentPageBody ?? null,
});

export const blogSummaryPublic = (doc: Record<string, any>, itemIndex: number) => ({
  id: doc.id,
  ...base(doc),
  itemIndex,
});

export const blogFullPublic = (doc: Record<string, any>) => ({
  id: doc.id,
  ...base(doc),
  pages: doc.pages ?? null,
  currentPageBody: doc.currentPageBody ?? null,
});

export function mediaBlock(url: string, caption: string, mediaType: "image" | "video") {
  return {
    id: crypto.randomUUID(),
    type: mediaType,
    props: {
      textAlignment: "center",
      backgroundColor: "default",
      name: "",
      url,
      caption: caption ? `📷 ${caption}` : "📷",
      showPreview: true,
      previewWidth: 756,
    },
    children: [],
  };
}
