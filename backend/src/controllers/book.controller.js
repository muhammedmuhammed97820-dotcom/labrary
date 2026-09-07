const Book = require("../models/Book");
const BookView = require("../models/BookView");
const BookDownload = require("../models/BookDownload");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");
const { uploadBuffer, getFile, openDownloadStream, deleteFile } = require("../services/gridfs.service");

function canModerate(req) { return req.user?.role === "admin"; }

function serializeBook(book) {
  const value = typeof book.toObject === "function" ? book.toObject() : { ...book };
  const id = String(value._id);
  value.filePath = value.fileId ? `/api/books/${id}/read` : value.filePath || "";
  value.coverImage = value.coverImageId ? `/api/books/${id}/cover` : value.coverImage || "";
  return value;
}

function serializeBooks(books) { return books.map(serializeBook); }

async function getBooks(req, res) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 24;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const search = String(req.query.search || "").trim();

    const filter = { status: "approved" };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.author) filter.author = req.query.author;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { submittedAuthorName: { $regex: search, $options: "i" } },
        { submittedCategoryName: { $regex: search, $options: "i" } }
      ];
    }

    const [books, total] = await Promise.all([
      Book.find(filter)
        .populate("author")
        .populate("category")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Book.countDocuments(filter)
    ]);

    res.json({
      books: serializeBooks(books),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load books." });
  }
}

async function getAdminBooks(req, res) {
  try {
    const books = await Book.find({}).populate("author").populate("category").populate("submittedBy", "name email").sort({ createdAt: -1 });
    res.json(serializeBooks(books));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load admin books." }); }
}

async function getBook(req, res) {
  try {
    const book = await Book.findById(req.params.id).populate("author").populate("category").populate("submittedBy", "name email");
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.status !== "approved" && !canModerate(req) && String(book.submittedBy?._id) !== String(req.user?._id)) return res.status(404).json({ message: "Book not found." });
    res.json(serializeBook(book));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load book." }); }
}

async function createBook(req, res) {
  let fileId = null;
  let coverImageId = null;
  try {
    const { title, author, category, description, publishedYear, rating } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Book title is required." });
    if (!String(author || "").trim()) return res.status(400).json({ message: "Author is required." });
    if (!String(category || "").trim()) return res.status(400).json({ message: "Category is required." });
    if (!req.files?.bookFile?.[0]) return res.status(400).json({ message: "Book file is required." });
    if (!req.files?.coverImage?.[0]) return res.status(400).json({ message: "Cover image is required." });
    if (!req.user) return res.status(401).json({ message: "Authentication required." });

    const bookFile = req.files.bookFile[0];
    const coverFile = req.files.coverImage[0];
    const isAdmin = canModerate(req);

    fileId = await uploadBuffer(bookFile.buffer, bookFile.originalname, bookFile.mimetype, { type: "book-file" }, "libraryBooks");
    coverImageId = await uploadBuffer(coverFile.buffer, coverFile.originalname, coverFile.mimetype, { type: "book-cover" }, "libraryCovers");

    let authorId = null;
    let categoryId = null;
    if (isAdmin) {
      authorId = (await findOrCreateAuthor(author.trim()))._id;
      categoryId = (await findOrCreateCategory(category.trim()))._id;
    }

    const book = await Book.create({
      title: title.trim(), author: authorId, category: categoryId,
      submittedAuthorName: isAdmin ? "" : author.trim(), submittedCategoryName: isAdmin ? "" : category.trim(),
      description: description || "", publishedYear: publishedYear ? Number(publishedYear) : undefined,
      rating: isAdmin && rating ? Number(rating) : 0, fileId, coverImageId, filePath: "", coverImage: "",
      status: isAdmin ? "approved" : "pending", submittedBy: req.user._id, rejectionReason: "", reviewedAt: isAdmin ? new Date() : null
    });

    const populatedBook = await Book.findById(book._id).populate("author").populate("category").populate("submittedBy", "name email");
    res.status(201).json({ message: isAdmin ? "Book created and published successfully." : "Book submitted successfully and is awaiting admin review.", book: serializeBook(populatedBook) });
  } catch (error) {
    if (fileId) { try { await deleteFile(fileId); } catch {} }
    if (coverImageId) { try { await deleteFile(coverImageId); } catch {} }
    console.error(error);
    res.status(500).json({ message: "Failed to create book." });
  }
}

module.exports = {
  getBooks,
  getAdminBooks,
  getBook,
  createBook,
};
