const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/book.controller");
const coverController = require("../controllers/cover.controller");
const submissionController = require("../controllers/submission.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

const bookUpload = upload.fields([
  { name: "bookFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 }
]);

router.get("/", controller.getBooks);
router.get("/admin/all", authenticate, requireAdmin, controller.getAdminBooks);
router.get("/my-submissions", authenticate, controller.getMySubmissions);
router.get("/admin/pending", authenticate, requireAdmin, controller.getPendingBooks);
router.patch("/admin/:id/review", authenticate, requireAdmin, controller.reviewBook);
router.delete("/:id/my-rejected-submission", authenticate, submissionController.deleteMyRejectedSubmission);

// Imported public-domain books can stay remote at ACO instead of consuming
// hundreds of gigabytes in local GridFS. Locally uploaded books still stream
// through the existing protected GridFS controller.
async function streamBookOrRemote(req, res, next, mode = "read") {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("fileId filePath").lean();
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!book.fileId && /^https:\/\/mc\.dlib\.nyu\.edu\/files\/books\//i.test(String(book.filePath || ""))) {
      return res.redirect(book.filePath);
    }
    return controller.streamBookFile(req, res, mode);
  } catch (error) {
    return next(error);
  }
}

router.get("/:id/read", (req, res, next) => streamBookOrRemote(req, res, next, "read"));
router.get("/:id/download", (req, res, next) => streamBookOrRemote(req, res, next, "download"));
router.get("/:id/cover", coverController.streamBookCover);
router.get("/:id", controller.getBook);
router.post("/", authenticate, bookUpload, controller.createBook);
router.put("/:id", authenticate, requireAdmin, bookUpload, controller.updateBook);
router.delete("/:id", authenticate, requireAdmin, controller.deleteBook);
router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;
