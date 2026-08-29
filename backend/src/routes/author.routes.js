const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
const controller = require("../controllers/author.controller");

router.get("/", controller.getAuthors);
router.get("/:id", controller.getAuthor);
router.post("/", upload.single("avatar"), controller.createAuthor);

module.exports = router;
