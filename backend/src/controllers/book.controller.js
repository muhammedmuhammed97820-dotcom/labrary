const Book = require("../models/Book");
const BookView = require("../models/BookView");
const { findOrCreateAuthor, findOrCreateCategory } = require("../services/book.service");

function canModerate(req) {
  return req.user?.role === "admin";
}

async function getBooks(req, res) {
  try {
    const filter = { status: "approved" };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.author) filter.author = req.query.author;

    const books = await Book.find(filter)
      .populate("author")
      .populate("category")
      .sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load books." });
  }
}

async function getAdminBooks(req, res) {
  try {
    const books = await Book.find({})
      .populate("author")
      .populate("category")
      .populate("submittedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.error("Admin books load error:", error);
    res.status(500).json({ message: "Failed to load admin books." });
  }
}

async function getBook(req, res) {
  try {
    const book = await Book.findById(req.params.id)
      .populate("author")
      .populate("category")
      .populate("submittedBy", "name email");
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.status !== "approved" && !canModerate(req) && String(book.submittedBy?._id) !== String(req.user?._id)) {
      return res.status(404).json({ message: "Book not found." });
    }
    res.json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load book." });
  }
}

async function createBook(req, res) {
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

    let authorId = null;
    let categoryId = null;

    if (isAdmin) {
      authorId = (await findOrCreateAuthor(author.trim()))._id;
      categoryId = (await findOrCreateCategory(category.trim()))._id;
    }

    const book = await Book.create({
      title: title.trim(),
      author: authorId,
      category: categoryId,
      submittedAuthorName: isAdmin ? "" : author.trim(),
      submittedCategoryName: isAdmin ? "" : category.trim(),
      description: description || "",
      publishedYear: publishedYear ? Number(publishedYear) : undefined,
      rating: isAdmin && rating ? Number(rating) : 0,
      filePath: `/uploads/books/${bookFile.filename}`,
      coverImage: `/uploads/covers/${coverFile.filename}`,
      status: isAdmin ? "approved" : "pending",
      submittedBy: req.user._id,
      rejectionReason: "",
      reviewedAt: isAdmin ? new Date() : null
    });

    const populatedBook = await Book.findById(book._id)
      .populate("author")
      .populate("category")
      .populate("submittedBy", "name email");

    res.status(201).json({
      message: isAdmin ? "Book created and published successfully." : "Book submitted successfully and is awaiting admin review.",
      book: populatedBook
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to create book." });
  }
}

async function updateBook(req, res) {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!canModerate(req)) return res.status(403).json({ message: "Only administrators can edit published books." });

    const { title, author, category, description, publishedYear, rating, isAvailable } = req.body;
    if (title) book.title = title.trim();
    if (author) book.author = (await findOrCreateAuthor(author))._id;
    if (category) book.category = (await findOrCreateCategory(category))._id;
    if (description !== undefined) book.description = description;
    if (publishedYear) book.publishedYear = Number(publishedYear);
    if (rating !== undefined) book.rating = Number(rating);
    if (isAvailable !== undefined) book.isAvailable = isAvailable === "true" || isAvailable === true;
    if (req.files?.bookFile?.[0]) book.filePath = `/uploads/books/${req.files.bookFile[0].filename}`;
    if (req.files?.coverImage?.[0]) book.coverImage = `/uploads/covers/${req.files.coverImage[0].filename}`;
    await book.save();
    const populatedBook = await Book.findById(book._id).populate("author").populate("category").populate("submittedBy", "name email");
    res.json({ message: "Book updated successfully.", book: populatedBook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to update book." });
  }
}

async function deleteBook(req, res) {
  try {
    if (!canModerate(req)) return res.status(403).json({ message: "Only administrators can delete books." });
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    await BookView.deleteMany({ book: book._id });
    res.json({ message: "Book deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete book." });
  }
}

async function getMySubmissions(req, res) {
  try {
    const books = await Book.find({ submittedBy: req.user._id })
      .populate("author")
      .populate("category")
      .sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load your submissions." });
  }
}

async function getPendingBooks(req, res) {
  try {
    const books = await Book.find({ status: "pending" })
      .populate("author")
      .populate("category")
      .populate("submittedBy", "name email")
      .sort({ createdAt: 1 });
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load pending books." });
  }
}

async function reviewBook(req, res) {
  try {
    const { status, rejectionReason = "" } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected." });
    }
    if (status === "rejected" && !String(rejectionReason).trim()) {
      return res.status(400).json({ message: "A rejection reason is required." });
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.status !== "pending") return res.status(400).json({ message: "Only pending books can be reviewed." });

    if (status === "approved") {
      if (book.author && book.category) {
        // Compatibility with submissions created by the old workflow.
      } else {
        if (!book.submittedAuthorName?.trim() || !book.submittedCategoryName?.trim()) {
          return res.status(400).json({ message: "The submitted author and category are missing." });
        }
        book.author = (await findOrCreateAuthor(book.submittedAuthorName.trim()))._id;
        book.category = (await findOrCreateCategory(book.submittedCategoryName.trim()))._id;
      }
      book.submittedAuthorName = "";
      book.submittedCategoryName = "";
    }

    book.status = status;
    book.reviewedAt = new Date();
    book.rejectionReason = status === "rejected" ? String(rejectionReason).trim() : "";
    await book.save();

    const populatedBook = await Book.findById(book._id)
      .populate("author")
      .populate("category")
      .populate("submittedBy", "name email");

    res.json({
      message: status === "approved" ? "Book approved and published." : "Book rejected.",
      book: populatedBook
    });
  } catch (error) {
    console.error("Review book error:", error);
    res.status(500).json({ message: error.message || "Failed to review book." });
  }
}

async function incrementViews(req, res) {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("viewsCount");
    if (!book) return res.status(404).json({ message: "Book not found." });
    const viewerId = String(req.get("X-Viewer-Id") || "").trim();
    if (!viewerId || viewerId.length > 128) return res.status(400).json({ message: "A valid viewer identifier is required." });
    let counted = false;
    try { await BookView.create({ book: book._id, viewerId }); counted = true; }
    catch (error) { if (error?.code !== 11000) throw error; }
    if (counted) await Book.findByIdAndUpdate(book._id, { $inc: { viewsCount: 1 } });
    const latest = await Book.findById(book._id).select("viewsCount").lean();
    res.json({ viewsCount: latest?.viewsCount || 0, counted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update views." });
  }
}

async function incrementDownloads(req, res) {
  try {
    const book = await Book.findOneAndUpdate({ _id: req.params.id, status: "approved" }, { $inc: { downloads: 1 } }, { new: true });
    if (!book) return res.status(404).json({ message: "Book not found." });
    res.json({ downloads: book.downloads });
  } catch (error) { res.status(500).json({ message: "Failed to update downloads." }); }
}

module.exports = {
  getBooks,
  getAdminBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getMySubmissions,
  getPendingBooks,
  reviewBook,
  incrementViews,
  incrementDownloads
};
