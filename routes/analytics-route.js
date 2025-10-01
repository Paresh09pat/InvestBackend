const express = require("express");
const router = express.Router();
const { authenticateAdmin } = require("../middleware/auth");
const {
  getComprehensiveDashboard
} = require("../controller/analytics-controller");

// All analytics routes require admin authentication
router.use(authenticateAdmin);

// Comprehensive Dashboard - Single endpoint with all analytics data
router.get("/dashboard", getComprehensiveDashboard);

module.exports = router;
