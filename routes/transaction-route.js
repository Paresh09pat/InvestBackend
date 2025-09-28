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
const { getMyTransactionHistory } = require("../controller/transactionhistory-controller");

// Create transaction request
router.post(
  "/create",
  uploadTransactionImage,
  authenticateUser,
  createTransactionRequest
);

// Get all transaction requests
router.get("/", getTransactionRequests);

router.get("/history", authenticateUser, getMyTransactionHistory);

// Get transaction request by ID
router.get("/:id", getTransactionRequestById);


module.exports = router;
