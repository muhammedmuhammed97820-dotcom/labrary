const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
      required: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    description: {
      type: String,
      default: ""
    },

    publishedYear: {
      type: Number
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    isAvailable: {
      type: Boolean,
      default: true
    },

    filePath: {
      type: String,
      required: true
    },

    coverImage: {
      type: String,
      required: true
    },

    viewsCount: {
      type: Number,
      default: 0
    },

    downloads: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Book", bookSchema);
