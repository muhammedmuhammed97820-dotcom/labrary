const { URL } = require('url');
const { enrichMany } = require('./ai-book.service');

const DEFAULT_HEADERS = {
  'User-Agent': 'ElectronicLibrarySmartImporter/1.0 (+admin-controlled-library-import)',
  Accept: 'text/html,application/xhtml+xml'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanText(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try { return new URL(value, base).href; } catch { return ''; }
}

function isArabic(value = '') {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
}

function attr(html, tag, name) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function meta(html, name) {
  const re = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  return decodeHtml((html.match(re) || html.match(reverse) || [])[1] || '');
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return cleanText(m[1]);
  }
  return '';
}

function extractLinks(html, pageUrl) {
  const links = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = absoluteUrl(m[1], pageUrl);
    if (!href) continue;
    links.push({ url: href, text: cleanText(m[2]) });
  }
  return links;
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

function looksLikeBookLink(link, sourceUrl) {
  const u = link.url.toLowerCase();
  const t = link.text || '';
  if (!sameOrigin(u, sourceUrl)) return false;
  if (!isArabic(t) && !/book|books|pdf|\/(?:ar|book)\//i.test(u)) return false;
  if (/\/login|\/register|\/contact|\/about|\/privacy|\/terms|#/.test(u)) return false;
  return true;
}

function extractBookCandidate(html, pageUrl) {
  const title = meta(html, 'og:title') || firstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]);
  const description = meta(html, 'og:description') || meta(html, 'description') || firstMatch(html, [
    /(?:الوصف|نبذة عن الكتاب|عن الكتاب)[^<]{0,80}<[^>]*>([\s\S]*?)<\//i
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
  const links = extractLinks(html, pageUrl);
  const pdfLink = links.find(x => /\.pdf(?:$|[?#])/i.test(x.url))?.url || links.find(x => /تحميل|download|pdf/i.test(x.text) && /pdf|download/i.test(x.url))?.url || '';
  const fullText = cleanText(html);
  const rights = /creative commons|المشاع الإبداعي|public domain|الملك العام|domain public|بإذن المؤلف|بإذن من المؤلف|permission/i.test(fullText)
    ? 'explicit-permission-or-open-license'
    : 'unknown';

  if (!title || !isArabic(`${title} ${author}`)) return null;
  return {
    title: cleanText(title),
    author: cleanText(author),
    category: cleanText(category),
    description: cleanText(description),
    pages: cleanText(pages),
    isbn: cleanText(isbn),
    publishedYear: cleanText(publishedYear),
    language: 'العربية',
    coverImage: absoluteUrl(cover, pageUrl),
    sourceUrl: pageUrl,
    sourceFileUrl: pdfLink,
    source: new URL(pageUrl).hostname,
    sourceId: pageUrl,
    rights,
    arabic: true
  };
}

async function fetchPage(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error(`Not an HTML page: ${url}`);
  return response.text();
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
    if (visited.has(current)) continue;
    visited.add(current);
    let html;
    try { html = await fetchPage(current); } catch { continue; }

    const candidate = extractBookCandidate(html, current);
    if (candidate && !bookUrls.has(current)) {
      bookUrls.add(current);
      rawCandidates.push(candidate);
    }

    for (const link of extractLinks(html, current)) {
      if (!sameOrigin(link.url, start)) continue;
      if (looksLikeBookLink(link, start) && bookUrls.size + rawCandidates.length < maxBooks * 2) {
        queue.push(link.url);
      } else if (/page=\d+|\/page\/\d+|\?p=\d+|\?page=\d+/i.test(link.url) || /التالي|next|صفحة/i.test(link.text)) {
        queue.push(link.url);
      }
    }
    await sleep(delayMs);
  }

  const unique = Array.from(new Map(rawCandidates.map(x => [x.sourceUrl, x])).values()).slice(0, maxBooks);
  const enriched = await enrichMany(unique);
  return {
    sourceUrl: start,
    scannedPages: visited.size,
    discovered: unique.length,
    books: enriched.filter(x => x.arabic !== false && x.language !== 'غير عربي')
  };
}

module.exports = { crawlSite, extractBookCandidate, isArabic };
