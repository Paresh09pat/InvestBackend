// server/routes/admin-auth.js
const express = require("express");
const { authenticateAdmin } = require("../middleware/auth");

const {
  adminLogin,
  adminProfile,
  adminLogout,
  adminDeleteUser,
  adminGetRecentUsers,
  adminGetStats,
} = require("../controller/admin-controller");

const router = express.Router();

// Admin login route
router.post("/login", adminLogin);

// Admin profile route (protected)
router.get("/profile", adminProfile);

// Admin delete user route (protected)
router.delete("/delete-user/:userId", authenticateAdmin, adminDeleteUser);

// Get recent users (protected)
router.get("/recent-users", authenticateAdmin, adminGetRecentUsers);

// Get admin dashboard statistics (protected)
router.get("/stats", authenticateAdmin, adminGetStats);

// Admin logout route
router.post("/logout", adminLogout);

module.exports = router;
