// server/routes/admin-auth.js
const express = require("express");
const { authenticateAdmin } = require("../middleware/auth");
const { uploadPicture, handleUploadError } = require("../middleware/upload");

const {
  adminLogin,
  adminProfile,
  adminLogout,
  adminDeleteUser,
  adminGetRecentUsers,
  adminGetStats,
  updateAdmin,
  getPortfolioById,
  updatePortfolio,
} = require("../controller/admin-controller");
const { createTrader, getTraders, getTraderById, updateTrader, deleteTrader } = require("../controller/trader-controller");
const { updateTransactionRequest, deleteTransactionRequest, getTransactionRequestById, getTransactionRequests } = require("../controller/transreq-controller");
const { updatePlans, getDefaultPlans, getSinglePlan } = require("../controller/subscription-controller");


const { createTransactionHistory, getTransactionHistory, getTransactionHistoryById  } = require("../controller/transactionhistory-controller");

const router = express.Router();

// Admin login route
router.post("/login", adminLogin);

// Admin profile route (protected)
router.get("/profile", authenticateAdmin, adminProfile);
router.route("/portfolio/:id").get(authenticateAdmin, getPortfolioById).put(authenticateAdmin, updatePortfolio)

router.put("/update", authenticateAdmin, uploadPicture, handleUploadError, updateAdmin);

// Admin delete user route (protected)
router.delete("/delete-user/:userId", authenticateAdmin, adminDeleteUser);

// Get recent users (protected)
router.get("/recent-users", authenticateAdmin, adminGetRecentUsers);

// Get admin dashboard statistics (protected)
router.get("/stats", authenticateAdmin, adminGetStats);

// Admin logout route
router.post("/logout", adminLogout);

// Trader information
router.post(
  "/trader",
  authenticateAdmin,
  uploadPicture,
  handleUploadError,
  createTrader
);
router.get("/traders", authenticateAdmin, getTraders);
router.get("/trader/:id", authenticateAdmin, getTraderById);
router.put(
  "/trader/:id",
  authenticateAdmin,
  uploadPicture,
  handleUploadError,
  updateTrader
);
router.delete("/trader/:id", authenticateAdmin, deleteTrader);

// Update transaction request (admin only)
router.put(
  "/update/:id",
  authenticateAdmin,  
  updateTransactionRequest
);

// // Delete transaction request(admin only)
router.delete(
  "/delete/:id",
  authenticateAdmin,
  deleteTransactionRequest
);

// Get transaction request by id
router.get("/transaction-request", authenticateAdmin, getTransactionRequests);

// Get transaction request by id
router.get("/transaction-request/:id", authenticateAdmin, getTransactionRequestById);

router.post("/create-transaction-history", authenticateAdmin, createTransactionHistory);

// get all transaction history
router.get("/transaction-history", authenticateAdmin, getTransactionHistory);

// get transaction history by id
router.get("/transaction-history/:id", authenticateAdmin, getTransactionHistoryById);





// Subscription plans
router.get("/plans", authenticateAdmin, getDefaultPlans);
router.get("/plan/:id", authenticateAdmin, getSinglePlan);
router.put("/plan/:id", authenticateAdmin, updatePlans);


module.exports = router;
