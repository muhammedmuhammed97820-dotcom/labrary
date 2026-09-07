const { URL } = require('url');
const Book = require('../models/Book');
const Author = require('../models/Author');
const Category = require('../models/Category');
const { crawlSite } = require('../services/smart-importer.service');
const { findOrCreateAuthor, findOrCreateCategory } = require('../services/book.service');
const { uploadBuffer } = require('../services/gridfs.service');

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F]/g, '').replace(/\s+/g, ' ').trim();
}

function isArabic(value = '') {
  return /[\u0600-\u06FF]/.test(value);
}

async function preview(req, res, next) {
  try {
    const { url, maxPages, maxBooks } = req.body || {};
    if (!url) return res.status(400).json({ message: 'رابط الموقع مطلوب.' });
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ message: 'الرابط يجب أن يكون HTTP أو HTTPS.' });

    const result = await crawlSite(parsed.href, { maxPages, maxBooks });
    const books = [];
    for (const candidate of result.books) {
      if (!isArabic(`${candidate.title} ${candidate.author}`)) continue;
      const duplicate = await Book.findOne({
        $or: [
          ...(candidate.sourceId ? [{ source: candidate.source, sourceId: candidate.sourceId }] : []),
          ...(candidate.isbn ? [{ isbn: candidate.isbn }] : []),
          ...(candidate.title && candidate.author ? [{ title: candidate.title, author: await Author.findOne({ name: candidate.author }).select('_id').lean() }] : [])
        ]
      }).select('_id title').lean();
      books.push({ ...candidate, duplicate: Boolean(duplicate), duplicateBookId: duplicate?._id || null });
    }

    return res.json({
      message: 'تم تحليل الموقع. لم يتم حفظ الكتب في قاعدة البيانات.',
      sourceUrl: result.sourceUrl,
      scannedPages: result.scannedPages,
      discovered: result.discovered,
      books
    });
  } catch (error) {
    next(error);
  }
}

async function downloadIfAllowed(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url, { headers: { 'User-Agent': 'ElectronicLibrarySmartImporter/1.0' } });
  if (!response.ok) return null;
  const type = response.headers.get('content-type') || '';
  const length = Number(response.headers.get('content-length') || 0);
  if (length && length > 60 * 1024 * 1024) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 60 * 1024 * 1024) return null;
  return { buffer, type: type || 'application/octet-stream' };
}

async function approveOne(candidate, userId, options = {}) {
  if (!candidate?.title || !candidate?.author) throw new Error('عنوان الكتاب والمؤلف مطلوبان.');
  if (!isArabic(`${candidate.title} ${candidate.author}`)) throw new Error('المستورد يقبل الكتب العربية فقط.');

  const existing = await Book.findOne({
    $or: [
      ...(candidate.source && candidate.sourceId ? [{ source: candidate.source, sourceId: candidate.sourceId }] : []),
      ...(candidate.isbn ? [{ isbn: candidate.isbn }] : []),
      { title: candidate.title, submittedAuthorName: candidate.author }
    ]
  });
  if (existing) return { skipped: true, reason: 'duplicate', book: existing };

  const author = await findOrCreateAuthor(candidate.author);
  const category = await findOrCreateCategory(candidate.category || 'كتب متنوعة');

  if (candidate.authorBio || candidate.authorImage) {
    const update = {};
    if (candidate.authorBio && !author.bio) update.bio = candidate.authorBio;
    if (candidate.authorImage && !author.image) update.image = candidate.authorImage;
    if (Object.keys(update).length) await Author.updateOne({ _id: author._id }, { $set: update });
  }

  let fileId = null;
  let filePath = candidate.sourceFileUrl || '';
  const rightsAllowLocal = /explicit-permission-or-open-license|public-domain|creative-commons|authorized/i.test(String(candidate.rights || ''));
  if (options.downloadPdf && rightsAllowLocal && candidate.sourceFileUrl) {
    const downloaded = await downloadIfAllowed(candidate.sourceFileUrl);
    if (downloaded) {
      fileId = await uploadBuffer(downloaded.buffer, `${normalize(candidate.title).slice(0, 120)}.pdf`, 'application/pdf', { sourceUrl: candidate.sourceFileUrl, imported: true }, 'libraryBooks');
      filePath = '';
    }
  }

  const book = await Book.create({
    title: candidate.title,
    author: author._id,
    category: category._id,
    description: candidate.description || '',
    publishedYear: Number(candidate.publishedYear) || undefined,
    pages: Number(candidate.pages) || undefined,
    language: 'العربية',
    isAvailable: true,
    fileId,
    filePath,
    coverImage: candidate.coverImage || '',
    status: 'approved',
    submittedBy: userId,
    reviewedAt: new Date(),
    source: candidate.source || '',
    sourceId: candidate.sourceId || candidate.sourceUrl || '',
    sourceUrl: candidate.sourceUrl || '',
    sourceFileUrl: candidate.sourceFileUrl || '',
    sourceProvider: candidate.source || '',
    rights: candidate.rights || 'unknown',
    isbn: candidate.isbn || ''
  });

  return { skipped: false, book };
}

async function approve(req, res, next) {
  try {
    const candidates = Array.isArray(req.body?.books) ? req.body.books : [];
    if (!candidates.length) return res.status(400).json({ message: 'لم يتم تحديد كتب للموافقة.' });
    if (candidates.length > 100) return res.status(400).json({ message: 'الحد الأقصى للموافقة في العملية الواحدة هو 100 كتاب.' });

    const results = [];
    for (const candidate of candidates) {
      try {
        results.push(await approveOne(candidate, req.user.id, { downloadPdf: Boolean(req.body.downloadPdf) }));
      } catch (error) {
        results.push({ skipped: true, reason: 'error', error: error.message, candidate });
      }
    }
    return res.json({ message: 'تمت معالجة الكتب المحددة.', results });
  } catch (error) {
    next(error);
  }
}

module.exports = { preview, approve };
