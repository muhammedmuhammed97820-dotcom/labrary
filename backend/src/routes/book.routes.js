const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/book.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");
const fs = require("fs");
const path = require("path");
const Book = require("../models/Book");

const bookUpload = upload.fields([
  { name: "bookFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 }
]);

router.get("/", controller.getBooks);
router.get("/admin/all", authenticate, requireAdmin, controller.getAdminBooks);
router.get("/my-submissions", authenticate, controller.getMySubmissions);
router.get("/admin/pending", authenticate, requireAdmin, controller.getPendingBooks);
router.patch("/admin/:id/review", authenticate, requireAdmin, controller.reviewBook);

// Serve an approved PDF as a real file download.
// IMPORTANT: resolve the directory exactly like upload.middleware.js so the
// result does not depend on the directory from which Node was started.
router.get("/:id/download", async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("title filePath");
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!book.filePath) return res.status(404).json({ message: "Book file not found on server." });

    const filename = path.basename(book.filePath);
    const booksDir = path.resolve(process.env.UPLOAD_BOOKS_DIR || "uploads/books");
    const filePath = path.join(booksDir, filename);

    if (!fs.existsSync(filePath)) {
      console.error("Book file missing:", {
        bookId: book._id.toString(),
        filePath,
        storedFilePath: book.filePath
      });
      return res.status(404).json({ message: "Book file not found on server." });
    }

    const safeTitle = String(book.title || "book")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .trim() || "book";

    return res.download(filePath, `${safeTitle}.pdf`, (error) => {
      if (error && !res.headersSent) {
        console.error("Book download error:", error);
        res.status(500).json({ message: "Failed to download book." });
      }
    });
  } catch (error) {
    console.error("Book download endpoint error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Failed to download book." });
  }
});

router.get("/:id", controller.getBook);
router.post("/", authenticate, bookUpload, controller.createBook);
router.put("/:id", authenticate, requireAdmin, bookUpload, controller.updateBook);
router.delete("/:id", authenticate, requireAdmin, controller.deleteBook);
router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;
