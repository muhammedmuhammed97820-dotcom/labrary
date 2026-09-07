const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 200;
const UA = "ElectronicLibrary Smart Library Agent/4.0";

const clean = (v = "") => String(v).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ""; } }).replace(/\s+/g, " ").trim();
const abs = (base, value) => { try { return new URL(String(value || ""), base).href; } catch { return ""; } };
const same = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
const attr = (s, name) => s.match(new RegExp(`${name}=[\\"']([^\\"']+)`, "i"))?.[1] || "";
const meta = (html, name) => { const re = new RegExp(`<meta[^>]+(?:name|property)=[\\"']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [\\"'][^>]*>`, "i"); const m = html.match(re); if (m) return clean(attr(m[0], "content")); const all = html.match(/<meta[^>]+>/gi) || []; for (const x of all) if (new RegExp(`(?:name|property)=[\\"']${name}[\\"']`, "i").test(x)) return clean(attr(x, "content")); return ""; };
const tag = (html, t) => clean(html.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}>`, "i"))?.[1] || "");

function links(html, page) {
  const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { const u = abs(page, attr(m[1], "href") || attr(m[1], "data-href")); if (u && !/^(javascript:|mailto:|tel:)/i.test(u)) out.push({ url: u, text: clean(m[2]), attrs: m[1] }); }
  return out;
}
function imgs(html, page) {
  const out = []; const re = /<img\b([^>]*)>/gi; let m;
  while ((m = re.exec(html))) { const a = m[1]; for (const k of ["src", "data-src", "data-lazy-src", "data-original", "data-image"]) { const u = abs(page, attr(a, k)); if (u) out.push({ url: u, alt: clean(attr(a, "alt")), attrs: a }); } }
  return out;
}
function jsonLd(html) { const out = []; const re = /<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi; let m; while ((m = re.exec(html))) { try { const v = JSON.parse(m[1].trim()); const add = x => { if (!x) return; if (Array.isArray(x)) x.forEach(add); else if (x["@graph"]) x["@graph"].forEach(add); else out.push(x); }; add(v); } catch {} } return out; }
function validAuthor(v) { const n = clean(v).replace(/^(?:الكاتب|المؤلف|بقلم|تأليف)\s*[:：-]?\s*/iu, ""); if (!n || n.length > 160 || /تحميل\s+كتاب|حقوق|pdf\b|فولة\s*بوك|مكتبة|library|book\b/i.test(n)) return ""; return n; }
function title(v) { return clean(v).replace(/^تحميل\s+كتاب\s+/iu, "").replace(/\s+(?:تأليف|الكاتب|المؤلف)\s+.+?(?=\s+pdf\b|$)/iu, "").replace(/\s+(?:كتاب\s+)?pdf\s*$/iu, "").replace(/^كتاب\s+/iu, "").trim(); }

function extractBook(url, html) {
  const ld = jsonLd(html).find(x => /book/i.test(String(x?.["@type"] || ""))) || {};
  const as = links(html, url); const text = clean(html);
  const h1 = tag(html, "h1");
  const bookTitle = title(ld.name || h1 || meta(html, "og:title") || tag(html, "title"));

  let authorName = validAuthor(typeof ld.author === "string" ? ld.author : ld.author?.name);
  let authorUrl = abs(url, typeof ld.author === "object" ? ld.author?.url : "");
  const authorLink = as.find(a => validAuthor(a.text) && /(?:author|كاتب|مؤلف)/i.test(`${a.url} ${a.attrs}`)) || as.find(a => validAuthor(a.text) && text.includes(`المؤلف : ${a.text}`));
  if (!authorName && authorLink) authorName = validAuthor(authorLink.text);
  if (authorLink) authorUrl = authorUrl || authorLink.url;
  const am = text.match(/(?:المؤلف|الكاتب|تأليف|بقلم)\s*[:：-]\s*([^|\n]{2,120})/iu);
  if (!authorName) authorName = validAuthor(am?.[1]);

  let categoryName = clean(typeof ld.genre === "object" ? ld.genre?.name : ld.genre);
  let categoryUrl = abs(url, typeof ld.genre === "object" ? ld.genre?.url : "");
  const catLink = as.find(a => clean(a.text) && /(?:category|categories|genre|تصنيف|قسم)/i.test(`${a.url} ${a.attrs}`));
  const cm = text.match(/(?:التصنيف|القسم)\s*[:：-]\s*([^|\n]{2,100})/iu);
  if (!categoryName) categoryName = clean(cm?.[1]) || clean(catLink?.text);
  categoryUrl = categoryUrl || catLink?.url || "";

  const download = as.find(a => /(?:تحميل|download|\.pdf(?:$|[?#]))/i.test(`${a.text} ${a.url}`));
  const pdfUrl = download?.url || "";
  const imageCandidates = [];
  const ji = typeof ld.image === "string" ? ld.image : ld.image?.url; if (ji) imageCandidates.push(abs(url, ji));
  const og = meta(html, "og:image"); if (og) imageCandidates.push(abs(url, og));
  for (const i of imgs(html, url)) if (!/logo|favicon|avatar|author|profile|placeholder|default/i.test(`${i.alt} ${i.attrs}`)) imageCandidates.push(i.url);
  const coverUrl = imageCandidates.find(Boolean) || "";
  const description = clean(ld.description || meta(html, "description") || (html.match(/(?:لمحة عن الكتاب|نبذة عن الكتاب)[\s\S]{0,8000}/iu)?.[0] || "")).replace(/^(?:لمحة عن الكتاب|نبذة عن الكتاب)\s*/iu, "");
  const year = String(ld.datePublished || ld.dateCreated || text.match(/(?:سنة\s+النشر|سنة\s+الإصدار|تاريخ\s+النشر)\s*[:：-]?\s*(1[5-9]\d{2}|20\d{2})/iu)?.[1] || "").match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1];
  const rights = (text.match(/(?:المشاع الإبداعي|Creative Commons|public domain|open access|All rights reserved|جميع الحقوق محفوظة|حقوق الكتاب محفوظة)[^.!?]{0,300}/iu) || [""])[0];
  const isBook = /\/book(?:\/|[-_])/i.test(new URL(url).pathname) || /تحميل\s+كتاب|المؤلف\s*[:：-]|نوع\s+الملف\s*[:：-]/iu.test(text) || /book/i.test(String(ld["@type"] || ""));
  return { isBook: Boolean(isBook && bookTitle), title: bookTitle, authorName, authorUrl, categoryName, categoryUrl, description, publishedYear: year ? Number(year) : undefined, language: clean(ld.inLanguage), isbn: clean(ld.isbn), coverUrl, pdfUrl, rights: clean(rights), sourceUrl: url };
}

async function fetchPage(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "ar,en;q=0.8" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); const type = r.headers.get("content-type") || ""; if (!/html|xhtml|xml/i.test(type)) return null;
  const s = await r.text(); if (Buffer.byteLength(s) > MAX_PAGE_BYTES) throw new Error("page-too-large"); return s;
}

async function crawl(rootUrl, maxPages) {
  const root = new URL(rootUrl); root.hash = ""; const q = [root.href], seen = new Set(), queued = new Set(q), records = []; const limit = Math.min(Math.max(Number(maxPages) || 50, 1), MAX_PAGES);
  while (q.length && seen.size < limit) { const url = q.shift(); if (seen.has(url)) continue; seen.add(url); try { const html = await fetchPage(url); if (!html) continue; const b = extractBook(url, html); if (b.isBook) records.push(b); for (const a of links(html, url)) { if (!same(root.href, a.url)) continue; if (/\.(?:jpg|jpeg|png|gif|webp|svg|css|js|zip|rar|mp3|mp4|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(a.url)) continue; if (!queued.has(a.url) && seen.size + q.length < limit * 3) { queued.add(a.url); q.push(a.url); } } } catch {} }
  return { pages: seen.size, records };
}

async function parseAuthor(url, fallback) { try { const h = await fetchPage(url); if (!h) return null; const ld = jsonLd(h).find(x => /person/i.test(String(x?.["@type"] || ""))) || {}; const name = validAuthor(ld.name) || validAuthor(tag(h, "h1")) || validAuthor(fallback); const image = typeof ld.image === "string" ? ld.image : ld.image?.url; const og = meta(h, "og:image"); const im = abs(url, image || og || imgs(h, url).find(x => !/logo|favicon|placeholder|default/i.test(`${x.alt} ${x.attrs}`))?.url); const article = (h.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || ""); return { name, bio: clean(ld.description || article || meta(h, "description")), imageUrl: im, birthDate: clean(ld.birthDate), deathDate: clean(ld.deathDate), birthPlace: clean(typeof ld.birthPlace === "string" ? ld.birthPlace : ld.birthPlace?.name), nationality: clean(typeof ld.nationality === "string" ? ld.nationality : ld.nationality?.name), occupation: clean(ld.jobTitle), website: clean(ld.url || (Array.isArray(ld.sameAs) ? ld.sameAs[0] : ld.sameAs)), sourceUrl: url }; } catch { return null; } }
async function parseCategory(url, fallback) { try { const h = await fetchPage(url); if (!h) return null; const ld = jsonLd(h).find(x => /collectionpage|itemlist|category/i.test(String(x?.["@type"] || ""))) || {}; return { name: clean(tag(h, "h1") || ld.name || meta(h, "og:title") || fallback), description: clean(ld.description || meta(h, "description")), sourceUrl: url }; } catch { return null; } }

const rightsAllowed = r => /public\s*domain|creative\s*commons|cc0|open\s+access|open\s+license|رخصة\s+المشاع\s+الإبداعي|ملك\s+عام|المجال\s+العام/i.test(r) && !/all\s+rights\s+reserved|جميع\s+الحقوق\s+محفوظة|حقوق\s+الكتاب\s+محفوظة/i.test(r);
const download = async (url) => { if (!url) return null; try { const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); if (!b.length || b.length > 80 * 1024 * 1024) return null; return { buffer: b, contentType: r.headers.get("content-type") || "application/octet-stream", finalUrl: r.url || url }; } catch { return null; } };
const safe = (n, ext) => `${clean(n).replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 120) || "file"}.${ext}`;

async function upsertAuthor(d, downloadFiles) {
  const name = validAuthor(d.name); if (!name) return null; let a = await Author.findOne({ name }); if (!a) a = new Author({ name });
  for (const [k, v] of Object.entries({ bio: clean(d.bio), birthPlace: clean(d.birthPlace), nationality: clean(d.nationality), occupation: clean(d.occupation), website: clean(d.website) })) if (v) a[k] = v;
  if (d.birthDate && !Number.isNaN(new Date(d.birthDate).getTime())) a.birthDate = new Date(d.birthDate); if (d.deathDate && !Number.isNaN(new Date(d.deathDate).getTime())) a.deathDate = new Date(d.deathDate);
  if (downloadFiles && d.imageUrl && !a.imageId) { const x = await download(d.imageUrl); if (x && /^image\//i.test(x.contentType)) { const ext = /png/i.test(x.contentType) ? "png" : /webp/i.test(x.contentType) ? "webp" : "jpg"; const u = await uploadBuffer(x.buffer, safe(name, ext), x.contentType, { entity: "author", sourceUrl: d.sourceUrl }, "libraryAuthors"); a.imageId = u.id; } }
  if (d.imageUrl) a.image = d.imageUrl; await a.save(); return a;
}
async function upsertCategory(d) { const name = clean(d.name) || "غير مصنف"; let c = await Category.findOne({ name }); if (!c) c = new Category({ name }); if (clean(d.description)) c.description = clean(d.description); await c.save(); return c; }

async function scanAndImport(rootUrl, options = {}) {
  if (!/^https?:\/\//i.test(rootUrl)) throw new Error("الرابط يجب أن يبدأ بـ http أو https.");
  const crawlResult = await crawl(rootUrl, options.maxPages); const authorCache = new Map(), categoryCache = new Map();
  for (const r of crawlResult.records) { if (r.authorUrl && r.authorName && same(rootUrl, r.authorUrl) && !authorCache.has(r.authorUrl)) authorCache.set(r.authorUrl, await parseAuthor(r.authorUrl, r.authorName)); if (r.categoryUrl && r.categoryName && same(rootUrl, r.categoryUrl) && !categoryCache.has(r.categoryUrl)) categoryCache.set(r.categoryUrl, await parseCategory(r.categoryUrl, r.categoryName)); }
  const records = crawlResult.records.map(r => { const a = authorCache.get(r.authorUrl), c = categoryCache.get(r.categoryUrl); return { ...r, authorName: validAuthor(a?.name) || r.authorName, authorBio: a?.bio || "", authorImageUrl: a?.imageUrl || "", birthDate: a?.birthDate, deathDate: a?.deathDate, birthPlace: a?.birthPlace, nationality: a?.nationality, occupation: a?.occupation, website: a?.website, categoryName: clean(c?.name || r.categoryName) || "غير مصنف", categoryDescription: c?.description || "" }; }).filter(r => r.title && validAuthor(r.authorName));
  const unique = [...new Map(records.map(r => [r.sourceUrl, r])).values()]; const preview = unique.map(r => ({ title: r.title, author: r.authorName, category: r.categoryName, description: r.description, sourceUrl: r.sourceUrl, authorUrl: r.authorUrl, categoryUrl: r.categoryUrl, coverUrl: r.coverUrl, pdfUrl: r.pdfUrl, rights: r.rights, authorImageUrl: r.authorImageUrl }));
  const results = []; if (options.import !== false) for (const r of unique) { try { const author = await upsertAuthor({ name: r.authorName, bio: r.authorBio, imageUrl: r.authorImageUrl, birthDate: r.birthDate, deathDate: r.deathDate, birthPlace: r.birthPlace, nationality: r.nationality, occupation: r.occupation, website: r.website, sourceUrl: r.authorUrl }, options.downloadFiles); const category = await upsertCategory({ name: r.categoryName, description: r.categoryDescription }); const sourceId = r.sourceUrl; let book = await Book.findOne({ source: "SMART", sourceId }); const existing = Boolean(book); if (existing && !options.updateExisting) { results.push({ status: "exists", id: book._id, title: r.title }); continue; } if (!book) book = new Book({ source: "SMART", sourceId }); book.title = r.title; book.author = author?._id || null; book.category = category?._id || null; book.submittedAuthorName = r.authorName; book.submittedCategoryName = r.categoryName; book.description = clean(r.description); book.publishedYear = r.publishedYear; book.language = r.language || ""; book.isbn = r.isbn || ""; book.source = "SMART"; book.sourceId = sourceId; book.sourceUrl = r.sourceUrl; book.sourceFileUrl = r.pdfUrl || ""; book.sourceProvider = new URL(r.sourceUrl).hostname; book.rights = clean(r.rights); book.status = "approved";
    if (options.downloadFiles && r.pdfUrl && rightsAllowed(r.rights)) { const x = await download(r.pdfUrl); if (x && (/application\/pdf/i.test(x.contentType) || /\.pdf(?:$|[?#])/i.test(x.finalUrl))) { const u = await uploadBuffer(x.buffer, safe(r.title, "pdf"), "application/pdf", { entity: "book", sourceUrl: r.sourceUrl, rights: r.rights }, "libraryBooks"); book.fileId = u.id; book.isAvailable = true; } }
    if (options.downloadFiles && r.coverUrl) { const x = await download(r.coverUrl); if (x && /^image\//i.test(x.contentType)) { const ext = /png/i.test(x.contentType) ? "png" : /webp/i.test(x.contentType) ? "webp" : "jpg"; const u = await uploadBuffer(x.buffer, safe(r.title, ext), x.contentType, { entity: "book-cover", sourceUrl: r.sourceUrl }, "libraryCovers"); book.coverImageId = u.id; book.coverImage = ""; } }
    await book.save(); results.push({ status: existing ? "updated" : "imported", id: book._id, title: r.title, author: r.authorName, category: r.categoryName, hasCover: Boolean(book.coverImageId), hasPdf: Boolean(book.fileId) }); } catch (e) { results.push({ status: "error", title: r.title, error: e.message }); } }
  return { pages: crawlResult.pages, discovered: crawlResult.records.length, normalized: unique.length, imported: results.filter(x => ["imported", "updated"].includes(x.status)).length, existing: results.filter(x => x.status === "exists").length, errors: results.filter(x => x.status === "error").length, preview, results };
}
module.exports = { scanAndImport, extractBook };
