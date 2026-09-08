const mongoose = require('mongoose');
const Quote = require('../models/Quote');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Book = require('../models/Book');
const THRESHOLD = 15;
const populateUser = { path: 'user', select: 'name email avatar' };
const validId = id => mongoose.Types.ObjectId.isValid(id);
const modelFor = type => type === 'quote' ? Quote : Comment;

async function listQuotes(req, res, next) {
  try {
    const filter = { status: 'visible' };
    if (req.query.book && validId(req.query.book)) filter.book = req.query.book;
    res.json(await Quote.find(filter).populate(populateUser).populate('book', 'title').sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 100)).lean());
  } catch (e) { next(e); }
}
async function createQuote(req, res, next) {
  try {
    const { book, text, page } = req.body || {};
    if (!validId(book) || !String(text || '').trim()) return res.status(400).json({ message: 'الكتاب ونص الاقتباس مطلوبان.' });
    if (!(await Book.exists({ _id: book, status: 'approved' }))) return res.status(404).json({ message: 'الكتاب غير موجود.' });
    const q = await Quote.create({ book, user: req.user._id, text: String(text).trim(), page: page ? Number(page) : null });
    res.status(201).json(await Quote.findById(q._id).populate(populateUser).populate('book', 'title').lean());
  } catch (e) { next(e); }
}
async function listComments(req, res, next) {
  try {
    if (!validId(req.query.book)) return res.status(400).json({ message: 'معرّف الكتاب غير صحيح.' });
    const filter = { status: 'visible', book: req.query.book };
    if (req.query.quote && validId(req.query.quote)) filter.quote = req.query.quote;
    res.json(await Comment.find(filter).populate(populateUser).sort({ createdAt: 1 }).lean());
  } catch (e) { next(e); }
}
async function createComment(req, res, next) {
  try {
    const { book, quote, parent, text } = req.body || {};
    if (!validId(book) || !String(text || '').trim()) return res.status(400).json({ message: 'الكتاب ونص التعليق مطلوبان.' });
    if (!(await Book.exists({ _id: book, status: 'approved' }))) return res.status(404).json({ message: 'الكتاب غير موجود.' });
    if (quote && (!validId(quote) || !(await Quote.exists({ _id: quote, book, status: 'visible' })))) return res.status(400).json({ message: 'الاقتباس غير صحيح.' });
    if (parent && (!validId(parent) || !(await Comment.exists({ _id: parent, book, status: 'visible' })))) return res.status(400).json({ message: 'التعليق الأب غير صحيح.' });
    const c = await Comment.create({ book, quote: quote || null, parent: parent || null, user: req.user._id, text: String(text).trim() });
    res.status(201).json(await Comment.findById(c._id).populate(populateUser).lean());
  } catch (e) { next(e); }
}
async function report(req, res, next) {
  try {
    const { type, id, reason = 'other', note = '' } = req.body || {};
    if (!validId(id) || !['quote', 'comment'].includes(type)) return res.status(400).json({ message: 'بيانات البلاغ غير صحيحة.' });
    const Model = modelFor(type);
    const target = await Model.findOne({ _id: id, status: { $in: ['visible', 'flagged'] } });
    if (!target) return res.status(404).json({ message: 'المحتوى غير موجود.' });
    const unique = type === 'quote' ? { reporter: req.user._id, quote: id } : { reporter: req.user._id, comment: id };
    try { await Report.create({ ...unique, targetType: type, reason, note: String(note).trim() }); }
    catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'لقد أبلغت عن هذا المحتوى مسبقاً.' }); throw e; }
    const count = await Report.countDocuments(type === 'quote' ? { quote: id, status: 'pending' } : { comment: id, status: 'pending' });
    target.reportCount = count;
    if (count >= THRESHOLD) target.status = 'flagged';
    await target.save();
    res.status(201).json({ message: count >= THRESHOLD ? 'وصل المحتوى إلى 15 بلاغاً وتم إخفاؤه مؤقتاً.' : 'تم إرسال البلاغ للإدارة للمراجعة.', reportCount: count, flagged: count >= THRESHOLD });
  } catch (e) { next(e); }
}
async function adminList(req, res, next) {
  try {
    const reports = await Report.find({ status: 'pending' }).populate('reporter', 'name email avatar').populate({ path: 'quote', populate: [populateUser, { path: 'book', select: 'title' }] }).populate({ path: 'comment', populate: [populateUser, { path: 'book', select: 'title' }] }).sort({ createdAt: -1 }).lean();
    const groups = new Map();
    for (const r of reports) {
      const item = r.targetType === 'quote' ? r.quote : r.comment;
      if (!item?._id) continue;
      const key = `${r.targetType}:${item._id}`;
      if (!groups.has(key)) groups.set(key, { type: r.targetType, item, reports: [] });
      groups.get(key).reports.push({ _id: r._id, reason: r.reason, note: r.note, reporter: r.reporter, createdAt: r.createdAt });
    }
    res.json({ items: [...groups.values()].sort((a, b) => b.reports.length - a.reports.length), total: reports.length, threshold: THRESHOLD });
  } catch (e) { next(e); }
}
async function review(req, res, next) {
  try {
    const { type, id } = req.params;
    const { action, reason = '' } = req.body || {};
    if (!validId(id) || !['quote', 'comment'].includes(type) || !['restore', 'reject'].includes(action)) return res.status(400).json({ message: 'بيانات المراجعة غير صحيحة.' });
    const target = await modelFor(type).findById(id);
    if (!target) return res.status(404).json({ message: 'المحتوى غير موجود.' });
    target.status = action === 'restore' ? 'visible' : 'rejected';
    target.reviewedAt = new Date(); target.rejectionReason = action === 'reject' ? String(reason).trim() : ''; target.reportCount = 0;
    await target.save();
    await Report.updateMany(type === 'quote' ? { quote: id, status: 'pending' } : { comment: id, status: 'pending' }, { $set: { status: action === 'restore' ? 'dismissed' : 'actioned' } });
    res.json({ message: action === 'restore' ? 'تمت إعادة المحتوى.' : 'تم إخفاء المحتوى.', item: target });
  } catch (e) { next(e); }
}
module.exports = { listQuotes, createQuote, listComments, createComment, report, adminList, review, THRESHOLD };
