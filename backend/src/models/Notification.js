const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['book_approved', 'book_rejected', 'book_submitted', 'system'], default: 'system' },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  link: { type: String, trim: true, default: '' },
  read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
