const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const booksDir =
  path.resolve(
    process.env.UPLOAD_BOOKS_DIR || "uploads/books"
  );

const coversDir =
  path.resolve(
    process.env.UPLOAD_COVERS_DIR || "uploads/covers"
  );

fs.mkdirSync(booksDir, { recursive: true });
fs.mkdirSync(coversDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {

    if (file.fieldname === "bookFile") {
      cb(null, booksDir);
      return;
    }

    if (file.fieldname === "coverImage") {
      cb(null, coversDir);
      return;
    }

    cb(new Error("Invalid upload field"));
  },

  filename: function (req, file, cb) {

    const extension =
      path.extname(file.originalname).toLowerCase();

    const filename =
      `${uuidv4()}${extension}`;

    cb(null, filename);
  }
});

const allowedBookExtensions = [
  ".pdf",
  ".epub"
];

const allowedImageExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
];

const fileFilter = function (req, file, cb) {

  const extension =
    path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "bookFile") {

    if (!allowedBookExtensions.includes(extension)) {
      return cb(
        new Error("Only PDF and EPUB books are allowed.")
      );
    }
  }

  if (file.fieldname === "coverImage") {

    if (!allowedImageExtensions.includes(extension)) {
      return cb(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed."
        )
      );
    }
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize:
      Number(process.env.MAX_FILE_SIZE) ||
      50 * 1024 * 1024
  }
});

module.exports = upload;
