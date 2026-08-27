const Category = require("../models/Category");

async function getCategories(req, res) {

  try {

    const categories =
      await Category.find()
        .sort({ name: 1 });

    res.json(categories);

  } catch (error) {

    res.status(500).json({
      message: "Failed to load categories."
    });
  }
}

async function createCategory(req, res) {

  try {

    const name =
      String(req.body.name || "").trim();

    if (!name) {

      return res.status(400).json({
        message: "Category name is required."
      });
    }

    const existing =
      await Category.findOne({
        name: {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i"
        }
      });

    if (existing) {

      return res.status(200).json({
        message: "Category already exists.",
        category: existing
      });
    }

    const category =
      await Category.create({
        name,
        description:
          req.body.description || ""
      });

    res.status(201).json({
      message: "Category created.",
      category
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to create category."
    });
  }
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

module.exports = {
  getCategories,
  createCategory
};
