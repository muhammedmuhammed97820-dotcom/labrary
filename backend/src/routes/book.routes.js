const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/book.controller");
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
router.get("/:id/read", controller.streamBookFile);
router.get("/:id/download", controller.downloadBookFile || ((req, res) => controller.streamBookFile(req, res, "download")));
router.get("/:id/cover", controller.streamBookCover);
router.get("/:id", controller.getBook);
router.post("/", authenticate, bookUpload, controller.createBook);
router.put("/:id", authenticate, requireAdmin, bookUpload, controller.updateBook);
router.delete("/:id", authenticate, requireAdmin, controller.deleteBook);
router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;
