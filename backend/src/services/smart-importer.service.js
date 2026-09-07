const { URL } = require('url');
const { enrichMany } = require('./ai-book.service');

const DEFAULT_HEADERS = {
  'User-Agent': 'ElectronicLibrarySmartImporter/2.1 (+admin-controlled-library-import)',
  Accept: 'text/html,application/xhtml+xml'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  let result = String(value);
  for (let i = 0; i < 3; i += 1) {
    const decoded = result
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
    if (decoded === result) break;
    result = decoded;
  }
  return result;
}

function cleanText(value = '') {
  let text = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  for (let i = 0; i < 3; i += 1) {
    text = decodeHtml(text).replace(/<[^>]+>/g, ' ');
  }
  return decodeHtml(text).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeField(value = '') {
  const text = cleanText(value).replace(/[|•]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 2) return '';
  if (/^(ات|ذات|غير معروف|غير محدد|لا يوجد|none|null|n\/a)$/i.test(text)) return '';
  return text;
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try { return new URL(value, base).href; } catch { return ''; }
}

function isArabic(value = '') {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return cleanText(match[1]);
  }
  return '';
}

function attr(html, tag, name) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  return cleanText((html.match(re) || [])[1] || '');
}

function extractLinks(html, pageUrl) {
  const links = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = absoluteUrl(decodeHtml(match[1]), pageUrl);
    if (href) links.push({ url: href, text: cleanText(match[2]) });
  }
  return links;
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

function normalizeUrl(value) {
  try {
    const u = new URL(value);
    u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid'].forEach(k => u.searchParams.delete(k));
    return u.href.replace(/\/$/, '');
  } catch { return value; }
}

const NON_BOOK_PATHS = [
  '/', '/our-mission', '/donate', '/search', '/books', '/authors', '/quotes',
  '/categories', '/tags', '/publish', '/contact', '/about', '/privacy', '/terms',
  '/login', '/register', '/favorites', '/profile'
];

function isClearlyNonBookPage(pageUrl) {
  try {
    const p = new URL(pageUrl).pathname.toLowerCase().replace(/\/$/, '') || '/';
    return NON_BOOK_PATHS.some(x => p === x || p.startsWith(`${x}/`));
  } catch { return true; }
}

function hasStrongRights(text = '') {
  const normalized = cleanText(text).toLowerCase();
  if (/حقوق الكتاب محفوظة|جميع الحقوق محفوظة|all rights reserved|جميع حقوق الطبع/.test(normalized)) return false;
  return /creative commons|المشاع الإبداعي|public domain|الملك العام|ترخيص مفتوح|ترخيص حر|مرخص بترخيص|رخصة المشاع|بإذن صريح من المؤلف|إذن رسمي من المؤلف|licensed under/i.test(normalized);
}

function extractLabeledValue(text, labels, maxLength = 160) {
  const label = labels.join('|');
  const re = new RegExp(`(?:^|\\s)(?:${label})(?![\\u0600-\\u06FF])\\s*[:：\\-]?\\s*([^|•]{2,${maxLength}})`, 'i');
  const match = text.match(re);
  return normalizeField(match?.[1] || '');
}

