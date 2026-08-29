const express = require("express");
const router = express.Router();
const controller = require("../controllers/category.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

router.get("/", controller.getCategories);
router.get("/:id", controller.getCategory);
router.post("/", authenticate, requireAdmin, controller.createCategory);
router.put("/:id", authenticate, requireAdmin, controller.updateCategory);
router.delete("/:id", authenticate, requireAdmin, controller.deleteCategory);

module.exports = router;
