const Author = require("../models/Author");
const Book = require("../models/Book");

async function getAuthors(req, res) {
  try {
    const authors = await Author.find().sort({ name: 1 }).lean();
    const counts = await Book.aggregate([
      { $group: { _id: "$author", booksCount: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(item => [String(item._id), item.booksCount]));
    res.json(authors.map(author => ({ ...author, booksCount: countMap.get(String(author._id)) || 0 })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load authors." });
  }
}

async function getAuthor(req, res) {
  try {
    const author = await Author.findById(req.params.id).lean();
    if (!author) return res.status(404).json({ message: "Author not found." });

    const books = await Book.find({ author: author._id })
      .populate("author")
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ...author, booksCount: books.length, books });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load author." });
  }
}

async function createAuthor(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Author name is required." });

    const existing = await Author.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    if (existing) return res.status(200).json({ message: "Author already exists.", author: existing });

    const image = req.file ? `/uploads/avatars/${req.file.filename}` : String(req.body.image || "").trim();
    const author = await Author.create({
      name,
      bio: req.body.bio || "",
      image,
      birthDate: req.body.birthDate || undefined,
      deathDate: req.body.deathDate || undefined,
      birthPlace: req.body.birthPlace || "",
      nationality: req.body.nationality || "",
      occupation: req.body.occupation || "",
      website: req.body.website || ""
    });

    res.status(201).json({ message: "Author created.", author });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to create author." });
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { getAuthors, getAuthor, createAuthor };
