const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { detectImageType } = require('../utils/imageCheck');
const { UPLOAD_DIR } = require('../utils/files');

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Files are kept in memory first, checked, and only then written to disk with a random name.
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1, fields: 20 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      const err = new Error('Only JPG, PNG, WEBP or GIF images are allowed.');
      err.status = 400;
      err.userMessage = err.message;
      return cb(err);
    }
    cb(null, true);
  },
});

function uploadProductImage(req, res, next) {
  parser.single('image')(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller.' : err.userMessage || 'Image upload failed.';
      return next();
    }
    if (req.file) {
      const type = detectImageType(req.file.buffer);
      if (!type) {
        req.uploadError = 'That file is not a valid image.';
        return next();
      }
      const name = crypto.randomBytes(16).toString('hex') + type.ext;
      fs.writeFile(path.join(UPLOAD_DIR, name), req.file.buffer, (writeErr) => {
        if (writeErr) req.uploadError = 'Could not save the image.';
        else req.savedImage = name;
        next();
      });
      return;
    }
    next();
  });
}

module.exports = { uploadProductImage };
