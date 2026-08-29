const Category = require("../models/Category");
const Book = require("../models/Book");

async function getCategories(req, res) {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    const counts = await Book.aggregate([
      { $group: { _id: "$category", booksCount: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(item => [String(item._id), item.booksCount]));
    res.json(categories.map(category => ({ ...category, booksCount: countMap.get(String(category._id)) || 0 })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load categories." });
  }
}

async function getCategory(req, res) {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) return res.status(404).json({ message: "Category not found." });
    const books = await Book.find({ category: category._id })
      .populate("author")
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ...category, booksCount: books.length, books });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load category." });
  }
}

async function createCategory(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required." });
    const existing = await Category.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    if (existing) return res.status(200).json({ message: "Category already exists.", category: existing });
    const category = await Category.create({ name, description: req.body.description || "" });
    res.status(201).json({ message: "Category created.", category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create category." });
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { getCategories, getCategory, createCategory };
