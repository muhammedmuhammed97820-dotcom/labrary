const Book = require("../models/Book");
const { getFile, openDownloadStream } = require("../services/gridfs.service");

/**
 * Book covers are intentionally public, including pending submissions.
 * The PDF/file endpoint remains protected by book status.
 * This is necessary because browser <img> requests do not carry the
 * Angular Authorization header automatically.
 */
async function streamBookCover(req, res) {
  try {
    const book = await Book.findById(req.params.id).select("coverImageId");
    if (!book || !book.coverImageId) {
      return res.status(404).json({ message: "Book cover not found." });
    }

    const file = await getFile(book.coverImageId, "libraryCovers");
    if (!file) {
      return res.status(404).json({ message: "Book cover not found." });
    }

    res.setHeader("Content-Type", file.contentType || "image/jpeg");
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return openDownloadStream(book.coverImageId, "libraryCovers").pipe(res);
  } catch (error) {
    console.error("Book cover stream error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to load book cover." });
    }
  }
}

module.exports = { streamBookCover };
