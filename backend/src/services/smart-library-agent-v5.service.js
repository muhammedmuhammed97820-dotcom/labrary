const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");
const { findBookCover, findAuthorImage } = require("./external-image.service");

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 200;
const MAX_ENTITY_PAGES = 100;
const UA = "ElectronicLibrary Smart Library Agent/5.0";

const clean = (v = "") => String(v)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ""; } })
  .replace(/\s+/g, " ").trim();
const abs = (base, value) => { try { return new URL(String(value || ""), base).href; } catch { return ""; } };
const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
const attr = (s, name) => String(s || "").match(new RegExp(`${name}=[\\"']([^\\"']+)`, "i"))?.[1] || "";
const meta = (html, name) => { const tags = html.match(/<meta\b[^>]*>/gi) || []; for (const t of tags) if (new RegExp(`(?:name|property)=[\\"']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\"']`, "i").test(t)) return clean(attr(t, "content")); return ""; };
const tag = (html, t) => clean(html.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, "i"))?.[1] || "");
const validAuthor = (v) => { const n = clean(v).replace(/^(?:الكاتب|المؤلف|بقلم|تأليف)\s*[:：-]?\s*/iu, ""); return n && n.length <= 160 && !/تحميل\s+كتاب|حقوق|pdf\b|فولة\s*بوك|مكتبة|library|book\b/i.test(n) ? n : ""; };
const cleanTitle = (v) => clean(v).replace(/^تحميل\s+كتاب\s+/iu, "").replace(/^كتاب\s+/iu, "").replace(/\s+(?:كتاب\s+)?pdf\s*$/iu, "").trim();

function links(html, page) {
  const out = [], re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { const u = abs(page, attr(m[1], "href") || attr(m[1], "data-href")); if (u && !/^(javascript:|mailto:|tel:)/i.test(u)) out.push({ url: u, text: clean(m[2]), attrs: m[1] }); }
  return out;
}
function images(html, page) {
  const out = [], re = /<img\b([^>]*)>/gi; let m;
  while ((m = re.exec(html))) { const a = m[1]; for (const k of ["src", "data-src", "data-lazy-src", "data-original", "data-image"]) { const u = abs(page, attr(a, k)); if (u) out.push({ url: u, alt: clean(attr(a, "alt")), attrs: a }); } }
  return out;
}
function jsonLd(html) {
  const out = [], re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { try { const v = JSON.parse(m[1].trim()); const add = x => { if (!x) return; if (Array.isArray(x)) return x.forEach(add); if (x["@graph"]) return x["@graph"].forEach(add); out.push(x); }; add(v); } catch {} }
  return out;
}

