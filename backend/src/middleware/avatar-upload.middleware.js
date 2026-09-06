const multer = require('multer');
const path = require('path');

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension) || !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, JPEG, PNG and WEBP images are allowed.'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = upload;
