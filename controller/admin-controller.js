const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinaryUpload");
const Portfolio = require("../models/Portfolio");

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

const createAdmin = async (req, res) => {
  try {

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log("admin already exists")
      return
    }
    const admin = await User.create({ name: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin", phone: "8985632145", isVerified: true, agree: true, verificationStatus: "verified" });

    console.log("admin created successfully")
  } catch (error) {
    console.error("Error creating admin:", error);

  }
}

createAdmin()

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

    const decoded = req.admin

    // Check if token is close to expiry (less than 2 hours remaining)
    const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = tokenExpiry - now;
    const twoHours = 2 * 60 * 60 * 1000;

    if (timeUntilExpiry < twoHours && timeUntilExpiry > 0) {

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



      res.cookie("admin_token", newAdminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });
    }
    const admin = await User.findOne({ email: decoded.email }).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin user not found",
      });
    }

    res.status(200).json({
      message: "Admin profile retrieved successfully",
      user: {
        _id: admin._id,
        name: admin.name || "Super Admin",
        email: admin.email,
        role: admin.role,
        isAdmin: admin.isAdmin,
        profilePicture: admin.profilePicture,
      },
    });
  } catch (error) {
    console.log("error>>>", error)
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

    console.log("error>>>", error)
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateAdmin = async (req, res) => {
  try {

    const { currentPassword, newPassword } = req.body;
    const pic = req.file;

    const admin = await User.findOne({ email: req.admin.email });


    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const id = admin._id;
    let updateData = {};

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
    }

    // Handle profile picture update
    if (pic) {
      const uploadResult = await uploadToCloudinary(pic);

      updateData.profilePicture = {
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        uploadedAt: new Date()
      };
    }


    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updatedAdmin = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");


    return res.status(200).json({
      message: "Admin updated successfully",
      admin: updatedAdmin,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
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


const updatePortfolio = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentValue } = req.body;

    if (typeof currentValue !== "number") {
      return res.status(400).json({
        message: "currentValue must be a number",
      });
    }

    // Find the existing portfolio to get totalInvested
    const existingPortfolio = await Portfolio.findById(id);
    if (!existingPortfolio) {
      return res.status(404).json({
        message: "Portfolio not found",
      });
    }

    const totalInvested = existingPortfolio.totalInvested;
    const totalReturns = currentValue - totalInvested;
    const totalReturnsPercentage = totalInvested
      ? (totalReturns / totalInvested) * 100
      : 0; // avoid division by zero

    // Add current value to price history
    const priceHistoryEntry = {
      value: currentValue,
      updatedAt: new Date()
    };

    const portfolio = await Portfolio.findByIdAndUpdate(
      id,
      {
        currentValue,
        totalReturns,
        totalReturnsPercentage,
        $push: { priceHistory: priceHistoryEntry }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Portfolio updated successfully",
      portfolio,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getPortfolioById = async (req, res) => {
  try {

    const { id } = req.params;
    const portfolio = await Portfolio.findById(id);
    res.status(200).json({
      message: "Portfolio fetched successfully",
      portfolio,
    })
  }
  catch (err) {
    console.error(err)
    res.status(500).json({
      message: "Internal server error",
    })
  }
}

// trader i

module.exports = {
  adminLogin,
  adminProfile,
  updateAdmin,
  adminLogout,
  adminDeleteUser,
  adminGetRecentUsers,
  adminGetStats,
  updatePortfolio,
  getPortfolioById,
};
