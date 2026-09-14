const mongoose = require('mongoose');
const commentSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  likesCount: { type: Number, default: 0, min: 0 },
  likedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], select: false },
  reportCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['visible', 'flagged', 'rejected'], default: 'visible', index: true },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.model('Comment', commentSchema);
