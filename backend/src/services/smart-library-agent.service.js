const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MODEL = process.env.AI_IMPORT_MODEL || "gpt-5.6-luna";
const USER_AGENT = "ElectronicLibrary Smart Library Agent/2.0";

const clean = (v) => String(v || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const absolute = (base, value) => { try { return new URL(value, base).href; } catch { return ""; } };
const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const safeName = (v, ext) => `${clean(v).replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 120) || "file"}.${ext}`;

function htmlText(html) {
  return clean(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " "));
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${escapeRegex(name)}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  return clean(html.match(re)?.[1] || "");
}

function jsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const value = JSON.parse(m[1].trim());
      if (Array.isArray(value)) out.push(...value); else out.push(value);
      if (value?.["@graph"]) out.push(...value["@graph"]);
    } catch (_) {}
  }
  return out;
}

function anchors(html, pageUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].match(/(?:href|data-href)=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = absolute(pageUrl, href);
    if (url) out.push({ url, text: clean(m[2]).slice(0, 300), attrs: m[1] });
  }
  return out;
}

function images(html, pageUrl) {
  const out = [];
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].match(/(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    const url = absolute(pageUrl, src);
    if (url) out.push({ url, alt: clean(m[1].match(/alt=["']([^"']*)["']/i)?.[1]), attrs: m[1] });
  }
  return out;
}

function firstTag(html, tag) {
  const m = String(html || "").match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return clean(m?.[1] || "");
}

function cleanBookTitle(value) {
  let title = clean(value);
  title = title.replace(/^تحميل\s+كتاب\s+/i, "");
  title = title.replace(/\s+تأليف\s+.+?(?=\s+pdf\b|$)/i, "");
  title = title.replace(/\s*[-|–—:]\s*(فولة بوك|مكتبة فولة بوك|foulabook).*$/i, "");
  title = title.replace(/\s+pdf\s*$/i, "").trim();
  return title;
}

function looksLikeBook(pageUrl, html, data) {
  const types = jsonLd(html).map((x) => String(x?.["@type"] || "").toLowerCase());
  if (types.some((t) => t === "book" || t.includes("book"))) return true;
  if (/\/(?:ar\/)?book(?:\/|[-_])/i.test(new URL(pageUrl).pathname)) return true;
  if (data.pdfUrl) return true;
  return /\b(?:book|isbn|pdf|تحميل كتاب|عدد الصفحات|دار النشر|سنة النشر)\b/i.test(data.rawText);
}

