const express = require("express");

const router =
  express.Router();

const controller =
  require("../controllers/author.controller");

router.get(
  "/",
  controller.getAuthors
);

router.post(
  "/",
  controller.createAuthor
);

module.exports = router;
