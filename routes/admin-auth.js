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
  getPortfolios,
  addReferralReward,
  getPendingReferralRewards,
  getInvestmentRequest,
  getInvestmentRequestById,
  updateInvestmentRequest,
  deleteInvestmentRequest,
  getReferralTransactions,
  updateReferralTransaction,
  getReferralTransactionById,
} = require("../controller/admin-controller");
const {
  createTrader,
  getTraders,
  getTraderById,
  updateTrader,
  deleteTrader,
} = require("../controller/trader-controller");
const {
  updateTransactionRequest,
  deleteTransactionRequest,
  getTransactionRequestById,
  getTransactionRequests,
} = require("../controller/transreq-controller");
const {
  updatePlans,
  getDefaultPlans,
  getSinglePlan,
} = require("../controller/subscription-controller");
const notificationRoute = require("./notification-route");

const {
  createTransactionHistory,
  getTransactionHistory,
  getTransactionHistoryById,
  getMyTransactionHistory,
} = require("../controller/transactionhistory-controller");

const router = express.Router();

// Admin login route
router.post("/login", adminLogin);

// Admin profile route (protected)
router.get("/profile", authenticateAdmin, adminProfile);
router.route("/portfolios").get(authenticateAdmin, getPortfolios)
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
router.put("/update/:id", authenticateAdmin, updateTransactionRequest);

// // Delete transaction request(admin only)
router.delete("/delete/:id", authenticateAdmin, deleteTransactionRequest);

// Get transaction request by id
router.get("/transaction-request", authenticateAdmin, getTransactionRequests);

// Get transaction request by id
router.get(
  "/transaction-request/:id",
  authenticateAdmin,
  getTransactionRequestById
);

router.post(
  "/create-transaction-history",
  authenticateAdmin,
  createTransactionHistory
);

// get all transaction history
router.get("/txn-history", authenticateAdmin, getTransactionHistory);

// get transaction history by id
router.get(
  "/transaction-history/:id",
  authenticateAdmin,
  getTransactionHistoryById
);

// Subscription plans
router.get("/plans", authenticateAdmin, getDefaultPlans);
router.get("/plan/:id", authenticateAdmin, getSinglePlan);
router.put("/plan/:id", authenticateAdmin, updatePlans);

// notification route
router.use("/notifications",authenticateAdmin,notificationRoute)

// Referral reward routes
router.get("/referral-rewards/pending", authenticateAdmin, getPendingReferralRewards);
router.post("/referral-rewards/add", authenticateAdmin, addReferralReward);

// withdrawal investment request routes for admin
router.get("/invt-requests", authenticateAdmin, getInvestmentRequest);
router.get("/invt-req/:id", authenticateAdmin, getInvestmentRequestById);
router.put("/invt-req/:id", authenticateAdmin, updateInvestmentRequest);
router.delete("/invt-req/:id", authenticateAdmin, deleteInvestmentRequest);
// Referral transaction routes
router.get("/referral-transactions", authenticateAdmin, getReferralTransactions);
router.get("/referral-transaction/:id", authenticateAdmin, getReferralTransactionById);
router.put("/referral-transaction/:id", authenticateAdmin, updateReferralTransaction);

module.exports = router;
