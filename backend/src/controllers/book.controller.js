const Book = require("../models/Book");
const {
  findOrCreateAuthor,
  findOrCreateCategory
} = require("../services/book.service");

async function getBooks(req, res) {

  try {

    const books =
      await Book.find()
        .populate("author")
        .populate("category")
        .sort({ createdAt: -1 });

    res.json(books);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to load books."
    });
  }
}

async function getBook(req, res) {

  try {

    const book =
      await Book.findById(req.params.id)
        .populate("author")
        .populate("category");

    if (!book) {

      return res.status(404).json({
        message: "Book not found."
      });
    }

    res.json(book);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to load book."
    });
  }
}

async function createBook(req, res) {

  try {

    const {
      title,
      author,
      category,
      description,
      publishedYear,
      rating
    } = req.body;

    if (!title) {

      return res.status(400).json({
        message: "Book title is required."
      });
    }

    if (!author) {

      return res.status(400).json({
        message: "Author is required."
      });
    }

    if (!category) {

      return res.status(400).json({
        message: "Category is required."
      });
    }

    if (!req.files?.bookFile?.[0]) {

      return res.status(400).json({
        message: "Book file is required."
      });
    }

    if (!req.files?.coverImage?.[0]) {

      return res.status(400).json({
        message: "Cover image is required."
      });
    }

    const authorDocument =
      await findOrCreateAuthor(author);

    const categoryDocument =
      await findOrCreateCategory(category);

    const bookFile =
      req.files.bookFile[0];

    const coverFile =
      req.files.coverImage[0];

    const book =
      await Book.create({

        title: title.trim(),

        author:
          authorDocument._id,

        category:
          categoryDocument._id,

        description:
          description || "",

        publishedYear:
          publishedYear
            ? Number(publishedYear)
            : undefined,

        rating:
          rating
            ? Number(rating)
            : 0,

        filePath:
          `/uploads/books/${bookFile.filename}`,

        coverImage:
          `/uploads/covers/${coverFile.filename}`
      });

    const populatedBook =
      await Book.findById(book._id)
        .populate("author")
        .populate("category");

    res.status(201).json({
      message: "Book created successfully.",
      book: populatedBook
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:
        error.message ||
        "Failed to create book."
    });
  }
}

async function updateBook(req, res) {

  try {

    const book =
      await Book.findById(req.params.id);

    if (!book) {

      return res.status(404).json({
        message: "Book not found."
      });
    }

    const {
      title,
      author,
      category,
      description,
      publishedYear,
      rating,
      isAvailable
    } = req.body;

    if (title) {
      book.title = title.trim();
    }

    if (author) {

      const authorDocument =
        await findOrCreateAuthor(author);

      book.author =
        authorDocument._id;
    }

    if (category) {

      const categoryDocument =
        await findOrCreateCategory(category);

      book.category =
        categoryDocument._id;
    }

    if (description !== undefined) {
      book.description = description;
    }

    if (publishedYear) {
      book.publishedYear =
        Number(publishedYear);
    }

    if (rating !== undefined) {
      book.rating =
        Number(rating);
    }

    if (isAvailable !== undefined) {
      book.isAvailable =
        isAvailable === "true" ||
        isAvailable === true;
    }

    if (req.files?.bookFile?.[0]) {

      book.filePath =
        `/uploads/books/${req.files.bookFile[0].filename}`;
    }

    if (req.files?.coverImage?.[0]) {

      book.coverImage =
        `/uploads/covers/${req.files.coverImage[0].filename}`;
    }

    await book.save();

    const populatedBook =
      await Book.findById(book._id)
        .populate("author")
        .populate("category");

    res.json({
      message: "Book updated successfully.",
      book: populatedBook
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:
        error.message ||
        "Failed to update book."
    });
  }
}

async function deleteBook(req, res) {

  try {

    const book =
      await Book.findByIdAndDelete(
        req.params.id
      );

    if (!book) {

      return res.status(404).json({
        message: "Book not found."
      });
    }

    res.json({
      message: "Book deleted successfully."
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to delete book."
    });
  }
}

async function incrementViews(req, res) {

  try {

    const book =
      await Book.findByIdAndUpdate(
        req.params.id,
        {
          $inc: {
            viewsCount: 1
          }
        },
        {
          new: true
        }
      );

    if (!book) {

      return res.status(404).json({
        message: "Book not found."
      });
    }

    res.json({
      viewsCount:
        book.viewsCount
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to update views."
    });
  }
}

async function incrementDownloads(req, res) {

  try {

    const book =
      await Book.findByIdAndUpdate(
        req.params.id,
        {
          $inc: {
            downloads: 1
          }
        },
        {
          new: true
        }
      );

    if (!book) {

      return res.status(404).json({
        message: "Book not found."
      });
    }

    res.json({
      downloads:
        book.downloads
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to update downloads."
    });
  }
}

module.exports = {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  incrementViews,
  incrementDownloads
};
