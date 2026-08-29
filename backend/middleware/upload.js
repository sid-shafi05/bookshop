const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Where uploaded images physically live on disk
const uploadDir = path.join(__dirname, '..', 'uploads', 'books');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Never trust the original filename — build our own so two people
    // uploading "cover.jpg" at once can't collide or overwrite each other.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `book-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
});

module.exports = upload;