function cleanBookDescription(value = '', title = '', author = '') {
  let text = normalizeField(value);
  if (!text) return '';

  // Some Arabic book sites put the whole navigation menu inside og:description.
  // Keep the actual book section when a clear book-description marker exists.
  const startMarkers = ['تحميل كتاب', 'نبذة عن الكتاب', 'عن الكتاب', 'وصف الكتاب', 'ملخص الكتاب'];
  const startPositions = startMarkers.map(marker => text.indexOf(marker)).filter(position => position >= 0);
  if (startPositions.length) {
    text = text.slice(Math.min(...startPositions));
  }

  const stopPatterns = [
    /\s+هذا الكتاب من تأليف\s+/i,
    /\s+حقوق الكتاب محفوظة/i,
    /\s+جميع الحقوق محفوظة/i,
    /\s+التصنيفات\s+كل الكتب/i,
    /\s+صفحة المصدر\s*/i
  ];
  for (const pattern of stopPatterns) {
    text = text.replace(pattern, ' ');
  }

  text = text.replace(/^تحميل كتاب\s+/i, '').replace(/\s+pdf\s+الكاتب\s+/i, ' — ');
  text = text.replace(/\s+/g, ' ').trim();

  if (title) text = text.replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();
  if (author) text = text.replace(new RegExp(`^${author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();

  return text.length >= 30 ? text : normalizeField(value);
}

function extractTitle(html) {
  return normalizeField(meta(html, 'og:title')) || normalizeField((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) || normalizeField((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
}

function extractBookCandidate(html, pageUrl) {
  if (isClearlyNonBookPage(pageUrl)) return null;
  const links = extractLinks(html, pageUrl);
  const text = cleanText(html);
  const title = extractTitle(html);
  const author = extractLabeledValue(text, ['المؤلف','الكاتب','Author','Writer']);
  const category = extractLabeledValue(text, ['التصنيف','القسم','الفئة','Category','Genre'], 100);
  const rawDescription = meta(html, 'og:description') || meta(html, 'description');
  const description = cleanBookDescription(rawDescription, title, author);
  const pages = extractLabeledValue(text, ['عدد الصفحات','الصفحات','Pages'], 20).replace(/[^0-9٠-٩]/g, '');
  const isbn = extractLabeledValue(text, ['ISBN'], 30).replace(/[^0-9Xx\- ]/g, '').trim();
  const publishedYear = extractLabeledValue(text, ['سنة النشر','تاريخ النشر','سنة الإصدار','Published'], 30).match(/(?:19|20)[0-9٠-٩]{2}/)?.[0] || '';
  const cover = meta(html, 'og:image') || attr(html, 'img', 'src');
  const validCover = cover && !/foulabook\.com\/images\/foulabook\.jpg/i.test(cover) ? absoluteUrl(cover, pageUrl) : '';
  const pdfLink = links.find(x => /\.pdf(?:$|[?#])/i.test(x.url))?.url || links.find(x => /تحميل|download|pdf/i.test(x.text) && /pdf|download/i.test(x.url))?.url || '';

  const url = pageUrl.toLowerCase();
  const signals = [];
  let score = 0;
  if (/\/ar\/book(?:\/|-)|\/book\//i.test(url)) { score += 5; signals.push('book-url'); }
  if (/تحميل كتاب|تنزيل كتاب|قراءة كتاب|كتاب pdf/i.test(title)) { score += 4; signals.push('book-title'); }
  if (author) { score += 2; signals.push('author'); }
  if (pages) { score += 1; signals.push('pages'); }
  if (isbn) { score += 1; signals.push('isbn'); }
  if (pdfLink) { score += 2; signals.push('pdf'); }
  if (/نبذة عن الكتاب|عن الكتاب|وصف الكتاب|ملخص الكتاب/i.test(text)) { score += 2; signals.push('description'); }
  if (/إضافة إلى المفضلة|اقرأ|تحميل الكتاب/i.test(text)) { score += 2; signals.push('book-actions'); }
  if (!isArabic(`${title} ${author} ${text.slice(0, 1800)}`)) score -= 3;
  if (score < 5 || !title || !author || !isArabic(title) || !isArabic(author)) return null;

  return {
    title,
    author,
    category,
    description,
    pages,
    isbn,
    publishedYear,
    language: 'العربية',
    coverImage: validCover,
    sourceUrl: normalizeUrl(pageUrl),
    sourceFileUrl: pdfLink,
    source: new URL(pageUrl).hostname,
    sourceId: normalizeUrl(pageUrl),
    rights: hasStrongRights(text) ? 'explicit-permission-or-open-license' : 'unknown',
    arabic: true,
    extraction: { score, confidence: Math.max(0, Math.min(100, 45 + score * 7)), signals },
    rawText: text.slice(0, 12000)
  };
}

async function fetchPage(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error(`Not an HTML page: ${url}`);
  return response.text();
}

function looksLikeBookLink(link, sourceUrl) {
  if (!sameOrigin(link.url, sourceUrl) || isClearlyNonBookPage(link.url)) return false;
  const u = link.url.toLowerCase();
  return /\/ar\/book(?:\/|-)|\/book\//i.test(u) || /تحميل كتاب|قراءة كتاب|تنزيل كتاب/i.test(link.text || '');
}

function looksLikeNavigationLink(link, sourceUrl) {
  if (!sameOrigin(link.url, sourceUrl)) return false;
  if (looksLikeBookLink(link, sourceUrl)) return false;
  try {
    const path = new URL(link.url).pathname.toLowerCase();
    const query = new URL(link.url).search.toLowerCase();
    const text = (link.text || '').toLowerCase();
    if (isClearlyNonBookPage(link.url) && path !== '/') return false;
    return /page=|paged=|\/page\/|\bnext\b|\bmore\b|التالي|المزيد|كتب|book|category|categories|search|tag/i.test(`${path} ${query} ${text}`);
  } catch { return false; }
}

async function crawlSite(sourceUrl, options = {}) {
  const maxPages = Math.min(Number(options.maxPages || process.env.IMPORT_MAX_PAGES || 40), 150);
  const maxBooks = Math.min(Number(options.maxBooks || process.env.IMPORT_MAX_BOOKS || 50), 200);
  const delayMs = Math.max(Number(options.delayMs || 500), 250);
  const start = new URL(sourceUrl).href;
  const queue = [{ url: start, depth: 0 }];
  const visited = new Set();
  const bookUrls = new Set();
  const rawCandidates = [];

  while (queue.length && visited.size < maxPages && bookUrls.size < maxBooks) {
    const item = queue.shift();
    const current = normalizeUrl(item.url);
    if (visited.has(current)) continue;
    visited.add(current);

    let html;
    try { html = await fetchPage(current); } catch { continue; }

    const candidate = extractBookCandidate(html, current);
    if (candidate && !bookUrls.has(candidate.sourceId)) {
      bookUrls.add(candidate.sourceId);
      rawCandidates.push(candidate);
    }

    for (const link of extractLinks(html, current)) {
      if (visited.size + queue.length >= maxPages * 2) break;
      const normalized = normalizeUrl(link.url);
      if (visited.has(normalized)) continue;
      if (looksLikeBookLink(link, start) || (item.depth < 4 && looksLikeNavigationLink(link, start))) {
        queue.push({ url: normalized, depth: item.depth + 1 });
      }
    }
    await sleep(delayMs);
  }

  const unique = Array.from(new Map(rawCandidates.map(x => [x.sourceId, x])).values()).slice(0, maxBooks);
  const enriched = await enrichMany(unique);
  const books = enriched
    .filter(x => x.arabic !== false && x.language !== 'غير عربي')
    .map(x => {
      const merged = { ...x };
      merged.title = normalizeField(merged.title);
      merged.author = normalizeField(merged.author);
      merged.category = normalizeField(merged.category);
      merged.description = cleanBookDescription(merged.description, merged.title, merged.author);
      merged.pages = normalizeField(merged.pages).replace(/[^0-9٠-٩]/g, '');
      merged.isbn = normalizeField(merged.isbn);
      merged.publishedYear = normalizeField(merged.publishedYear);
      merged.rights = hasStrongRights(`${merged.rights || ''} ${merged.rawText || ''}`) ? 'explicit-permission-or-open-license' : 'unknown';
      merged.extraction = merged.extraction || { score: 0, confidence: 0, signals: [] };
      merged.ai = merged.ai || { enabled: false, confidence: 0, notes: 'لم يتم تشغيل نموذج الذكاء الاصطناعي.' };
      delete merged.rawText;
      return merged;
    });

  return { sourceUrl: start, scannedPages: visited.size, discovered: books.length, books };
}

module.exports = { crawlSite, extractBookCandidate, isArabic, isClearlyNonBookPage, cleanText };
