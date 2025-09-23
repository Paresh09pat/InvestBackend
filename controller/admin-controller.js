const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

// Predefined admin (hashed password for security)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;



// Hash admin password if not already hashed
let hashedAdminPassword;
try {
  hashedAdminPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
} catch (error) {
  console.error("Error hashing admin password:", error);
  hashedAdminPassword = bcrypt.hashSync("admin123", 10); // fallback
}

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check if email matches admin email
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({
        message: "Invalid admin credentials",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, hashedAdminPassword);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid admin credentials",
      });
    }

    // Generate JWT token
    const adminToken = jwt.sign(
      {
        name: "Super Admin",
        role: "admin",
        email: email.toLowerCase(),
        isAdmin: true,
      },
      JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    res.cookie("admin_token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Return success response
    res.status(200).json({
      message: "Admin login successful",
      user: {
        name: "Super Admin",
        email: email.toLowerCase(),
        role: "admin",
        isAdmin: true,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      message: "Internal server error during admin login",
    });
  }
};

const adminProfile = async (req, res) => {
  try {
    const adminToken =
      req.cookies.admin_token || req.headers.authorization?.split(" ")[1];

    if (!adminToken) {
      return res.status(401).json({
        message: "Admin token required",
      });
    }

    const decoded = jwt.verify(adminToken, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    // Check if token is close to expiry (less than 2 hours remaining)
    const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = tokenExpiry - now;
    const twoHours = 2 * 60 * 60 * 1000;

    if (timeUntilExpiry < twoHours && timeUntilExpiry > 0) {
      // Generate new token
      const newAdminToken = jwt.sign(
        {
          name: "Super Admin",
          role: "admin",
          email: decoded.email,
          isAdmin: true,
        },
        JWT_SECRET,
        {
          expiresIn: "24h",
        }
      );

      // Set new cookie
      res.cookie("admin_token", newAdminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });
    }

    res.status(200).json({
      message: "Admin profile retrieved successfully",
      user: {
        name: decoded.name || "Super Admin",
        email: decoded.email,
        role: decoded.role,
        isAdmin: decoded.isAdmin,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid admin token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Admin token expired",
      });
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const adminDeleteUser = async (req, res) => {
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
};

const adminGetRecentUsers = async (req, res) => {
  try {
    // Get recent users (last 10, sorted by creation date)
    const recentUsers = await User.find({})
      .select("-password -documents") // Exclude sensitive data
      .sort({ createdAt: -1 }) // Sort by creation date descending
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
};

const adminGetStats = async (req, res) => {
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
};

const adminLogout = async (req, res) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
  });

  res.status(200).json({
    message: "Admin logged out successfully",
  });
};


// trader i

module.exports = {
  adminLogin,
  adminProfile,
  adminLogout,
  adminDeleteUser,
  adminGetRecentUsers,
  adminGetStats,
};
