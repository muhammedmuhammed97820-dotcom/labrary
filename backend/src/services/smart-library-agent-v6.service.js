const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");
const { findBookCover, findAuthorImage } = require("./external-image.service");

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 300;
const UA = "ElectronicLibrary Smart Library Agent/6.0";

const clean = (v = "") => String(v)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#(\d+);/g, (_, n) => {
    try { return String.fromCodePoint(Number(n)); } catch { return ""; }
  })
  .replace(/\s+/g, " ")
  .trim();

const abs = (base, value) => {
  try { return new URL(String(value || ""), base).href; } catch { return ""; }
};

const attr = (s, n) => String(s || "").match(new RegExp(`${n}=[\"']([^\"']+)`, "i"))?.[1] || "";

function links(html, page) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = abs(page, attr(m[1], "href") || attr(m[1], "data-href"));
    if (url) out.push({ url, text: clean(m[2]), attrs: m[1] });
  }
  return out;
}

const meta = (html, name) => {
  for (const t of html.match(/<meta\b[^>]*>/gi) || []) {
    if (new RegExp(`(?:name|property)=[\"']${name}[\"']`, "i").test(t)) {
      return clean(attr(t, "content"));
    }
  }
  return "";
};

const firstTag = (html, name) => clean(
  html.match(new RegExp(`<${name}\b[^>]*>([\s\S]*?)<\/${name}>`, "i"))?.[1] || ""
);

function jsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const x = JSON.parse(m[1].trim());
      const add = v => {
        if (!v) return;
        if (Array.isArray(v)) return v.forEach(add);
        if (v["@graph"]) v["@graph"].forEach(add);
        else out.push(v);
      };
      add(x);
    } catch {}
  }
  return out;
}

function validAuthor(v) {
  let n = clean(v).replace(/^(?:الكاتب|المؤلف|بقلم|تأليف)\s*[:：-]?\s*/iu, "").trim();
  if (!n || n.length < 4 || n.length > 120) return "";
  if (/^(و|ون|او|أو|من|عن|في|على|مع|هذا|هذه|كتاب|تحميل|pdf)$/iu.test(n)) return "";
  if (/تحميل\s+كتاب|حقوق|فولة\s*بوك|مكتبة|library|book|pdf\b/i.test(n)) return "";
  if (/^[\W_]+$/u.test(n)) return "";
  if (/^(ال)?مؤلف(ون|ين)?$/iu.test(n)) return "";
  return n;
}

function validCategory(v) {
  const n = clean(v);
  if (!n || n.length < 2 || n.length > 100) return "";
  if (/^(و|ون|او|أو|من|عن|في|على|مع)$/iu.test(n)) return "";
  return n;
}

function cleanTitle(v) {
  return clean(v)
    .replace(/^تحميل\s+كتاب\s+/iu, "")
    .replace(/^كتاب\s+/iu, "")
    .replace(/\s+(?:كتاب\s+)?pdf\s*$/iu, "")
    .trim();
}