function extractBook(url, html) {
  const ld = jsonLd(html).find(x => /book/i.test(String(x?.["@type"] || ""))) || {};
  const as = links(html, url), text = clean(html);
  const bookTitle = cleanTitle(ld.name || tag(html, "h1") || meta(html, "og:title") || tag(html, "title"));
  let authorName = validAuthor(typeof ld.author === "string" ? ld.author : ld.author?.name);
  let authorUrl = abs(url, typeof ld.author === "object" ? ld.author?.url : "");
  const authorLink = as.find(a => validAuthor(a.text) && /(?:\/author\/|author|كاتب|مؤلف)/i.test(`${a.url} ${a.attrs}`));
  if (!authorName && authorLink) authorName = validAuthor(authorLink.text);
  if (authorLink) authorUrl = authorUrl || authorLink.url;
  if (!authorName) authorName = validAuthor(text.match(/(?:المؤلف|الكاتب|تأليف|بقلم)\s*[:：-]\s*([^|\n]{2,120})/iu)?.[1]);

  let categoryName = clean(typeof ld.genre === "object" ? ld.genre?.name : ld.genre);
  let categoryUrl = abs(url, typeof ld.genre === "object" ? ld.genre?.url : "");
  const catLink = as.find(a => clean(a.text) && /(?:\/books\/|category|categories|genre|تصنيف|قسم)/i.test(`${a.url} ${a.attrs}`));
  if (!categoryName) categoryName = clean(text.match(/(?:التصنيف|القسم)\s*[:：-]\s*([^|\n]{2,100})/iu)?.[1]) || clean(catLink?.text);
  categoryUrl = categoryUrl || catLink?.url || "";

  const pdfLink = as.find(a => /(?:تحميل|download|\.pdf(?:$|[?#]))/i.test(`${a.text} ${a.url}`));
  const rights = clean((text.match(/(?:Creative Commons|public domain|open access|open license|المشاع الإبداعي|ملك عام|المجال العام|جميع الحقوق محفوظة|حقوق الكتاب محفوظة)[^.!?]{0,350}/iu) || [""])[0]);
  const year = String(ld.datePublished || ld.dateCreated || text.match(/(?:سنة\s+النشر|سنة\s+الإصدار|تاريخ\s+النشر)\s*[:：-]?\s*(1[5-9]\d{2}|20\d{2})/iu)?.[1] || "").match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1];
  const isBook = /\/book(?:\/|[-_])/i.test(new URL(url).pathname) || /تحميل\s+كتاب|المؤلف\s*[:：-]|نوع\s+الملف/i.test(text) || /book/i.test(String(ld["@type"] || ""));
  return {
    isBook: Boolean(isBook && bookTitle), title: bookTitle, authorName, authorUrl, categoryName, categoryUrl,
    description: clean(ld.description || meta(html, "description")), publishedYear: year ? Number(year) : undefined,
    language: clean(ld.inLanguage), isbn: clean(ld.isbn), pdfUrl: pdfLink?.url || "", rights, sourceUrl: url
  };
}

async function fetchPage(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "ar,en;q=0.8" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") || ""; if (!/html|xhtml|xml/i.test(type)) return null;
  const s = await r.text(); if (Buffer.byteLength(s) > MAX_PAGE_BYTES) return null; return s;
}

async function crawl(rootUrl, maxPages) {
  const root = new URL(rootUrl); root.hash = ""; const queue = [root.href], queued = new Set(queue), seen = new Set(), records = [];
  const limit = Math.min(Math.max(Number(maxPages) || 50, 1), MAX_PAGES);
  while (queue.length && seen.size < limit) {
    const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
    try { const html = await fetchPage(url); if (!html) continue; const b = extractBook(url, html); if (b.isBook) records.push(b);
      for (const a of links(html, url)) { if (!sameOrigin(root.href, a.url)) continue; if (/\.(?:jpg|jpeg|png|gif|webp|svg|css|js|zip|rar|mp3|mp4|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(a.url)) continue; if (!queued.has(a.url) && seen.size + queue.length < limit * 3) { queued.add(a.url); queue.push(a.url); } }
    } catch {}
  }
  return { pages: seen.size, records };
}

async function parseAuthor(url, fallback) {
  try { const h = await fetchPage(url); if (!h) return null; const ld = jsonLd(h).find(x => /person/i.test(String(x?.["@type"] || ""))) || {};
    return { name: validAuthor(ld.name) || validAuthor(tag(h, "h1")) || validAuthor(fallback), bio: clean(ld.description || meta(h, "description")), birthDate: clean(ld.birthDate), deathDate: clean(ld.deathDate), birthPlace: clean(typeof ld.birthPlace === "string" ? ld.birthPlace : ld.birthPlace?.name), nationality: clean(typeof ld.nationality === "string" ? ld.nationality : ld.nationality?.name), occupation: clean(ld.jobTitle), website: clean(ld.url || ""), sourceUrl: url };
  } catch { return null; }
}
async function parseCategory(url, fallback) { try { const h = await fetchPage(url); if (!h) return null; return { name: clean(tag(h, "h1") || meta(h, "og:title") || fallback), description: clean(meta(h, "description")), sourceUrl: url }; } catch { return null; } }

const rightsAllowed = r => /public\s*domain|creative\s*commons|cc0|open\s+access|open\s+license|رخصة\s+المشاع\s+الإبداعي|ملك\s+عام|المجال\s+العام/i.test(r) && !/all\s+rights\s+reserved|جميع\s+الحقوق\s+محفوظة|حقوق\s+الكتاب\s+محفوظة/i.test(r);
const safe = (n, ext) => `${clean(n).replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 120) || "file"}.${ext}`;
async function downloadFile(url) { try { const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); if (!b.length || b.length > 80 * 1024 * 1024) return null; return { buffer: b, contentType: r.headers.get("content-type") || "application/octet-stream", finalUrl: r.url || url }; } catch { return null; } }

async function upsertAuthor(d, downloadFiles) {
  const name = validAuthor(d?.name); if (!name) return null; let a = await Author.findOne({ name }); if (!a) a = new Author({ name });
  for (const [k, v] of Object.entries({ bio: d.bio, birthPlace: d.birthPlace, nationality: d.nationality, occupation: d.occupation, website: d.website })) if (clean(v)) a[k] = clean(v);
  if (d.birthDate && !Number.isNaN(new Date(d.birthDate).getTime())) a.birthDate = new Date(d.birthDate); if (d.deathDate && !Number.isNaN(new Date(d.deathDate).getTime())) a.deathDate = new Date(d.deathDate);
  if (downloadFiles && !a.imageId) { const external = await findAuthorImage(name); if (external) { const ext = /png/i.test(external.contentType) ? "png" : /webp/i.test(external.contentType) ? "webp" : "jpg"; const u = await uploadBuffer(external.buffer, safe(name, ext), external.contentType, { entity: "author", sourceUrl: external.sourcePage || d.sourceUrl, provider: external.provider, query: name }, "libraryAuthors"); a.imageId = u.id; a.image = external.finalUrl; } }
  await a.save(); return a;
}
async function upsertCategory(d) { const name = clean(d?.name) || "غير مصنف"; let c = await Category.findOne({ name }); if (!c) c = new Category({ name }); if (clean(d?.description)) c.description = clean(d.description); await c.save(); return c; }

async function importOne(r, options, caches) {
  let author = null, category = null;
  if (r.authorName) { const key = r.authorUrl || `name:${r.authorName}`; if (!caches.authors.has(key)) caches.authors.set(key, r.authorUrl ? await parseAuthor(r.authorUrl, r.authorName) : { name: r.authorName }); const ad = caches.authors.get(key); if (ad) author = await upsertAuthor(ad, options.downloadFiles !== false); }
  if (r.categoryName) { const key = r.categoryUrl || `name:${r.categoryName}`; if (!caches.categories.has(key)) caches.categories.set(key, r.categoryUrl ? await parseCategory(r.categoryUrl, r.categoryName) : { name: r.categoryName }); category = await upsertCategory(caches.categories.get(key)); }

  let externalCover = null;
  if (options.downloadFiles !== false) externalCover = await findBookCover({ title: r.title, author: r.authorName, isbn: r.isbn });
  let book = await Book.findOne({ source: "SMART", sourceUrl: r.sourceUrl });
  if (!book) book = new Book({ title: r.title, source: "SMART", sourceUrl: r.sourceUrl, status: "approved", isAvailable: false });
  if (options.updateExisting || !book._id) {
    book.title = r.title; book.description = r.description || book.description; book.publishedYear = r.publishedYear; book.language = r.language || book.language; book.isbn = r.isbn || book.isbn; book.rights = r.rights || book.rights; book.sourceProvider = new URL(r.sourceUrl).hostname;
    if (author) { book.author = author._id; book.submittedAuthorName = author.name; }
    if (category) { book.category = category._id; book.submittedCategoryName = category.name; }
    if (externalCover) { const ext = /png/i.test(externalCover.contentType) ? "png" : /webp/i.test(externalCover.contentType) ? "webp" : "jpg"; const u = await uploadBuffer(externalCover.buffer, safe(r.title, ext), externalCover.contentType, { entity: "book-cover", sourceUrl: externalCover.finalUrl, provider: externalCover.provider, query: externalCover.query }, "libraryCovers"); book.coverImageId = u.id; book.coverImage = externalCover.finalUrl; }
    if (options.downloadFiles && r.pdfUrl && rightsAllowed(r.rights)) { const pdf = await downloadFile(r.pdfUrl); if (pdf && /pdf|octet-stream/i.test(pdf.contentType) && /^%PDF|application\/pdf/i.test(pdf.buffer.subarray(0, 8).toString("latin1") || "")) { const u = await uploadBuffer(pdf.buffer, safe(r.title, "pdf"), "application/pdf", { entity: "book-pdf", sourceUrl: pdf.finalUrl, rights: r.rights }, "libraryBooks"); book.fileId = u.id; book.filePath = pdf.finalUrl; book.sourceFileUrl = pdf.finalUrl; book.isAvailable = true; } }
    await book.save();
  }
  return { bookId: book._id, title: book.title, author: author?.name || "", category: category?.name || "", externalCover: externalCover?.provider || "" };
}

async function scanAndImport(rootUrl, options = {}) {
  if (!/^https?:\/\//i.test(rootUrl)) throw new Error("الرابط يجب أن يبدأ بـ http أو https.");
  const crawled = await crawl(rootUrl, options.maxPages); const caches = { authors: new Map(), categories: new Map() }; const imported = [];
  if (options.import !== false) for (const r of crawled.records) { try { imported.push(await importOne(r, options, caches)); } catch (e) { imported.push({ title: r.title, error: e.message }); } }
  return { pages: crawled.pages, discovered: crawled.records.length, normalized: crawled.records.length, imported: imported.filter(x => !x.error).length, books: imported, externalImages: true, imagePolicy: "external-web-only" };
}

module.exports = { scanAndImport };
