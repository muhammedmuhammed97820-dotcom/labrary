const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/author.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

router.get("/", controller.getAuthors);
router.get("/:id/image", controller.streamAuthorImage);
router.get("/:id", controller.getAuthor);
router.post("/", authenticate, requireAdmin, upload.single("avatar"), controller.createAuthor);
router.put("/:id", authenticate, requireAdmin, upload.single("avatar"), controller.updateAuthor);
router.delete("/:id", authenticate, requireAdmin, controller.deleteAuthor);

module.exports = router;
