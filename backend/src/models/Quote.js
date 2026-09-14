const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 3000 },
  likesCount: { type: Number, default: 0, min: 0 },
  likedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], select: false },
  reportCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['visible', 'flagged', 'rejected'], default: 'visible', index: true },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);
