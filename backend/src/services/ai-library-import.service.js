const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");
const { findBookCover, findAuthorImage } = require("./external-image.service");
const { analyzePage, fetchHtml } = require("./openai-library.service");
const { researchBook } = require("./openai-research.service");

const MAX_PAGES = 100;
const UA = "ElectronicLibrary OpenAI Importer/1.0";

const clean = (v = "") => String(v || "").replace(/\s+/g, " ").trim();
const absolute = (base, value) => {
  try { return new URL(String(value || ""), base).href; } catch { return ""; }
};
const validName = (v, max = 160) => {
  const n = clean(v);
  if (!n || n.length < 2 || n.length > max) return "";
  if (/^(تحميل|كتاب|pdf|المؤلف|الكاتب|التصنيف)$/iu.test(n)) return "";
  return n;
};

function allowedRights(html) {
  const s = clean(html).toLowerCase();
  if (/all rights reserved|جميع الحقوق محفوظة|كل الحقوق محفوظة/i.test(s)) return false;
  return /creative commons|public domain|permission|explicit permission|إذن صريح|ملكية عامة|المشاع الإبداعي|حقوق نشر مسموح/i.test(s);
}

async function saveAuthor(info, options) {
  const name = validName(info?.name, 160);
  if (!name) return null;
  let author = await Author.findOne({ name });
  if (!author) author = new Author({ name });
  if (clean(info.bio) && (!author.bio || author.bio.length < clean(info.bio).length)) author.bio = clean(info.bio);
  if (info.url && !author.website) author.website = absolute(info.url, info.url);

  if (options.externalImages && !author.imageId) {
    try {
      const image = await findAuthorImage(name);
      if (image?.buffer) {
        const id = await uploadBuffer(
          image.buffer,
          `${name.replace(/[^\p{L}\p{N}]+/gu, "-")}.jpg`,
          image.contentType || "image/jpeg",
          { provider: image.provider || "external-web", policy: "external-only" },
          "libraryAuthors"
        );
        author.imageId = id;
        author.image = image.url || "";
      }
    } catch {}
  }
  await author.save();
  return author;
}

async function saveCategory(info) {
  const name = validName(info?.name, 100);
  if (!name) return null;
  let category = await Category.findOne({ name });
  if (!category) category = new Category({ name });
  if (clean(info.description) && !category.description) category.description = clean(info.description);
  await category.save();
  return category;
}

async function saveExternalCover(book, title, authorName, isbn) {
  try {
    const image = await findBookCover(title, authorName, isbn);
    if (!image?.buffer) return false;
    const id = await uploadBuffer(
      image.buffer,
      `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.jpg`,
      image.contentType || "image/jpeg",
      { provider: image.provider || "external-web", policy: "external-only" },
      "libraryCovers"
    );
    book.coverImageId = id;
    book.coverImage = image.url || "";
    return true;
  } catch { return false; }
}

async function saveBook(item, context, options) {
  const title = validName(item.title, 300);
  if (!title) return { skipped: true, reason: "missing-title" };
  const sourceUrl = absolute(context.pageUrl, item.bookUrl || context.pageUrl);
  if (!sourceUrl) return { skipped: true, reason: "missing-source-url" };

  const author = await saveAuthor({ name: item.authorName, url: item.authorUrl, bio: item.authorBio }, options);
  const category = await saveCategory({ name: item.categoryName });

  let book = await Book.findOne({ source: "OPENAI", sourceUrl });
  const existed = Boolean(book);
  if (!book) book = new Book({ title, source: "OPENAI", sourceUrl });
  if (options.updateExisting || !existed) {
    book.title = title;
    if (author) book.author = author._id;
    if (category) book.category = category._id;
    if (clean(item.description)) book.description = clean(item.description);
    if (clean(item.language)) book.language = clean(item.language);
    const year = String(item.publishedYear || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1];
    if (year) book.publishedYear = Number(year);
    if (clean(item.isbn)) book.isbn = clean(item.isbn);
    book.status = "approved";
    book.isAvailable = false;
  }

  let coverSaved = false;
  if (options.externalImages && !book.coverImageId) {
    coverSaved = await saveExternalCover(book, title, author?.name || item.authorName, item.isbn);
  }

  let pdfSaved = false;
  if (options.downloadFiles && item.fileUrl) {
    try {
      const fileUrl = absolute(context.pageUrl, item.fileUrl);
      const sourcePage = await fetchHtml(context.pageUrl);
      if (allowedRights(sourcePage.html)) {
        const response = await fetch(fileUrl, {
          headers: { "user-agent": UA },
          redirect: "follow",
          signal: AbortSignal.timeout(30000)
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
            const id = await uploadBuffer(buffer, `${title}.pdf`, "application/pdf", { sourceUrl, rights: "verified" }, "libraryBooks");
            book.fileId = id;
            book.filePath = fileUrl;
            book.sourceFileUrl = fileUrl;
            book.rights = "verified";
            book.isAvailable = true;
            pdfSaved = true;
          }
        }
      }
    } catch {}
  }

  await book.save();
  return {
    skipped: false,
    existed,
    bookId: String(book._id),
    title: book.title,
    author: author?.name || "",
    category: category?.name || "",
    externalCover: coverSaved || Boolean(book.coverImageId),
    pdfImported: pdfSaved,
    researched: Boolean(item.researched),
    researchSources: item.researchSources || []
  };
}

