const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "Author", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    submittedAuthorName: { type: String, trim: true, default: "" },
    submittedCategoryName: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    publishedYear: { type: Number },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isAvailable: { type: Boolean, default: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    coverImageId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    filePath: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    viewsCount: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved", index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },

    // External catalog/import provenance.
    source: { type: String, trim: true, default: "" },
    sourceId: { type: String, trim: true, default: "", index: true },
    sourceUrl: { type: String, trim: true, default: "" },
    sourceProvider: { type: String, trim: true, default: "" },
    rights: { type: String, trim: true, default: "" },
    isbn: { type: String, trim: true, default: "" },
    subjects: { type: [String], default: [] }
  },
  { timestamps: true }
);

bookSchema.index({ source: 1, sourceId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Book", bookSchema);
