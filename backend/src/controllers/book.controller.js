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
    const filter = { status: "approved" };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.author) filter.author = req.query.author;
    const books = await Book.find(filter).populate("author").populate("category").sort({ createdAt: -1 });
    res.json(serializeBooks(books));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load books." }); }
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
    if (fileId) await deleteFile(fileId, "libraryBooks").catch(() => {});
    if (coverImageId) await deleteFile(coverImageId, "libraryCovers").catch(() => {});
    console.error(error); res.status(500).json({ message: error.message || "Failed to create book." });
  }
}

async function updateBook(req, res) {
  let newFileId = null;
  let newCoverImageId = null;
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!canModerate(req)) return res.status(403).json({ message: "Only administrators can edit published books." });

    const { title, author, category, description, publishedYear, rating, isAvailable } = req.body;
    const oldFileId = book.fileId;
    const oldCoverImageId = book.coverImageId;

    if (title) book.title = title.trim();
    if (author) book.author = (await findOrCreateAuthor(author.trim()))._id;
    if (category) book.category = (await findOrCreateCategory(category.trim()))._id;
    if (description !== undefined) book.description = description;
    if (publishedYear) book.publishedYear = Number(publishedYear);
    if (rating !== undefined) book.rating = Number(rating);
    if (isAvailable !== undefined) book.isAvailable = isAvailable === "true" || isAvailable === true;

    if (req.files?.bookFile?.[0]) {
      const file = req.files.bookFile[0];
      newFileId = await uploadBuffer(file.buffer, file.originalname, file.mimetype, { type: "book-file" }, "libraryBooks");
      book.fileId = newFileId;
      book.filePath = "";
    }
    if (req.files?.coverImage?.[0]) {
      const file = req.files.coverImage[0];
      newCoverImageId = await uploadBuffer(file.buffer, file.originalname, file.mimetype, { type: "book-cover" }, "libraryCovers");
      book.coverImageId = newCoverImageId;
      book.coverImage = "";
    }

    await book.save();
    if (newFileId && oldFileId) await deleteFile(oldFileId, "libraryBooks").catch(() => {});
    if (newCoverImageId && oldCoverImageId) await deleteFile(oldCoverImageId, "libraryCovers").catch(() => {});

    const populatedBook = await Book.findById(book._id).populate("author").populate("category").populate("submittedBy", "name email");
    res.json({ message: "Book updated successfully.", book: serializeBook(populatedBook) });
  } catch (error) {
    if (newFileId) await deleteFile(newFileId, "libraryBooks").catch(() => {});
    if (newCoverImageId) await deleteFile(newCoverImageId, "libraryCovers").catch(() => {});
    console.error(error); res.status(500).json({ message: error.message || "Failed to update book." });
  }
}

