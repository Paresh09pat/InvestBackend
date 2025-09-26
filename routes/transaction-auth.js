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
  "/create-transaction-request",
  uploadTransactionImage,
  authenticateUser,
  createTransactionRequest
);

// Get all transaction requests
router.get("/transaction-requests", getTransactionRequests);

// Get transaction request by ID
router.get("/transaction-requests/:id", getTransactionRequestById);

// Delete transaction request


module.exports = router;
