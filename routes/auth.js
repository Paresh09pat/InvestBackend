const express = require("express");
const User = require("../models/User");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { cookieOptions, upload, handleMulterError } = require("../config/utils");
const { register, login, profile, updateProfile, logout, uploadProfilePictureController, deleteProfilePictureController, getPortfolio } = require("../controller/auth-controller");
const { authenticateUser } = require("../middleware/auth");
const notificationRoutes = require("./notification-route");
const { getDefaultPlans } = require("../controller/subscription-controller");
const { getTraders } = require("../controller/trader-controller");
const { getTransactionHistory } = require("../controller/transactionhistory-controller");

router.post("/register", register);
router.post("/login", login);


router.use(authenticateUser)
router.get("/profile", profile);
router.get("/portfolio", getPortfolio);
 
// Update user profile route
router.put("/profile", updateProfile);


// Logout route
router.post("/logout", logout);


// notification route
router.use("/notifications", notificationRoutes);

// Upload profile picture route
router.post(
  "/upload-profile-picture",
  authenticateUser,
  upload.single("profilePicture"),
  handleMulterError,
  uploadProfilePictureController
);


// get user transaction history
router.get("/transaction-history", authenticateUser, getTransactionHistory);

// Delete profile picture route
router.delete("/delete-profile-picture", authenticateUser, deleteProfilePictureController);

// Admin delete user route
router.delete("/admin/delete-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Delete user documents from filesystem if they exist
    try {
      const fs = require("fs-extra");
      const path = require("path");

      // Delete Aadhaar document
      if (user.documents?.aadhaar?.filePath) {
        const aadhaarPath = path.join(
          __dirname,
          "..",
          user.documents.aadhaar.filePath
        );
        if (fs.existsSync(aadhaarPath)) {
          fs.unlinkSync(aadhaarPath);
        }
      }

      // Delete PAN document
      if (user.documents?.pan?.filePath) {
        const panPath = path.join(__dirname, "..", user.documents.pan.filePath);
        if (fs.existsSync(panPath)) {
          fs.unlinkSync(panPath);
        }
      }
    } catch (fileError) {
      console.error("Error deleting user documents:", fileError);
      // Continue with user deletion even if file deletion fails
    }

    // Delete user from database
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: "User deleted successfully",
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Delete user error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID format",
      });
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get recent users for admin dashboard
router.get("/admin/recent-users", async (req, res) => {
  try {
    // Get recent users (last 10, sorted by join date)
    const recentUsers = await User.find({})
      .select("-password -documents") // Exclude sensitive data
      .sort({ joinDate: -1 }) // Sort by join date descending
      .limit(10);

    res.status(200).json({
      message: "Recent users retrieved successfully",
      users: recentUsers,
    });
  } catch (error) {
    console.error("Recent users error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get admin dashboard statistics
router.get("/admin/stats", async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get verified users count
    const verifiedUsers = await User.countDocuments({
      verificationStatus: "verified",
    });

    // Get pending verification count
    const pendingVerifications = await User.countDocuments({
      verificationStatus: "pending",
    });

    // Get users with documents uploaded
    const usersWithDocuments = await User.countDocuments({
      $or: [
        { "documents.aadhaar.status": { $exists: true } },
        { "documents.pan.status": { $exists: true } },
      ],
    });

    // Calculate total invested amount (from user's totalInvested field)
    const totalInvestmentResult = await User.aggregate([
      {
        $group: {
          _id: null,
          totalInvested: { $sum: "$totalInvested" },
          totalBalance: { $sum: "$currentBalance" },
        },
      },
    ]);

    const totalInvested = totalInvestmentResult[0]?.totalInvested || 0;
    const totalBalance = totalInvestmentResult[0]?.totalBalance || 0;

    const stats = {
      totalUsers,
      verifiedUsers,
      pendingVerifications,
      usersWithDocuments,
      totalInvested,
      totalBalance,
      monthlyGrowth: 12.5, // This could be calculated from historical data
      platformHealth: "Excellent",
    };

    res.status(200).json({
      message: "Admin statistics retrieved successfully",
      stats,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

// subscription plans
router.get("/plans", getDefaultPlans);

router.get("/traders", getTraders);

module.exports = router;