function extractBook(url, html) {
  const data = {};
  const ld = jsonLd(html);
  const bookLd = ld.find(x => /book/i.test(String(x["@type"] || ""))) || ld[0] || {};
  data.title = cleanTitle(meta(html, "og:title") || bookLd.name || firstTag(html, "h1") || firstTag(html, "title"));
  data.description = clean(meta(html, "description") || bookLd.description || "");
  data.isbn = clean(String(bookLd.isbn || meta(html, "isbn") || ""));
  data.language = clean(String(bookLd.inLanguage || meta(html, "language") || ""));
  data.publishedYear = String(bookLd.datePublished || meta(html, "date") || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1] || "";

  const as = links(html, url);
  const authorLink = as.find(a => /author|كاتب|مؤلف|المؤلف/i.test(`${a.url} ${a.text} ${a.attrs}`));
  const categoryLink = as.find(a => /category|categories|books\/|تصنيف|تصنيفات/i.test(`${a.url} ${a.text} ${a.attrs}`));

  const authorFromLd = validAuthor(
    typeof bookLd.author === "string" ? bookLd.author : bookLd.author?.name
  );
  const categoryFromLd = validCategory(
    typeof bookLd.genre === "string" ? bookLd.genre : bookLd.genre?.name
  );

  data.authorName = validAuthor(authorLink?.text) || authorFromLd;
  data.authorUrl = authorLink?.url || "";
  data.categoryName = validCategory(categoryLink?.text) || categoryFromLd;
  data.categoryUrl = categoryLink?.url || "";

  const download = as.find(a => /download|تحميل|\.pdf(?:$|[?#])/i.test(`${a.url} ${a.text} ${a.attrs}`));
  data.fileUrl = download?.url || "";
  data.sourceUrl = url;
  return data;
}

async function fetchPage(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  if (!/html|xhtml/i.test(type)) throw new Error(`Not HTML: ${type}`);
  const text = await r.text();
  if (Buffer.byteLength(text, "utf8") > MAX_PAGE_BYTES) return text.slice(0, MAX_PAGE_BYTES);
  return text;
}

function sameOrigin(url, origin) {
  try { return new URL(url).origin === origin; } catch { return false; }
}

function isUsefulPage(url, root) {
  try {
    const u = new URL(url);
    if (u.origin !== root) return false;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|zip|rar|mp3|mp4)$/i.test(u.pathname)) return false;
    return true;
  } catch { return false; }
}

async function crawl(startUrl, maxPages) {
  const start = new URL(startUrl);
  const root = start.origin;
  const queue = [start.href];
  const queued = new Set(queue);
  const seen = new Set();
  const books = [];

  while (queue.length && seen.size < Math.min(Number(maxPages) || 30, MAX_PAGES)) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const html = await fetchPage(url);
      const b = extractBook(url, html);
      const looksBook = b.title && (b.authorName || b.categoryName || b.fileUrl || /\/book\//i.test(url));
      if (looksBook) books.push(b);

      const candidates = links(html, url)
        .filter(a => isUsefulPage(a.url, root) && !queued.has(a.url))
        .map(a => ({ ...a, score: (/book|كتاب|download|تحميل/i.test(`${a.url} ${a.text}`) ? 10 : 0) + (/author|كاتب|مؤلف|تصنيف|category/i.test(`${a.url} ${a.text}`) ? 3 : 0) }))
        .sort((a, z) => z.score - a.score);

      for (const a of candidates) {
        if (seen.size + queue.length >= maxPages * 2) break;
        queued.add(a.url);
        if (a.score >= 10) queue.unshift(a.url); else queue.push(a.url);
      }
    } catch {}
  }

  const unique = new Map();
  for (const b of books) if (b.sourceUrl && !unique.has(b.sourceUrl)) unique.set(b.sourceUrl, b);
  return [...unique.values()];
}

async function parseAuthor(url, fallbackName) {
  if (!url) return { name: validAuthor(fallbackName) };
  try {
    const html = await fetchPage(url);
    const ld = jsonLd(html).find(x => /person/i.test(String(x["@type"] || ""))) || {};
    const name = validAuthor(ld.name) || validAuthor(meta(html, "author")) || validAuthor(firstTag(html, "h1")) || validAuthor(fallbackName);
    const bio = clean(ld.description || meta(html, "description") || firstTag(html, "article") || "");
    return { name, bio, sourceUrl: url };
  } catch {
    return { name: validAuthor(fallbackName), sourceUrl: url };
  }
}

async function parseCategory(url, fallbackName) {
  if (!url) return { name: validCategory(fallbackName) };
  try {
    const html = await fetchPage(url);
    const name = validCategory(firstTag(html, "h1")) || validCategory(meta(html, "og:title")) || validCategory(fallbackName);
    const description = clean(meta(html, "description") || "");
    return { name, description, sourceUrl: url };
  } catch {
    return { name: validCategory(fallbackName), sourceUrl: url };
  }
}

function rightsAllowed(html) {
  const s = clean(html).toLowerCase();
  if (/all rights reserved|جميع الحقوق محفوظة|كل الحقوق محفوظة/i.test(s)) return false;
  return /creative commons|public domain|permission|explicit permission|إذن صريح|ملكية عامة|المشاع الإبداعي|حقوق نشر مسموح/i.test(s);
}

async function downloadFile(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
    if (!r.ok) return null;
    const buffer = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get("content-type") || "";
    const signature = buffer.subarray(0, 5).toString("ascii");
    if (signature !== "%PDF-" && !/pdf/i.test(contentType)) return null;
    if (signature !== "%PDF-") return null;
    return { buffer, contentType: "application/pdf" };
  } catch { return null; }
}