async function deleteBook(req, res) {
  try {
    if (!canModerate(req)) return res.status(403).json({ message: "Only administrators can delete books." });
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    await Promise.all([
      BookView.deleteMany({ book: book._id }),
      BookDownload.deleteMany({ book: book._id }),
      book.fileId ? deleteFile(book.fileId, "libraryBooks").catch(() => {}) : Promise.resolve(),
      book.coverImageId ? deleteFile(book.coverImageId, "libraryCovers").catch(() => {}) : Promise.resolve()
    ]);
    res.json({ message: "Book deleted successfully." });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to delete book." }); }
}

async function getMySubmissions(req, res) {
  try {
    const books = await Book.find({ submittedBy: req.user._id }).populate("author").populate("category").sort({ createdAt: -1 });
    res.json(serializeBooks(books));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load your submissions." }); }
}

async function getPendingBooks(req, res) {
  try {
    const books = await Book.find({ status: "pending" }).populate("author").populate("category").populate("submittedBy", "name email").sort({ createdAt: 1 });
    res.json(serializeBooks(books));
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load pending books." }); }
}

async function reviewBook(req, res) {
  try {
    const { status, rejectionReason = "" } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be approved or rejected." });
    if (status === "rejected" && !String(rejectionReason).trim()) return res.status(400).json({ message: "A rejection reason is required." });
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.status !== "pending") return res.status(400).json({ message: "Only pending books can be reviewed." });
    if (status === "approved") {
      if (!book.author || !book.category) {
        if (!book.submittedAuthorName?.trim() || !book.submittedCategoryName?.trim()) return res.status(400).json({ message: "The submitted author and category are missing." });
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
    const populatedBook = await Book.findById(book._id).populate("author").populate("category").populate("submittedBy", "name email");
    res.json({ message: status === "approved" ? "Book approved and published." : "Book rejected.", book: serializeBook(populatedBook) });
  } catch (error) { console.error(error); res.status(500).json({ message: error.message || "Failed to review book." }); }
}

async function incrementViews(req, res) {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("viewsCount");
    if (!book) return res.status(404).json({ message: "Book not found." });
    const viewerId = String(req.get("X-Viewer-Id") || "").trim();
    if (!viewerId || viewerId.length > 128) return res.status(400).json({ message: "A valid viewer identifier is required." });
    let counted = false;
    try { await BookView.create({ book: book._id, viewerId }); counted = true; } catch (error) { if (error?.code !== 11000) throw error; }
    if (counted) await Book.findByIdAndUpdate(book._id, { $inc: { viewsCount: 1 } });
    const latest = await Book.findById(book._id).select("viewsCount").lean();
    res.json({ viewsCount: latest?.viewsCount || 0, counted });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to update views." }); }
}

async function incrementDownloads(req, res) {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("downloads");
    if (!book) return res.status(404).json({ message: "Book not found." });
    const viewerId = String(req.get("X-Viewer-Id") || "").trim();
    if (!viewerId || viewerId.length > 128) return res.status(400).json({ message: "A valid viewer identifier is required." });
    let counted = false;
    try { await BookDownload.create({ book: book._id, viewerId }); counted = true; } catch (error) { if (error?.code !== 11000) throw error; }
    if (counted) await Book.findByIdAndUpdate(book._id, { $inc: { downloads: 1 } });
    const latest = await Book.findById(book._id).select("downloads").lean();
    res.json({ downloads: latest?.downloads || 0, counted });
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to update downloads." }); }
}

async function streamBookFile(req, res, mode = "read") {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("title fileId filePath");
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!book.fileId) return res.status(404).json({ message: "Book file not found on server." });

    const file = await getFile(book.fileId, "libraryBooks");
    if (!file) return res.status(404).json({ message: "Book file not found on server." });
    const contentType = file.contentType || "application/pdf";
    if (mode === "read" && contentType !== "application/pdf" && !String(file.filename).toLowerCase().endsWith(".pdf")) {
      return res.status(415).json({ message: "This reader currently supports PDF books only." });
    }

    const size = Number(file.length);
    const range = req.headers.range;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Type", contentType);

    if (mode === "download") {
      const safeTitle = String(book.title || "book").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "book";
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    } else {
      res.setHeader("Content-Disposition", "inline");
    }

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return res.status(416).set("Content-Range", `bytes */${size}`).end();
      let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
      let end = match[2] ? Number(match[2]) : size - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return res.status(416).set("Content-Range", `bytes */${size}`).end();
      end = Math.min(end, size - 1);
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      return openDownloadStream(book.fileId, "libraryBooks", { start, end: end + 1 }).pipe(res);
    }

    res.setHeader("Content-Length", size);
    return openDownloadStream(book.fileId, "libraryBooks").pipe(res);
  } catch (error) {
    console.error("Book GridFS stream error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Failed to serve book file." });
  }
}

async function streamBookCover(req, res) {
  try {
    const book = await Book.findOne({ _id: req.params.id, status: "approved" }).select("coverImageId coverImage");
    if (!book || !book.coverImageId) return res.status(404).json({ message: "Book cover not found." });
    const file = await getFile(book.coverImageId, "libraryCovers");
    if (!file) return res.status(404).json({ message: "Book cover not found." });
    res.setHeader("Content-Type", file.contentType || "image/jpeg");
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return openDownloadStream(book.coverImageId, "libraryCovers").pipe(res);
  } catch (error) { console.error(error); res.status(500).json({ message: "Failed to load book cover." }); }
}

module.exports = { getBooks, getAdminBooks, getBook, createBook, updateBook, deleteBook, getMySubmissions, getPendingBooks, reviewBook, incrementViews, incrementDownloads, streamBookFile, streamBookCover };