function extractBook(pageUrl, html) {
  const nodes = jsonLd(html);
  const book = nodes.find((x) => String(x?.["@type"] || "").toLowerCase().includes("book")) || {};
  const authorObj = typeof book.author === "object" ? book.author : null;
  const authorName = clean(typeof book.author === "string" ? book.author : authorObj?.name);
  const authorUrl = absolute(pageUrl, authorObj?.["@id"] || authorObj?.url || "");
  const image = typeof book.image === "string" ? book.image : book.image?.url;
  const links = anchors(html, pageUrl);
  const pdfUrl = links.map((x) => x.url).find((x) => /\.pdf(?:$|[?#])/i.test(x)) || "";
  const h1 = firstTag(html, "h1");
  const title = cleanBookTitle(book.name || h1 || meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const coverCandidates = [absolute(pageUrl, image), absolute(pageUrl, meta(html, "og:image")), ...images(html, pageUrl).map((x) => x.url)];
  const coverUrl = coverCandidates.find((x) => x && !/logo|favicon|avatar|placeholder|default/i.test(x)) || "";
  const authorLink = links.find((x) => authorName && x.text.toLowerCase() === authorName.toLowerCase()) || links.find((x) => /(?:author|writer|\u0645\u0624\u0644\u0641|\u0643\u0627\u062a\u0628)/i.test(`${x.url} ${x.text}`));
  const categoryLink = links.find((x) => /(?:category|categories|genre|\u062a\u0635\u0646\u064a\u0641|\u0642\u0633\u0645)/i.test(`${x.url} ${x.text}`));
  const rawText = htmlText(html).slice(0, 12000);
  return {
    isBook: looksLikeBook(pageUrl, html, { pdfUrl, rawText }),
    title,
    authorName,
    authorUrl: authorUrl || authorLink?.url || "",
    categoryName: clean(typeof book.genre === "string" ? book.genre : Array.isArray(book.genre) ? book.genre[0] : book.genre?.name),
    categoryUrl: categoryLink?.url || "",
    description: clean(book.description || meta(html, "description")),
    publishedYear: Number.parseInt(String(book.datePublished || "").slice(0, 4), 10) || undefined,
    language: clean(book.inLanguage),
    isbn: clean(book.isbn),
    subjects: Array.isArray(book.keywords) ? book.keywords.map(clean) : clean(book.keywords).split(/[,،]/).map(clean).filter(Boolean),
    coverUrl,
    pdfUrl,
    sourceUrl: pageUrl,
    rights: extractRights(rawText),
    rawText
  };
}

function extractRights(text) {
  const t = clean(text);
  const patterns = [
    /(?:public domain|public-domain|creative commons|cc0|open access|open license|free to use|publicly licensed)/i,
    /(?:ملك عام|المجال العام|مشاع|رخصة المشاع الإبداعي|رخصة حرة|متاح للاستخدام الحر|مرخص)/i,
    /(?:all rights reserved|جميع الحقوق محفوظة|حقوق الطبع محفوظة|للاستخدام الشخصي فقط)/i
  ];
  for (const p of patterns) { const m = t.match(new RegExp(`[^.!?]{0,180}${p.source}[^.!?]{0,240}`, p.flags)); if (m) return clean(m[0]); }
  return "";
}

async function fetchPage(url) {
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml|application\/xml|text\/xml/i.test(type)) return null;
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_PAGE_BYTES) throw new Error("الصفحة أكبر من الحد المسموح.");
  return response.text();
}

function entityLinks(book) {
  return [book.authorUrl, book.categoryUrl].filter(Boolean);
}

function parseAuthor(pageUrl, html, fallbackName) {
  const nodes = jsonLd(html);
  const person = nodes.find((x) => String(x?.["@type"] || "").toLowerCase() === "person") || {};
  const name = clean(person.name || firstTag(html, "h1") || meta(html, "og:title") || fallbackName);
  const imgs = images(html, pageUrl).map((x) => x.url);
  const image = absolute(pageUrl, typeof person.image === "string" ? person.image : person.image?.url) || absolute(pageUrl, meta(html, "og:image")) || imgs.find((x) => !/logo|favicon|placeholder/i.test(x)) || "";
  return {
    name,
    bio: clean(person.description || firstTag(html, "article") || meta(html, "description")),
    imageUrl: image,
    birthDate: clean(person.birthDate),
    deathDate: clean(person.deathDate),
    birthPlace: clean(typeof person.birthPlace === "string" ? person.birthPlace : person.birthPlace?.name),
    nationality: clean(typeof person.nationality === "string" ? person.nationality : person.nationality?.name),
    occupation: clean(typeof person.jobTitle === "string" ? person.jobTitle : person.occupation?.name),
    website: clean(person.url || person.sameAs?.[0]),
    rawText: htmlText(html).slice(0, 9000)
  };
}

function parseCategory(pageUrl, html, fallbackName) {
  const nodes = jsonLd(html);
  const category = nodes.find((x) => /collectionpage|itemlist/i.test(String(x?.["@type"] || ""))) || {};
  return {
    name: clean(firstTag(html, "h1") || category.name || meta(html, "og:title") || fallbackName),
    description: clean(category.description || meta(html, "description") || firstTag(html, "article")),
    rawText: htmlText(html).slice(0, 7000)
  };
}

async function enrichEntities(records, rootUrl, maxEntityPages = 100) {
  const cache = new Map();
  const authorPages = new Map();
  const categoryPages = new Map();
  for (const record of records) {
    if (record.authorUrl && sameOrigin(rootUrl, record.authorUrl)) authorPages.set(record.authorUrl, record.authorName);
    if (record.categoryUrl && sameOrigin(rootUrl, record.categoryUrl)) categoryPages.set(record.categoryUrl, record.categoryName);
  }
  let count = 0;
  for (const [url, name] of authorPages) {
    if (count++ >= maxEntityPages) break;
    try { const html = await fetchPage(url); if (html) cache.set(url, { type: "author", data: parseAuthor(url, html, name) }); } catch (_) {}
  }
  for (const [url, name] of categoryPages) {
    if (count++ >= maxEntityPages) break;
    try { const html = await fetchPage(url); if (html) cache.set(url, { type: "category", data: parseCategory(url, html, name) }); } catch (_) {}
  }
  return records.map((record) => ({ ...record, authorData: cache.get(record.authorUrl)?.data || null, categoryData: cache.get(record.categoryUrl)?.data || null }));
}

async function aiNormalize(records) {
  const fallback = records.map((r) => ({
    ...r,
    title: cleanBookTitle(r.title),
    authorName: clean(r.authorData?.name || r.authorName),
    authorBio: clean(r.authorData?.bio),
    authorImageUrl: r.authorData?.imageUrl || "",
    nationality: clean(r.authorData?.nationality),
    occupation: clean(r.authorData?.occupation),
    website: clean(r.authorData?.website),
    categoryName: clean(r.categoryData?.name || r.categoryName) || "غير مصنف",
    categoryDescription: clean(r.categoryData?.description),
    language: clean(r.language) || (/^[\u0600-\u06ff]/.test(r.title || "") ? "ar" : ""),
    rights: clean(r.rights),
    subjects: Array.isArray(r.subjects) ? r.subjects : []
  }));
  if (!process.env.OPENAI_API_KEY || !fallback.length) return fallback;
  const input = fallback.slice(0, 20).map((r) => ({ title: r.title, page: r.rawText, author: r.authorData, category: r.categoryData, url: r.sourceUrl }));
  const prompt = `أنت وكيل فهرسة لمكتبة. نظّم البيانات إلى JSON array فقط. لا تخترع أي معلومة ولا تستخدم اسم الموقع كمؤلف. نظّف عنوان الكتاب من عبارات SEO مثل تحميل كتاب/تأليف/pdf. استخدم بيانات صفحة المؤلف وصفحة التصنيف عندما تكون موجودة. الحقول: title, authorName, authorBio, authorImageUrl, birthDate, deathDate, birthPlace, nationality, occupation, website, categoryName, categoryDescription, description, publishedYear, language, isbn, subjects, rights, sourceUrl, pdfUrl, coverUrl. إذا لم تتوفر معلومة اتركها فارغة. الحقوق يجب أن تكون دليلاً نصياً من المصدر لا استنتاجاً.\n${JSON.stringify(input)}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: MODEL, input: prompt }) });
    if (!response.ok) return fallback;
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap((x) => x.content || []).map((x) => x.text || "").join("") || "";
    const a = text.indexOf("["), b = text.lastIndexOf("]");
    if (a < 0 || b < a) return fallback;
    const parsed = JSON.parse(text.slice(a, b + 1));
    return Array.isArray(parsed) ? parsed.map((x, i) => ({ ...fallback[i], ...x })) : fallback;
  } catch (_) { return fallback; }
}

async function downloadAsset(url, kind) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": USER_AGENT, Accept: kind === "pdf" ? "application/pdf,*/*" : "image/*,*/*" } });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  if (kind === "pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-" && !/application\/pdf/i.test(contentType)) return null;
  if (kind === "image" && !/^image\//i.test(contentType) && buffer.subarray(0, 3).toString("hex") !== "ffd8ff" && buffer.subarray(0, 4).toString("hex") !== "89504e47") return null;
  return { buffer, contentType: contentType || (kind === "pdf" ? "application/pdf" : "image/jpeg") };
}

async function upsertAuthor(record, options) {
  const name = clean(record.authorName);
  if (!name || /foulabook|مكتبة فولة بوك|فولة بوك|مؤلف غير معروف/i.test(name)) return null;
  let author = await Author.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
  const data = { name, bio: clean(record.authorBio), birthDate: record.birthDate || undefined, deathDate: record.deathDate || undefined, birthPlace: clean(record.birthPlace), nationality: clean(record.nationality), occupation: clean(record.occupation), website: clean(record.website) };
  if (!author) author = await Author.create(data);
  else {
    for (const [key, value] of Object.entries(data)) if (value && !author[key]) author[key] = value;
    if (options.downloadFiles && record.authorImageUrl && !author.imageId) {
      const image = await downloadAsset(record.authorImageUrl, "image").catch(() => null);
      if (image) author.imageId = await uploadBuffer(image.buffer, safeName(name, "jpg"), image.contentType, { source: record.authorUrl || record.sourceUrl }, "libraryAuthors");
    }
    await author.save();
    return author;
  }
  if (options.downloadFiles && record.authorImageUrl) {
    const image = await downloadAsset(record.authorImageUrl, "image").catch(() => null);
    if (image) { author.imageId = await uploadBuffer(image.buffer, safeName(name, "jpg"), image.contentType, { source: record.authorUrl || record.sourceUrl }, "libraryAuthors"); await author.save(); }
  }
  return author;
}

async function upsertCategory(record) {
  const name = clean(record.categoryName) || "غير مصنف";
  let category = await Category.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
  if (!category) category = await Category.create({ name, description: clean(record.categoryDescription) });
  else if (!category.description && record.categoryDescription) { category.description = clean(record.categoryDescription); await category.save(); }
  return category;
}

async function importRecords(records, options = {}) {
  const results = [];
  for (const record of records) {
    const title = cleanBookTitle(record.title);
    if (!title) continue;
    const author = await upsertAuthor(record, options);
    const category = await upsertCategory(record);
    const sourceUrl = clean(record.sourceUrl);
    if (!sourceUrl) continue;
    const sourceId = sourceUrl;
    let book = await Book.findOne({ source: "SMART", sourceId });
    if (book && !options.updateExisting) { results.push({ title, status: "موجود مسبقاً", bookId: book._id }); continue; }
    const data = {
      title,
      author: author?._id || null,
      category: category._id,
      submittedAuthorName: author?.name || clean(record.authorName),
      submittedCategoryName: category.name,
      description: clean(record.description),
      publishedYear: Number(record.publishedYear) || undefined,
      language: clean(record.language),
      isbn: clean(record.isbn),
      subjects: Array.isArray(record.subjects) ? record.subjects.map(clean).filter(Boolean) : [],
      source: "SMART",
      sourceId,
      sourceUrl,
      sourceFileUrl: clean(record.pdfUrl),
      sourceProvider: (() => { try { return new URL(sourceUrl).hostname; } catch { return ""; } })(),
      rights: clean(record.rights),
      status: "approved",
      isAvailable: false
    };
    if (options.downloadFiles) {
      const cover = await downloadAsset(record.coverUrl, "image").catch(() => null);
      if (cover) data.coverImageId = await uploadBuffer(cover.buffer, safeName(title, "jpg"), cover.contentType, { source: sourceUrl }, "libraryCovers");
      const rights = data.rights;
      const allowedPdf = /public domain|public-domain|creative commons|cc0|open access|open license|ملك عام|المجال العام|مشاع|رخصة حرة|مرخص/i.test(rights) && !/all rights reserved|جميع الحقوق محفوظة|للاستخدام الشخصي فقط/i.test(rights);
      if (allowedPdf) {
        const pdf = await downloadAsset(record.pdfUrl, "pdf").catch(() => null);
        if (pdf) { data.fileId = await uploadBuffer(pdf.buffer, safeName(title, "pdf"), pdf.contentType, { source: sourceUrl }, "libraryBooks"); data.isAvailable = true; }
      }
    }
    book = book ? await Book.findByIdAndUpdate(book._id, data, { new: true }) : await Book.create(data);
    results.push({ title, status: book ? (options.updateExisting ? "تم التحديث" : "تمت الإضافة") : "تمت الإضافة", bookId: book._id, pdf: Boolean(book.fileId), cover: Boolean(book.coverImageId), author: Boolean(author), category: Boolean(category) });
  }
  return results;
}

async function crawlLibrary(rootUrl, maxPages = 50) {
  const start = new URL(rootUrl).href;
  const queue = [start];
  const visited = new Set();
  const candidates = [];
  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const html = await fetchPage(url);
      if (!html) continue;
      const book = extractBook(url, html);
      if (book.isBook && book.title) candidates.push(book);
      for (const link of anchors(html, url).map((x) => x.url)) {
        if (!sameOrigin(start, link) || visited.has(link)) continue;
        if (/\.(?:jpg|jpeg|png|webp|gif|css|js|zip|mp3|mp4)$/i.test(link)) continue;
        queue.push(link);
      }
    } catch (_) {}
  }
  const unique = new Map();
  for (const item of candidates) unique.set(item.sourceUrl, item);
  return { pages: visited.size, candidates: [...unique.values()] };
}

async function scanAndImport(url, options = {}) {
  const maxPages = Math.min(Math.max(Number(options.maxPages) || 50, 1), 200);
  const crawled = await crawlLibrary(url, maxPages);
  const enriched = await enrichEntities(crawled.candidates, url, Math.min(maxPages, 100));
  const normalized = [];
  for (let i = 0; i < enriched.length; i += 20) normalized.push(...await aiNormalize(enriched.slice(i, i + 20)));
  const deduped = [...new Map(normalized.filter((x) => cleanBookTitle(x.title)).map((x) => [clean(x.isbn) ? `isbn:${clean(x.isbn)}` : `url:${x.sourceUrl}`, x])).values()];
  const results = options.import === false ? [] : await importRecords(deduped, options);
  return { pages: crawled.pages, discovered: crawled.candidates.length, normalized: deduped.length, imported: results.length, results, preview: deduped.slice(0, 100) };
}

module.exports = { scanAndImport, crawlLibrary, aiNormalize };