async function upsertAuthor(info, downloadImages = true) {
  const name = validAuthor(info.name);
  if (!name) return null;
  let author = await Author.findOne({ name });
  if (!author) author = new Author({ name });
  if (info.bio && (!author.bio || author.bio.length < info.bio.length)) author.bio = info.bio;
  if (info.sourceUrl && !author.website) author.website = info.sourceUrl;

  if (downloadImages && !author.imageId) {
    try {
      const img = await findAuthorImage(name);
      if (img?.buffer) {
        const id = await uploadBuffer(img.buffer, `${name.replace(/\s+/g, "-")}.jpg`, img.contentType || "image/jpeg", { provider: img.provider || "external-web" }, "libraryAuthors");
        author.imageId = id;
        author.image = img.url || "";
      }
    } catch {}
  }
  await author.save();
  return author;
}

async function upsertCategory(info) {
  const name = validCategory(info.name);
  if (!name) return null;
  let category = await Category.findOne({ name });
  if (!category) category = new Category({ name });
  if (info.description && !category.description) category.description = info.description;
  await category.save();
  return category;
}

async function importOne(r, options = {}) {
  const authorInfo = await parseAuthor(r.authorUrl, r.authorName);
  const categoryInfo = await parseCategory(r.categoryUrl, r.categoryName);
  const author = await upsertAuthor(authorInfo, options.downloadFiles !== false);
  const category = await upsertCategory(categoryInfo);
  if (!r.title) return { skipped: true, reason: "missing-title" };

  let book = await Book.findOne({ source: "SMART", sourceUrl: r.sourceUrl });
  const isNew = !book;
  if (!book) book = new Book({ title: r.title, source: "SMART", sourceUrl: r.sourceUrl });

  book.title = r.title;
  if (author) book.author = author._id;
  if (category) book.category = category._id;
  if (r.description) book.description = r.description;
  if (r.language) book.language = r.language;
  if (r.publishedYear) book.publishedYear = Number(r.publishedYear);
  if (r.isbn) book.isbn = r.isbn;
  book.status = "approved";
  book.isAvailable = false;

  if (options.downloadFiles !== false) {
    try {
      const cover = await findBookCover(r.title, author?.name || r.authorName, r.isbn);
      if (cover?.buffer) {
        const id = await uploadBuffer(cover.buffer, `${r.title.replace(/\s+/g, "-")}.jpg`, cover.contentType || "image/jpeg", { provider: cover.provider || "external-web" }, "libraryCovers");
        book.coverImageId = id;
        book.coverImage = cover.url || "";
      }
    } catch {}
  }

  if (options.downloadFiles && r.fileUrl) {
    try {
      const pageHtml = await fetchPage(r.sourceUrl);
      if (rightsAllowed(pageHtml)) {
        const pdf = await downloadFile(r.fileUrl);
        if (pdf) {
          const id = await uploadBuffer(pdf.buffer, `${r.title}.pdf`, "application/pdf", { sourceUrl: r.sourceUrl, rights: "verified" }, "libraryBooks");
          book.fileId = id;
          book.filePath = r.fileUrl;
          book.sourceFileUrl = r.fileUrl;
          book.isAvailable = true;
        }
      }
    } catch {}
  }

  await book.save();
  return { imported: true, new: isNew, book, author, category };
}

async function scanAndImport(startUrl, options = {}) {
  if (!startUrl) throw new Error("url is required");
  const maxPages = Math.max(1, Math.min(Number(options.maxPages) || 30, MAX_PAGES));
  const discovered = await crawl(startUrl, maxPages);
  const results = [];
  for (const item of discovered) {
    try { results.push(await importOne(item, options)); }
    catch (error) { results.push({ imported: false, error: error.message, sourceUrl: item.sourceUrl }); }
  }
  return {
    ok: true,
    sourceUrl: startUrl,
    discovered: discovered.length,
    imported: results.filter(x => x.imported).length,
    skipped: results.filter(x => x.skipped).length,
    failed: results.filter(x => x.imported === false).length,
    externalImages: true,
    imagePolicy: "external-web-only",
    results
  };
}

module.exports = { scanAndImport };
