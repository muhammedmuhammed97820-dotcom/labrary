const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const booksDir = path.resolve(process.env.UPLOAD_BOOKS_DIR || "uploads/books");
const coversDir = path.resolve(process.env.UPLOAD_COVERS_DIR || "uploads/covers");
const avatarsDir = path.resolve(process.env.UPLOAD_AVATARS_DIR || "uploads/avatars");

fs.mkdirSync(booksDir, { recursive: true });
fs.mkdirSync(coversDir, { recursive: true });
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === "bookFile") return cb(null, booksDir);
    if (file.fieldname === "coverImage") return cb(null, coversDir);
    if (file.fieldname === "avatar") return cb(null, avatarsDir);
    cb(new Error("Invalid upload field"));
  },

  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${extension}`);
  }
});

const allowedBookExtensions = [".pdf", ".epub"];
const allowedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const fileFilter = function (req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "bookFile" && !allowedBookExtensions.includes(extension)) {
    return cb(new Error("Only PDF and EPUB books are allowed."));
  }

  if (["coverImage", "avatar"].includes(file.fieldname) && !allowedImageExtensions.includes(extension)) {
    return cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024
  }
});

module.exports = upload;
