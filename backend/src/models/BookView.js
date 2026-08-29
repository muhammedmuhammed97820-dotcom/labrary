const mongoose = require("mongoose");

const bookViewSchema = new mongoose.Schema(
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

// One view per browser/client for each book.
bookViewSchema.index({ book: 1, viewerId: 1 }, { unique: true });

module.exports = mongoose.model("BookView", bookViewSchema);
