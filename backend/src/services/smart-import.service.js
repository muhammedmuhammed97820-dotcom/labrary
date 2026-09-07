const Book = require("../models/Book");
const Author = require("../models/Author");
const Category = require("../models/Category");
const { uploadBuffer } = require("./gridfs.service");

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_MODEL = process.env.AI_IMPORT_MODEL || "gpt-5.6-luna";

function clean(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function absolute(base, href) {
  try { return new URL(href, base).href; } catch { return ""; }
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

function htmlText(html) {
  return clean(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&"));
}

function extractLinks(html, pageUrl) {
  const out = [];
  const re = /<(?:a|link|img|source)\b[^>]*(?:href|src)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absolute(pageUrl, m[1]);
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  return clean(html.match(re)?.[1] || "");
}

function extractJsonLd(html) {
  const result = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      result.push(...values);
      if (parsed?.['@graph']) result.push(...parsed['@graph']);
    } catch (_) {}
  }
  return result;
}

function extractCandidate(pageUrl, html) {
  const links = extractLinks(html, pageUrl);
  const json = extractJsonLd(html);
  const books = json.filter((x) => x && (x['@type'] === 'Book' || String(x['@type'] || '').includes('Book')));
  const book = books[0] || {};
  const author = typeof book.author === 'string' ? book.author : book.author?.name;
  const image = typeof book.image === 'string' ? book.image : book.image?.url;
  const pdf = links.find((x) => /\.pdf(?:$|[?#])/i.test(x));
  const title = clean(book.name || extractMeta(html, 'og:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const cover = absolute(pageUrl, image || extractMeta(html, 'og:image'));
  return {
    title,
    author: clean(author || extractMeta(html, 'author')),
    description: clean(book.description || extractMeta(html, 'description')),
    publishedYear: Number.parseInt(String(book.datePublished || '').slice(0, 4), 10) || undefined,
    isbn: clean(book.isbn),
    coverUrl: cover,
    pdfUrl: pdf || clean(book.url),
    sourceUrl: pageUrl,
    rawText: htmlText(html).slice(0, 7000)
  };
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ElectronicLibrary Smart Importer/1.0', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml|application\/xml|text\/xml/i.test(type)) return null;
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_PAGE_BYTES) throw new Error('الصفحة أكبر من الحد المسموح.');
  return await response.text();
}

async function crawlLibrary(rootUrl, maxPages = 30) {
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
      const candidate = extractCandidate(url, html);
      if (candidate.title || candidate.pdfUrl || candidate.coverUrl) candidates.push(candidate);
      for (const link of extractLinks(html, url)) {
        if (sameOrigin(start, link) && !visited.has(link) && !/\.(?:jpg|jpeg|png|webp|gif|css|js|zip)$/i.test(link)) queue.push(link);
      }
    } catch (_) {}
  }
  return { pages: visited.size, candidates };
}

async function aiNormalize(candidates) {
  const fallback = candidates.map((c) => ({
    ...c,
    title: clean(c.title),
    authorName: clean(c.author) || 'مؤلف غير معروف',
    categoryName: 'غير مصنف',
    language: /[\u0600-\u06ff]/u.test(c.title || '') ? 'ar' : '',
    rights: '',
    subjects: []
  }));
  if (!process.env.OPENAI_API_KEY || !candidates.length) return fallback;

  const prompt = `أنت محرك فهرسة لمكتبة إلكترونية. نظّم السجلات التالية دون اختراع معلومات. يجب أن يكون الناتج JSON array فقط. لكل سجل استخدم الحقول: title, authorName, categoryName, description, publishedYear, language, isbn, subjects, rights, sourceUrl, pdfUrl, coverUrl. حافظ على أسماء الحقول كما هي. categoryName يجب أن يكون تصنيفاً مختصراً ومفيداً مثل روايات، أدب، شعر، تاريخ، فلسفة، علوم، دين، أطفال. إذا لم تعرف القيمة استخدم نصاً فارغاً. لا تغيّر الروابط. لا تدّعي أن PDF قانوني إلا إذا كان المصدر يذكر ذلك صراحة. السجلات:\n${JSON.stringify(candidates.slice(0, 20))}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: DEFAULT_MODEL, input: prompt })
  });
  if (!response.ok) throw new Error(`AI API HTTP ${response.status}`);
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((x) => x.content || []).map((x) => x.text || '').join('') || '';
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start < 0 || end < start) return fallback;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed.map((x, i) => ({ ...fallback[i], ...x })) : fallback;
  } catch (_) { return fallback; }
}

async function downloadAsset(url, kind) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'ElectronicLibrary Smart Importer/1.0', Accept: kind === 'pdf' ? 'application/pdf,*/*' : 'image/*,*/*' } });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') || '';
  if (kind === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-' && !/application\/pdf/i.test(type)) return null;
  if (kind === 'cover' && !/^image\//i.test(type) && !/^(\x89PNG|RIFF)/.test(buffer.subarray(0, 4).toString('binary')) && buffer.subarray(0, 3).toString('hex') !== 'ffd8ff') return null;
  return { buffer, contentType: type || (kind === 'pdf' ? 'application/pdf' : 'image/jpeg') };
}

async function upsertAuthor(data) {
  const name = clean(data.authorName) || 'مؤلف غير معروف';
  let author = await Author.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, $options: 'i' } });
  if (!author) author = await Author.create({ name, bio: clean(data.authorBio), nationality: clean(data.nationality), occupation: clean(data.occupation), website: clean(data.authorWebsite) });
  return author;
}

async function upsertCategory(name) {
  const cleanName = clean(name) || 'غير مصنف';
  let category = await Category.findOne({ name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, $options: 'i' } });
  if (!category) category = await Category.create({ name: cleanName });
  return category;
}

async function importBooks(records, options = {}) {
  const results = [];
  for (const record of records) {
    const title = clean(record.title);
    if (!title) continue;
    const author = await upsertAuthor(record);
    const category = await upsertCategory(record.categoryName);
    const sourceUrl = clean(record.sourceUrl);
    const sourceId = sourceUrl || `${title}|${author.name}`;
    const existing = await Book.findOne({ source: 'SMART', sourceId });
    if (existing && !options.updateExisting) { results.push({ title, status: 'موجود مسبقاً', bookId: existing._id }); continue; }

    const bookData = {
      title,
      author: author._id,
      category: category._id,
      submittedAuthorName: author.name,
      submittedCategoryName: category.name,
      description: clean(record.description),
      publishedYear: Number.isFinite(Number(record.publishedYear)) ? Number(record.publishedYear) : undefined,
      language: clean(record.language),
      isbn: clean(record.isbn),
      subjects: Array.isArray(record.subjects) ? record.subjects.map(clean).filter(Boolean) : [],
      source: 'SMART',
      sourceId,
      sourceUrl,
      sourceFileUrl: clean(record.pdfUrl),
      sourceProvider: new URL(sourceUrl).hostname,
      rights: clean(record.rights),
      status: 'approved',
      isAvailable: false
    };

    const canDownload = options.downloadFiles && /public domain|public-domain|cc0|creative commons|open access|open license|free to use|ملك عام|المجال العام|مشاع/i.test(bookData.rights);
    if (canDownload) {
      const pdf = await downloadAsset(record.pdfUrl, 'pdf').catch(() => null);
      if (pdf) { bookData.fileId = await uploadBuffer(pdf.buffer, `${title.replace(/[^\p{L}\p{N}]+/gu, '_')}.pdf`, pdf.contentType, { source: sourceUrl }, 'libraryBooks'); bookData.filePath = ''; bookData.isAvailable = true; }
      const cover = await downloadAsset(record.coverUrl, 'cover').catch(() => null);
      if (cover) bookData.coverImageId = await uploadBuffer(cover.buffer, `${title.replace(/[^\p{L}\p{N}]+/gu, '_')}.jpg`, cover.contentType, { source: sourceUrl }, 'libraryCovers');
    }

    const book = existing ? await Book.findByIdAndUpdate(existing._id, bookData, { new: true }) : await Book.create(bookData);
    results.push({ title, status: existing ? 'تم التحديث' : 'تمت الإضافة', bookId: book._id, pdf: Boolean(book.fileId), cover: Boolean(book.coverImageId) });
  }
  return results;
}

async function scanAndImport(url, options = {}) {
  const crawled = await crawlLibrary(url, Math.min(Math.max(Number(options.maxPages) || 30, 1), 200));
  const normalized = [];
  for (let i = 0; i < crawled.candidates.length; i += 20) normalized.push(...await aiNormalize(crawled.candidates.slice(i, i + 20)));
  const deduped = [...new Map(normalized.filter((x) => clean(x.title)).map((x) => [`${clean(x.title).toLowerCase()}|${clean(x.authorName).toLowerCase()}`, x])).values()];
  const results = options.import === false ? [] : await importBooks(deduped, options);
  return { pages: crawled.pages, discovered: crawled.candidates.length, normalized: deduped.length, imported: results.length, results, preview: deduped.slice(0, 100) };
}

module.exports = { scanAndImport, crawlLibrary, aiNormalize };
