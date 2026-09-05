const mongoose = require("mongoose");

const bookDownloadSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true
    },
    viewerId: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// One counted download per browser/client for each book.
bookDownloadSchema.index({ book: 1, viewerId: 1 }, { unique: true });

module.exports = mongoose.model("BookDownload", bookDownloadSchema);
