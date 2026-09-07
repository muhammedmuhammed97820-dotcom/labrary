const Book = require("../models/Book");
const BookView = require("../models/BookView");
const BookDownload = require("../models/BookDownload");
const { deleteFile } = require("../services/gridfs.service");

/**
 * Allows the owner of a rejected submission to remove it from "My Submissions".
 * Pending and approved submissions are intentionally protected from user deletion.
 */
async function deleteMyRejectedSubmission(req, res) {
  try {
    const book = await Book.findOne({
      _id: req.params.id,
      submittedBy: req.user._id,
      status: "rejected"
    });

    if (!book) {
      return res.status(404).json({
        message: "Rejected submission not found or cannot be deleted."
      });
    }

    await Book.findByIdAndDelete(book._id);

    await Promise.all([
      BookView.deleteMany({ book: book._id }),
      BookDownload.deleteMany({ book: book._id }),
      book.fileId ? deleteFile(book.fileId, "libraryBooks").catch(() => {}) : Promise.resolve(),
      book.coverImageId ? deleteFile(book.coverImageId, "libraryCovers").catch(() => {}) : Promise.resolve()
    ]);

    return res.json({
      message: "Rejected submission deleted successfully."
    });
  } catch (error) {
    console.error("Delete rejected submission error:", error);
    return res.status(500).json({
      message: "Failed to delete rejected submission."
    });
  }
}

module.exports = { deleteMyRejectedSubmission };
