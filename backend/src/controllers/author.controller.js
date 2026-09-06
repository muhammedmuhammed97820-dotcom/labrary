const Author = require("../models/Author");
const Book = require("../models/Book");
const { uploadBuffer, getFile, openDownloadStream, deleteFile } = require("../services/gridfs.service");

function imageUrl(author) {
  return author.imageId ? `/api/authors/${author._id}/image` : author.image || "";
}

function serializeAuthor(author) {
  if (!author) return author;
  return { ...author, image: imageUrl(author) };
}

async function getAuthors(req, res) {
  try {
    const authors = await Author.find().sort({ name: 1 }).lean();
    const counts = await Book.aggregate([{ $match: { status: "approved" } }, { $group: { _id: "$author", booksCount: { $sum: 1 } } }]);
    const countMap = new Map(counts.map(item => [String(item._id), item.booksCount]));
    res.json(authors.map(author => ({ ...serializeAuthor(author), booksCount: countMap.get(String(author._id)) || 0 })));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load authors." }); }
}

async function getAuthor(req, res) {
  try {
    const author = await Author.findById(req.params.id).lean();
    if (!author) return res.status(404).json({ message: "Author not found." });
    const books = await Book.find({ author: author._id, status: "approved" }).populate("author").populate("category").sort({ createdAt: -1 }).lean();
    res.json({ ...serializeAuthor(author), booksCount: books.length, books });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load author." }); }
}

async function streamAuthorImage(req, res) {
  try {
    const author = await Author.findById(req.params.id).select("imageId image").lean();
    if (!author) return res.status(404).json({ message: "Author not found." });
    if (!author.imageId) return res.status(404).json({ message: "Author image not found." });
    const file = await getFile(author.imageId, "libraryAuthors");
    if (!file) return res.status(404).json({ message: "Author image not found." });
    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return openDownloadStream(author.imageId, "libraryAuthors").pipe(res);
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load author image." }); }
}

function authorPayload(req) {
  return {
    name: String(req.body.name || "").trim(), bio: req.body.bio || "",
    birthDate: req.body.birthDate || undefined, deathDate: req.body.deathDate || undefined,
    birthPlace: req.body.birthPlace || "", nationality: req.body.nationality || "", occupation: req.body.occupation || "", website: req.body.website || ""
  };
}

async function createAuthor(req, res) {
  let imageId = null;
  try {
    const data = authorPayload(req);
    if (!data.name) return res.status(400).json({ message: "Author name is required." });
    const existing = await Author.findOne({ name: { $regex: `^${escapeRegex(data.name)}$`, $options: "i" } });
    if (existing) return res.status(409).json({ message: "Author already exists." });
    if (req.file) imageId = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, { type: "author-image" }, "libraryAuthors");
    const author = await Author.create({ ...data, imageId, image: "" });
    res.status(201).json({ message: "Author created.", author: serializeAuthor(author.toObject()) });
  } catch (error) {
    if (imageId) await deleteFile(imageId, "libraryAuthors").catch(() => {});
    console.error(error); res.status(500).json({ message: error.message || "Failed to create author." });
  }
}

async function updateAuthor(req, res) {
  let newImageId = null;
  try {
    const data = authorPayload(req);
    if (!data.name) return res.status(400).json({ message: "Author name is required." });
    const author = await Author.findById(req.params.id);
    if (!author) return res.status(404).json({ message: "Author not found." });
    const duplicate = await Author.findOne({ name: { $regex: `^${escapeRegex(data.name)}$`, $options: "i" }, _id: { $ne: req.params.id } });
    if (duplicate) return res.status(409).json({ message: "Another author has this name." });
    Object.assign(author, data);
    const oldImageId = author.imageId;
    if (req.file) {
      newImageId = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, { type: "author-image" }, "libraryAuthors");
      author.imageId = newImageId;
      author.image = "";
    }
    await author.save();
    if (newImageId && oldImageId) await deleteFile(oldImageId, "libraryAuthors").catch(() => {});
    res.json({ message: "Author updated.", author: serializeAuthor(author.toObject()) });
  } catch (error) {
    if (newImageId) await deleteFile(newImageId, "libraryAuthors").catch(() => {});
    console.error(error); res.status(500).json({ message: error.message || "Failed to update author." });
  }
}

async function deleteAuthor(req, res) {
  try {
    const used = await Book.exists({ author: req.params.id });
    if (used) return res.status(409).json({ message: "Cannot delete an author who has books. Reassign or delete the books first." });
    const author = await Author.findByIdAndDelete(req.params.id);
    if (!author) return res.status(404).json({ message: "Author not found." });
    if (author.imageId) await deleteFile(author.imageId, "libraryAuthors").catch(() => {});
    res.json({ message: "Author deleted." });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to delete author." }); }
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
module.exports = { getAuthors, getAuthor, streamAuthorImage, createAuthor, updateAuthor, deleteAuthor };
