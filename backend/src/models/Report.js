const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['quote', 'comment'], required: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null, index: true },
  reason: { type: String, enum: ['abuse', 'spam', 'misinformation', 'copyright', 'other'], default: 'other' },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'dismissed', 'actioned'], default: 'pending', index: true }
}, { timestamps: true });
reportSchema.index({ reporter: 1, quote: 1 }, { unique: true, sparse: true });
reportSchema.index({ reporter: 1, comment: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Report', reportSchema);