function prioritize(urls, root) {
  const unique = [];
  const seen = new Set();
  for (const raw of urls || []) {
    const url = absolute(root, raw);
    if (!url || seen.has(url)) continue;
    try {
      if (new URL(url).origin !== new URL(root).origin) continue;
    } catch { continue; }
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

async function scanAndImportWithOpenAI(startUrl, options = {}) {
  const maxPages = Math.min(Math.max(Number(options.maxPages) || 30, 1), MAX_PAGES);
  const settings = {
    updateExisting: options.updateExisting === true,
    downloadFiles: options.downloadFiles === true,
    externalImages: options.externalImages !== false,
    externalResearch: options.externalResearch !== false
  };
  const queue = [startUrl];
  const queued = new Set(queue);
  const seen = new Set();
  const allBooks = new Map();
  const allAuthors = new Map();
  const allCategories = new Map();
  const errors = [];

  while (queue.length && seen.size < maxPages) {
    const pageUrl = queue.shift();
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);
    try {
      const page = await fetchHtml(pageUrl);
      const result = await analyzePage(page.finalUrl, page.html, { mode: "automatic" });

      for (const book of result.books || []) {
        const key = absolute(page.finalUrl, book.bookUrl) || `${clean(book.title)}|${clean(book.authorName)}`;
        if (key) allBooks.set(key, { ...book, bookUrl: absolute(page.finalUrl, book.bookUrl || page.finalUrl), pageUrl: page.finalUrl });
      }
      for (const author of result.authors || []) {
        const key = clean(author.name).toLowerCase();
        if (key) allAuthors.set(key, author);
      }
      for (const category of result.categories || []) {
        const key = clean(category.name).toLowerCase();
        if (key) allCategories.set(key, category);
      }

      const next = prioritize([...(result.nextUrls || []), ...(result.books || []).map(x => x.bookUrl), ...(result.authors || []).map(x => x.url), ...(result.categories || []).map(x => x.url)], page.finalUrl);
      for (const url of next) {
        if (!queued.has(url) && !seen.has(url) && queue.length + seen.size < maxPages * 2) {
          queued.add(url);
          queue.push(url);
        }
      }
    } catch (error) {
      errors.push({ url: pageUrl, error: error?.message || "page analysis failed" });
    }
  }

  const researchedBooks = [];
  if (settings.externalResearch) {
    for (const item of allBooks.values()) {
      try {
        researchedBooks.push(await researchBook(item));
      } catch (error) {
        errors.push({ url: item.bookUrl || item.pageUrl, error: `البحث الخارجي: ${error?.message || "فشل البحث"}` });
        researchedBooks.push(item);
      }
    }
  } else {
    researchedBooks.push(...allBooks.values());
  }

  const imported = [];
  if (options.import !== false) {
    for (const item of researchedBooks) {
      try {
        imported.push(await saveBook(item, { pageUrl: item.pageUrl }, settings));
      } catch (error) {
        imported.push({ skipped: true, title: item.title || "", reason: error?.message || "save failed" });
      }
    }
  }

  return {
    engine: "OpenAI",
    model: process.env.OPENAI_IMPORT_MODEL || "gpt-5.6-luna",
    startUrl,
    pages: seen.size,
    discovered: allBooks.size,
    normalized: researchedBooks.length,
    externallyResearched: researchedBooks.filter(x => x.researched).length,
    imported: imported.filter(x => !x.skipped).length,
    existing: imported.filter(x => x.existed).length,
    authorsDetected: allAuthors.size,
    categoriesDetected: allCategories.size,
    externalImages: settings.externalImages,
    externalResearch: settings.externalResearch,
    pdfPolicy: "rights-evidence-required",
    errors,
    books: imported
  };
}

module.exports = { scanAndImportWithOpenAI };
