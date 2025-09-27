const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const {
  createTransactionRequest,
  getTransactionRequests,
  getTransactionRequestById,
  updateTransactionRequest,
  deleteTransactionRequest,
  getUserTransactionRequests,
} = require("../controller/transreq-controller");
const {
  uploadTransactionImage,
  handleUploadError,
} = require("../middleware/upload");

// Create transaction request
router.post(
  "/create",
  uploadTransactionImage,
  authenticateUser,
  createTransactionRequest
);

// Get all transaction requests
router.get("/", getTransactionRequests);

// Get transaction request by ID
router.get("/:id", getTransactionRequestById);


module.exports = router;
