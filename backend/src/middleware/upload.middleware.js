const multer = require("multer");
const path = require("path");

const allowedBookExtensions = [".pdf", ".epub"];
const allowedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const allowedBookMimeTypes = ["application/pdf", "application/epub+zip", "application/octet-stream"];
const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = function (req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "bookFile") {
    if (!allowedBookExtensions.includes(extension) || !allowedBookMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF and EPUB books are allowed."));
    }
  }

  if (["coverImage", "avatar"].includes(file.fieldname)) {
    if (!allowedImageExtensions.includes(extension) || !allowedImageMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
    }
  }

  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024
  }
});

module.exports = upload;
