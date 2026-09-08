const mongoose = require('mongoose');
const Quote = require('../models/Quote');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const THRESHOLD = 15;
const populateUser = { path: 'user', select: 'name email avatar' };
const validId = id => mongoose.Types.ObjectId.isValid(id);
const modelFor = type => type === 'quote' ? Quote : Comment;

function withLikeState(item, userId) {
  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const liked = !!userId && likedBy.some(id => String(id) === String(userId));
  const result = { ...item, likesCount: Number(item.likesCount || likedBy.length || 0), liked };
  delete result.likedBy;
  return result;
}

async function listQuotes(req, res, next) {
  try {
    const items = await Quote.find({ status: 'visible' }).select('+likedBy').populate(populateUser).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 100)).lean();
    res.json(items.map(item => withLikeState(item, req.user?._id)));
  } catch (e) { next(e); }
}

async function createQuote(req, res, next) {
  try {
    const { text } = req.body || {};
    if (!String(text || '').trim()) return res.status(400).json({ message: 'نص الاقتباس مطلوب.' });
    const q = await Quote.create({ user: req.user._id, text: String(text).trim() });
    const item = await Quote.findById(q._id).populate(populateUser).lean();
    res.status(201).json({ ...item, likesCount: 0, liked: false });
  } catch (e) { next(e); }
}

async function updateQuote(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'الاقتباس غير صحيح.' });
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'نص الاقتباس مطلوب.' });
    const quote = await Quote.findOne({ _id: req.params.id, user: req.user._id });
    if (!quote) return res.status(404).json({ message: 'الاقتباس غير موجود أو لا تملك صلاحية تعديله.' });
    if (quote.status === 'rejected') return res.status(400).json({ message: 'لا يمكن تعديل اقتباس مرفوض.' });
    quote.text = text;
    quote.status = 'visible';
    quote.reviewedAt = null;
    quote.rejectionReason = '';
    quote.reportCount = 0;
    await quote.save();
    const item = await Quote.findById(quote._id).select('+likedBy').populate(populateUser).lean();
    res.json(withLikeState(item, req.user._id));
  } catch (e) { next(e); }
}

async function deleteQuote(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'الاقتباس غير صحيح.' });
    const quote = await Quote.findOne({ _id: req.params.id, user: req.user._id });
    if (!quote) return res.status(404).json({ message: 'الاقتباس غير موجود أو لا تملك صلاحية حذفه.' });
    await Report.deleteMany({ quote: quote._id });
    await Quote.deleteOne({ _id: quote._id });
    res.json({ message: 'تم حذف الاقتباس.' });
  } catch (e) { next(e); }
}

async function listComments(req, res, next) {
  try {
    if (!validId(req.query.book)) return res.status(400).json({ message: 'معرّف الكتاب غير صحيح.' });
    const filter = { status: 'visible', book: req.query.book };
    if (req.query.quote && validId(req.query.quote)) filter.quote = req.query.quote;
    const items = await Comment.find(filter).select('+likedBy').populate(populateUser).sort({ createdAt: 1 }).lean();
    res.json(items.map(item => withLikeState(item, req.user?._id)));
  } catch (e) { next(e); }
}

async function createComment(req, res, next) {
  try {
    const { book, quote, parent, text } = req.body || {};
    if (!validId(book) || !String(text || '').trim()) return res.status(400).json({ message: 'الكتاب ونص التعليق مطلوبان.' });
    const Book = require('../models/Book');
    if (!(await Book.exists({ _id: book, status: 'approved' }))) return res.status(404).json({ message: 'الكتاب غير موجود.' });
    if (quote && (!validId(quote) || !(await Quote.exists({ _id: quote, status: 'visible' })))) return res.status(400).json({ message: 'الاقتباس غير صحيح.' });
    if (parent && (!validId(parent) || !(await Comment.exists({ _id: parent, book, status: 'visible' })))) return res.status(400).json({ message: 'التعليق الأب غير صحيح.' });
    const c = await Comment.create({ book, quote: quote || null, parent: parent || null, user: req.user._id, text: String(text).trim() });
    const item = await Comment.findById(c._id).populate(populateUser).lean();
    res.status(201).json({ ...item, likesCount: 0, liked: false });
  } catch (e) { next(e); }
}

async function toggleLike(req, res, next) {
  try {
    const { type, id } = req.params;
    if (!validId(id) || !['quote', 'comment'].includes(type)) return res.status(400).json({ message: 'بيانات الإعجاب غير صحيحة.' });
    const Model = modelFor(type);
    const target = await Model.findOne({ _id: id, status: 'visible' }).select('+likedBy');
    if (!target) return res.status(404).json({ message: 'المحتوى غير موجود.' });
    const userId = String(req.user._id);
    const likedBy = Array.isArray(target.likedBy) ? target.likedBy : [];
    const alreadyLiked = likedBy.some(id => String(id) === userId);
    if (alreadyLiked) await Model.updateOne({ _id: id }, { $pull: { likedBy: req.user._id } });
    else await Model.updateOne({ _id: id }, { $addToSet: { likedBy: req.user._id } });
    const updated = await Model.findById(id).select('+likedBy').lean();
    const count = Array.isArray(updated?.likedBy) ? updated.likedBy.length : 0;
    await Model.updateOne({ _id: id }, { $set: { likesCount: count } });
    res.json({ liked: !alreadyLiked, likesCount: count, message: alreadyLiked ? 'تم إلغاء الإعجاب.' : 'تم تسجيل الإعجاب.' });
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
    const reports = await Report.find({ status: 'pending' }).populate('reporter', 'name email avatar').populate({ path: 'quote', populate: [populateUser] }).populate({ path: 'comment', populate: [populateUser, { path: 'book', select: 'title' }] }).sort({ createdAt: -1 }).lean();
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

module.exports = { listQuotes, createQuote, updateQuote, deleteQuote, listComments, createComment, toggleLike, report, adminList, review, THRESHOLD };
