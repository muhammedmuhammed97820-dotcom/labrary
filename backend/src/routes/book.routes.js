const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/book.controller");

const bookUpload = upload.fields([
  { name: "bookFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 }
]);

// Routes
router.get("/", controller.getBooks);
router.get("/:id", controller.getBook);
router.post("/", bookUpload, controller.createBook);
router.put("/:id", bookUpload, controller.updateBook);
router.delete("/:id", controller.deleteBook);

router.post("/:id/views", controller.incrementViews);
router.post("/:id/downloads", controller.incrementDownloads);

module.exports = router;