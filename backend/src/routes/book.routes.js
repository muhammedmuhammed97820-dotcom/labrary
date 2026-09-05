const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/book.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

const bookUpload = upload.fields([
  { name: "bookFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 }
]);

// Public catalog: controller only returns approved books.
router.get("/", controller.getBooks);

// Admin dashboard: returns all books, including pending/rejected submissions.
router.get("/admin/all", authenticate, requireAdmin, controller.getAdminBooks);

// User submission tracking and admin moderation queue must come before /:id.
router.get("/my-submissions", authenticate, controller.getMySubmissions);
router.get("/admin/pending", authenticate, requireAdmin, controller.getPendingBooks);
router.patch("/admin/:id/review", authenticate, requireAdmin, controller.reviewBook);

// Book details are public for approved books. Pending/rejected books remain protected by controller rules.
router.get("/:id", controller.getBook);

// Authenticated users may submit books. Admin submissions are published immediately.
router.post("/", authenticate, bookUpload, controller.createBook);

// Only admins can edit/delete catalog books.
router.put("/:id", authenticate, requireAdmin, bookUpload, controller.updateBook);
router.delete("/:id", authenticate, requireAdmin, controller.deleteBook);

// View counting is intentionally public and identified by the browser's anonymous viewer ID.
router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;
