const { URL } = require('url');
const { enrichMany } = require('./ai-book.service');

const DEFAULT_HEADERS = {
  'User-Agent': 'ElectronicLibrarySmartImporter/1.1 (+admin-controlled-library-import)',
  Accept: 'text/html,application/xhtml+xml'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanText(value = '') {
  return decodeHtml(String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
  const a = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i');
  const b = new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`, 'i');
  return decodeHtml((html.match(a) || html.match(b) || [])[1] || '');
}

function attr(html, tag, name) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  return decodeHtml((html.match(re) || [])[1] || '');
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) return cleanText(m[1]);
  }
  return '';
}

function extractLinks(html, pageUrl) {
  const links = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = absoluteUrl(m[1], pageUrl);
    if (href) links.push({ url: href, text: cleanText(m[2]) });
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
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k => u.searchParams.delete(k));
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

function hasBookSignals(html, pageUrl, links = []) {
  if (isClearlyNonBookPage(pageUrl)) return { score: -100, signals: [] };
  const text = cleanText(html).toLowerCase();
  const url = pageUrl.toLowerCase();
  const title = meta(html, 'og:title') || firstMatch(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]);
  const signals = [];
  let score = 0;

  if (/\/ar\/book(?:\/|-)/i.test(url) || /\/book\//i.test(url)) { score += 5; signals.push('book-url'); }
  if (/تحميل كتاب|تنزيل كتاب|قراءة كتاب|كتاب pdf/i.test(title)) { score += 4; signals.push('book-title'); }
  if (/المؤلف|الكاتب|author/i.test(text)) { score += 2; signals.push('author'); }
  if (/عدد الصفحات|الصفحات|pages/i.test(text)) { score += 2; signals.push('pages'); }
  if (/isbn/i.test(text)) { score += 2; signals.push('isbn'); }
  if (links.some(x => /\.pdf(?:$|[?#])/i.test(x.url) || /تحميل.*pdf|pdf.*تحميل/i.test(x.text))) { score += 3; signals.push('pdf'); }
  if (/(نبذة عن الكتاب|عن الكتاب|وصف الكتاب|ملخص الكتاب)/i.test(text)) { score += 2; signals.push('description'); }
  if (/إضافة إلى المفضلة|اقرأ|تحميل الكتاب/i.test(text)) { score += 2; signals.push('book-actions'); }
  if (/تسجيل الدخول|إنشاء حساب|تبرع|انشر معنا|التصنيفات|المؤلفون|اقتباسات|نتائج البحث/i.test(text)) { score -= 5; signals.push('site-page'); }
  if (!isArabic(`${title} ${text.slice(0, 2500)}`)) score -= 4;

  return { score, signals };
}

function extractBookCandidate(html, pageUrl) {
  const links = extractLinks(html, pageUrl);
  const signalResult = hasBookSignals(html, pageUrl, links);
  if (signalResult.score < 6) return null;

  const title = meta(html, 'og:title') || firstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]);
  const description = meta(html, 'og:description') || meta(html, 'description') || firstMatch(html, [
    /(?:الوصف|نبذة عن الكتاب|عن الكتاب|وصف الكتاب|ملخص الكتاب)[^<]{0,80}<[^>]*>([\s\S]*?)<\//i
  ]);
  const author = firstMatch(html, [
    /(?:المؤلف|الكاتب)\s*[:：]?\s*(?:<[^>]+>)*([^<]{2,120})/i,
    /(?:author|writer)\s*[:：]?\s*(?:<[^>]+>)*([^<]{2,120})/i
  ]);
  const category = firstMatch(html, [
    /(?:التصنيف|القسم|الفئة)\s*[:：]?\s*(?:<[^>]+>)*([^<]{2,100})/i,
    /(?:category|genre)\s*[:：]?\s*(?:<[^>]+>)*([^<]{2,100})/i
  ]);
  const pages = firstMatch(html, [/(?:عدد الصفحات|الصفحات)\s*[:：]?\s*(?:<[^>]+>)*([0-9٠-٩]{1,5})/i]);
  const isbn = firstMatch(html, [/(?:ISBN|isbn)\s*[:：]?\s*(?:<[^>]+>)*([0-9Xx\- ]{8,20})/i]);
  const publishedYear = firstMatch(html, [/(?:سنة النشر|تاريخ النشر|النشر)\s*[:：]?\s*(?:<[^>]+>)*((?:19|20)[0-9٠-٩]{2})/i]);
  const cover = meta(html, 'og:image') || attr(html, 'img', 'src');
  const validCover = cover && !/foulabook\.com\/images\/foulabook\.jpg/i.test(cover) ? absoluteUrl(cover, pageUrl) : '';
  const pdfLink = links.find(x => /\.pdf(?:$|[?#])/i.test(x.url))?.url || links.find(x => /تحميل|download|pdf/i.test(x.text) && /pdf|download/i.test(x.url))?.url || '';
  const fullText = cleanText(html);
  const rights = /creative commons|المشاع الإبداعي|public domain|الملك العام|بإذن المؤلف|بإذن من المؤلف|explicit permission/i.test(fullText)
    ? 'explicit-permission-or-open-license'
    : 'unknown';

  if (!title || !isArabic(title) || !author || !isArabic(author)) return null;

  return {
    title: cleanText(title),
    author: cleanText(author),
    category: cleanText(category),
    description: cleanText(description),
    pages: cleanText(pages),
    isbn: cleanText(isbn),
    publishedYear: cleanText(publishedYear),
    language: 'العربية',
    coverImage: validCover,
    sourceUrl: normalizeUrl(pageUrl),
    sourceFileUrl: pdfLink,
    source: new URL(pageUrl).hostname,
    sourceId: normalizeUrl(pageUrl),
    rights,
    arabic: true,
    extraction: {
      score: signalResult.score,
      confidence: Math.max(0, Math.min(100, signalResult.score * 8)),
      signals: signalResult.signals
    }
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
  if (!sameOrigin(link.url, sourceUrl)) return false;
  if (isClearlyNonBookPage(link.url)) return false;
  const u = link.url.toLowerCase();
  const t = link.text || '';
  return /\/ar\/book(?:\/|-)|\/book\//i.test(u) || /تحميل كتاب|قراءة كتاب|تنزيل كتاب/i.test(t);
}

async function crawlSite(sourceUrl, options = {}) {
  const maxPages = Math.min(Number(options.maxPages || process.env.IMPORT_MAX_PAGES || 20), 100);
  const maxBooks = Math.min(Number(options.maxBooks || process.env.IMPORT_MAX_BOOKS || 50), 200);
  const delayMs = Math.max(Number(options.delayMs || 700), 300);
  const start = new URL(sourceUrl).href;
  const queue = [start];
  const visited = new Set();
  const bookUrls = new Set();
  const rawCandidates = [];

  while (queue.length && visited.size < maxPages && bookUrls.size < maxBooks) {
    const current = queue.shift();
    const normalized = normalizeUrl(current);
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    let html;
    try { html = await fetchPage(current); } catch { continue; }

    const candidate = extractBookCandidate(html, current);
    if (candidate && !bookUrls.has(candidate.sourceId)) {
      bookUrls.add(candidate.sourceId);
      rawCandidates.push(candidate);
    }

    for (const link of extractLinks(html, current)) {
      if (queue.length + visited.size >= maxPages * 2) break;
      if (looksLikeBookLink(link, start)) queue.push(link.url);
    }
    await sleep(delayMs);
  }

  const unique = Array.from(new Map(rawCandidates.map(x => [x.sourceId, x])).values()).slice(0, maxBooks);
  const enriched = await enrichMany(unique);
  const books = enriched
    .filter(x => x.arabic !== false && x.language !== 'غير عربي')
    .map(x => ({
      ...x,
      category: cleanText(x.category || '') || '',
      description: cleanText(x.description || ''),
      title: cleanText(x.title || ''),
      author: cleanText(x.author || ''),
      extraction: x.extraction || { score: 0, confidence: 0, signals: [] },
      ai: x.ai || { enabled: false, confidence: 0, notes: 'لم يتم تشغيل نموذج الذكاء الاصطناعي.' }
    }));

  return {
    sourceUrl: start,
    scannedPages: visited.size,
    discovered: books.length,
    books
  };
}

module.exports = { crawlSite, extractBookCandidate, isArabic, isClearlyNonBookPage };
