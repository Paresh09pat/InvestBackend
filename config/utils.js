const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

const generateToken = (user) => {
  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  return token;
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/temp");
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for profile pictures"), false);
    }
  },
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File size too large. Maximum size is 5MB." });
    }
    return res
      .status(400)
      .json({ message: "File upload error: " + err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { generateToken, cookieOptions, storage, upload, handleMulterError };