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
router.get("/:id", authenticate, controller.getBook);

// Authenticated users may submit books. Admin submissions are published immediately.
router.post("/", authenticate, bookUpload, controller.createBook);

// User submission tracking.
router.get("/my-submissions", authenticate, controller.getMySubmissions);

// Admin moderation queue.
router.get("/admin/pending", authenticate, requireAdmin, controller.getPendingBooks);
router.patch("/admin/:id/review", authenticate, requireAdmin, controller.reviewBook);

// Only admins can edit/delete catalog books.
router.put("/:id", authenticate, requireAdmin, bookUpload, controller.updateBook);
router.delete("/:id", authenticate, requireAdmin, controller.deleteBook);

router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;