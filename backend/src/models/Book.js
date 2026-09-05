const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // Published books use these references. Pending submissions keep them empty
    // until an administrator approves the submission.
    author: { type: mongoose.Schema.Types.ObjectId, ref: "Author", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    // Temporary values submitted by users. They are never inserted into the
    // public Author/Category collections while the book is pending/rejected.
    submittedAuthorName: { type: String, trim: true, default: "" },
    submittedCategoryName: { type: String, trim: true, default: "" },

    description: { type: String, default: "" },
    publishedYear: { type: Number },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isAvailable: { type: Boolean, default: true },
    filePath: { type: String, required: true },
    coverImage: { type: String, required: true },
    viewsCount: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
