const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/User");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinaryUpload");
const Portfolio = require("../models/Portfolio");
const Notification = require("../models/Notification");
const Referral = require("../models/Referal");
const InvestRequest = require("../models/InvestRequest");
const ReferralTransaction = require("../models/ReferralTransaction");
const TransactionRequest = require("../models/TransactionRequest");
const { createNotification } = require("./notification-controller");

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
      console.log("Admin already exists");
      return
    }
    const admin = await User.create({ name: "Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin", phone: "8985632145", isVerified: true, agree: true, verificationStatus: "verified" });

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
    const notifications = await Notification.find({ userId: decoded._id, read: false }).countDocuments();
    const admin = await User.findOne({ email: decoded.email }).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin user not found",
      });
    }

    // Count pending documents (Aadhaar and PAN documents with status pending)
    const pendingDocuments = await User.countDocuments({
      $or: [
        { "documents.aadhaar.status": "pending" },
        { "documents.pan.status": "pending" }
      ]
    });

    // Count pending investments (deposit transactions with status pending)
    const pendingInvestments = await TransactionRequest.countDocuments({
      type: "deposit",
      status: "pending"
    });

    // Count pending withdrawals (withdrawal transactions with status pending)
    const pendingWithdrawals = await TransactionRequest.countDocuments({
      type: "withdrawal",
      status: "pending"
    });

    // Count pending referrals (referral transactions with status pending)
    const pendingReferrals = await ReferralTransaction.countDocuments({
      status: "pending"
    });

    res.status(200).json({
      message: "Admin profile retrieved successfully",
      user: {
        _id: admin._id,
        name: admin.name || "Super Admin",
        email: admin.email,
        role: admin.role,
        isAdmin: admin.isAdmin,
        profilePicture: admin.profilePicture,
        notifications,
      },
      counts: {
        pendingDocuments,
        pendingInvestments,
        pendingWithdrawals,
        pendingReferrals
      }
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

const updateAdmin = async (req, res) => {
  try {

    const { currentPassword, newPassword } = req.body;
    const pic = req.file;

    const admin = await User.findOne({ email: req.admin.email });


    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const id = admin._id;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      admin.password = newPassword;

    }

    // Handle profile picture update
    if (pic) {
      const uploadResult = await uploadToCloudinary(pic);

      admin.profilePicture = {
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        uploadedAt: new Date()
      };
    }

    admin.save()
    const updatedAdmin = await User.findById(id).select("-password");


    return res.status(200).json({
      message: "Admin updated successfully",
      admin: updatedAdmin,
    });

  } catch (err) {
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
    const { currentValue, planName } = req.body;

    if (typeof currentValue !== "number") {
      return res.status(400).json({
        message: "currentValue must be a number",
      });
    }

    // Find the existing portfolio
    const existingPortfolio = await Portfolio.findById(id);
    if (!existingPortfolio) {
      return res.status(404).json({
        message: "Portfolio not found",
      });
    }

    // If planName is provided, update specific plan
    if (planName) {
      if (!["silver", "gold", "platinum"].includes(planName)) {
        return res.status(400).json({
          message: "planName must be one of: silver, gold, platinum",
        });
      }

      // Find the specific plan
      const planIndex = existingPortfolio.plans.findIndex(p => p.name === planName);
      if (planIndex === -1) {
        return res.status(404).json({
          message: `Plan ${planName} not found in portfolio`,
        });
      }

      const plan = existingPortfolio.plans[planIndex];
      const planInvested = plan.invested || 0;
      const planReturns = currentValue - planInvested;

      // Update the specific plan
      existingPortfolio.plans[planIndex].currentValue = currentValue;
      existingPortfolio.plans[planIndex].returns = planReturns;

      // Add to plan's price history
      if (!existingPortfolio.plans[planIndex].priceHistory) {
        existingPortfolio.plans[planIndex].priceHistory = [];
      }
      existingPortfolio.plans[planIndex].priceHistory.push({
        value: currentValue,
        updatedAt: new Date()
      });

      // Recompute portfolio aggregates from all plans
      existingPortfolio.totalInvested = existingPortfolio.plans.reduce((sum, p) => sum + (p.invested || 0), 0);
      existingPortfolio.currentValue = existingPortfolio.plans.reduce((sum, p) => sum + (p.currentValue || 0), 0) + (existingPortfolio.referralRewards || 0);
      existingPortfolio.totalReturns = existingPortfolio.currentValue - existingPortfolio.totalInvested;
      existingPortfolio.totalReturnsPercentage = existingPortfolio.totalInvested
        ? (existingPortfolio.totalReturns / existingPortfolio.totalInvested) * 100
        : 0;

    } else {
      // Update portfolio-wide currentValue (legacy behavior)
      const totalInvested = existingPortfolio.totalInvested;
      const totalReturns = currentValue - totalInvested;
      const totalReturnsPercentage = totalInvested
        ? (totalReturns / totalInvested) * 100
        : 0;

      existingPortfolio.currentValue = currentValue + (existingPortfolio.referralRewards || 0);
      existingPortfolio.totalReturns = existingPortfolio.currentValue - existingPortfolio.totalInvested;
      existingPortfolio.totalReturnsPercentage = existingPortfolio.totalInvested
        ? (existingPortfolio.totalReturns / existingPortfolio.totalInvested) * 100
        : 0;

      // Add to all plan price histories if they exist
      if (existingPortfolio.plans && existingPortfolio.plans.length > 0) {
        existingPortfolio.plans.forEach(plan => {
          if (!plan.priceHistory) {
            plan.priceHistory = [];
          }
          plan.priceHistory.push({
            value: plan.currentValue || 0,
            updatedAt: new Date()
          });
        });
      }
    }

    const portfolio = await existingPortfolio.save();

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

const getPortfolios = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    // Search filter
    const searchRegex = new RegExp(search, "i");
    const searchFilter = search
      ? {
        $or: [
          // Portfolio fields (numbers converted to string for regex)
          { totalInvested: { $regex: searchRegex } },
          { currentValue: { $regex: searchRegex } },
          { totalReturns: { $regex: searchRegex } },
          { totalReturnsPercentage: { $regex: searchRegex } },

          // User fields
          { "user.name": { $regex: searchRegex } },
          { "user.email": { $regex: searchRegex } },
          { "user.phone": { $regex: searchRegex } },
          { "user.profilePicture": { $regex: searchRegex } },
        ],
      }
      : {};

    const pipeline = [
      {
        $lookup: {
          from: "users",
          let: { userId: "$user" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { name: 1, email: 1, phone: 1, profilePicture: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: "$user" },

      ...(search ? [{ $match: searchFilter }] : []),

      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const results = await Portfolio.aggregate(pipeline);

    // Count for pagination
    const countPipeline = [
      {
        $lookup: {
          from: "users",
          let: { userId: "$user" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { name: 1, email: 1, phone: 1, profilePicture: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: "$user" },
      ...(search ? [{ $match: searchFilter }] : []),
      { $count: "total" },
    ];

    const totalCountResult = await Portfolio.aggregate(countPipeline);
    const totalCount = totalCountResult[0]?.total || 0;

    res.status(200).json({
      message: "Portfolio fetched successfully",
      portfolio: results,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
}

const getPortfolioById = async (req, res) => {
  try {

    const { id } = req.params;
    const portfolio = await Portfolio.findById(id)
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

// Add referral reward to portfolio
const addReferralReward = async (req, res) => {
  try {
    const { referrerId, referredId, rewardAmount } = req.body;

    // Validate input
    if (!referrerId || !referredId || !rewardAmount) {
      return res.status(400).json({
        message: "referrerId, referredId, and rewardAmount are required",
      });
    }

    if (typeof rewardAmount !== "number" || rewardAmount <= 0) {
      return res.status(400).json({
        message: "rewardAmount must be a positive number",
      });
    }

    // Find the referral record
    const referral = await Referral.findOne({
      referrer: referrerId,
      referred: referredId,
      rewardClaimed: false,
      rewardExpiresAt: { $gt: new Date() }
    });

    if (!referral) {
      return res.status(404).json({
        message: "Valid referral record not found or reward already claimed",
      });
    }

    // Find or create portfolio for referrer
    let portfolio = await Portfolio.findOne({ user: referrerId });

    if (!portfolio) {
      // Create new portfolio with referral reward
      portfolio = new Portfolio({
        user: referrerId,
        totalInvested: 0,
        currentValue: rewardAmount,
        totalReturns: rewardAmount,
        totalReturnsPercentage: 0,
        referralRewards: rewardAmount,
        plans: []
      });
    } else {
      // Update existing portfolio
      portfolio.referralRewards = (portfolio.referralRewards || 0) + rewardAmount;
      portfolio.currentValue = (portfolio.currentValue || 0) + rewardAmount;
      portfolio.totalReturns = portfolio.currentValue - portfolio.totalInvested;
      portfolio.totalReturnsPercentage = portfolio.totalInvested > 0
        ? (portfolio.totalReturns / portfolio.totalInvested) * 100
        : 0;
    }

    await portfolio.save();

    // Mark referral as claimed
    referral.rewardClaimed = true;
    await referral.save();

    // Get referrer details for response
    const referrer = await User.findById(referrerId).select("name email");
    const referred = await User.findById(referredId).select("name email");

    res.status(200).json({
      message: "Referral reward added successfully",
      data: {
        referrer: referrer,
        referred: referred,
        rewardAmount: rewardAmount,
        portfolio: portfolio
      }
    });

  } catch (error) {
    console.error("Add referral reward error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get pending referral rewards
const getPendingReferralRewards = async (req, res) => {
  try {
    const pendingReferrals = await Referral.find({
      rewardClaimed: false,
      rewardExpiresAt: { $gt: new Date() }
    })
      .populate("referrer", "name email referralCode")
      .populate("referred", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Pending referral rewards fetched successfully",
      data: pendingReferrals
    });

  } catch (error) {
    console.error("Get pending referral rewards error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

//withdrawal investment request update for admin 
const updateInvestmentRequest = async (req, res) => {
  try {
    const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const investmentRequest = await InvestRequest.findByIdAndUpdate(id, { status, rejectionReason }, { new: true });
  return res.status(200).json({
    message: "Investment request updated successfully",
    data: investmentRequest,
  });

  } catch (error) {
    console.error("Update investment request error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

// withdrawal investment request get for admin
const getInvestmentRequest = async (req, res) => {
  try {
    const investmentRequests = await InvestRequest.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      message: "Investment requests fetched successfully",
      data: investmentRequests,
    });
  } catch (error) {
    console.error("Get investment request error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// withdrawal investment request get for admin
const getInvestmentRequestById = async (req, res) => {
  try {
    const investmentRequest = await InvestRequest.findById(req.params.id)
      .populate("userId", "name email");
    
    if (!investmentRequest) {
      return res.status(404).json({
        success: false,
        message: "Investment request not found",
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Investment request fetched successfully",
      data: investmentRequest,
    });
  } catch (error) {
    console.error("Get investment request by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// withdrawal investment request delete for admin
const deleteInvestmentRequest = async (req, res) => {
  try {
    const investmentRequest = await InvestRequest.findByIdAndDelete(req.params.id);
    if (!investmentRequest) {
      return res.status(404).json({
        message: "Investment request not found",
      });
    }
    return res.status(200).json({
      message: "Investment request deleted successfully",
      data: investmentRequest,
    });
  } catch (error) {
    console.error("Delete investment request error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getAllReferrals = async (req, res) => {
  try {
    const { page, limit, search } = req.query;

    const skip = (page - 1) * limit;
    const referrals = await Referral.find({ $or: [{ referrer: { $regex: search, $options: "i" } }, { referred: { $regex: search, $options: "i" } }] }).populate("referrer", "name email").populate("referred", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Referral.countDocuments({ $or: [{ referrer: { $regex: search, $options: "i" } }, { referred: { $regex: search, $options: "i" } }] });
    res.status(200).json({
      message: "Referrals fetched successfully",
      data: referrals,
      total: total
    });
  }
  catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
}

// Get all referral transactions
const getReferralTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { "referrer.name": { $regex: search, $options: "i" } },
        { "referred.name": { $regex: search, $options: "i" } },
        { referredPlan: { $regex: search, $options: "i" } }
      ];
    }

    const referralTransactions = await ReferralTransaction.find(filter)
      .populate("referrer", "name email")
      .populate("referred", "name email")
      .populate("approvedBy", "name email")
      .populate("transactionRequestId", "amount type plan")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ReferralTransaction.countDocuments(filter);

    res.status(200).json({
      message: "Referral transactions fetched successfully",
      data: referralTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      }
    });
  } catch (error) {
    console.error("Get referral transactions error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

// Update referral transaction (approve/reject)
const updateReferralTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    const { id } = req.params;
    const { status, rewardAmount, rejectionReason, rewardPercentage } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Referral transaction ID is required"
      });
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either 'approved' or 'rejected'"
      });
    }

    const referralTransaction = await ReferralTransaction.findById(id).session(session);
    if (!referralTransaction) {
      return res.status(404).json({
        message: "Referral transaction not found"
      });
    }

    if (referralTransaction.status !== "pending") {
      return res.status(400).json({
        message: "Only pending referral transactions can be updated"
      });
    }

    // Prepare update data
    const updateData = {
      status,
      approvedBy: req.admin._id,
      approvedAt: new Date()
    };

    if (status === "approved") {
      if (!rewardAmount || rewardAmount <= 0) {
        return res.status(400).json({
          message: "Reward amount is required and must be greater than 0 for approval"
        });
      }

      // Validate reward calculation if rewardPercentage is provided
      if (rewardPercentage !== undefined && rewardPercentage !== null) {
        if (typeof rewardPercentage !== "number" || rewardPercentage < 0 || rewardPercentage > 100) {
          return res.status(400).json({
            message: "Reward percentage must be a number between 0 and 100"
          });
        }

        // Calculate expected reward amount based on percentage
        const expectedRewardAmount = (referralTransaction.referredDepositAmount * rewardPercentage) / 100;
        
        // Check if the provided rewardAmount matches the calculated amount
        if (Math.abs(rewardAmount - expectedRewardAmount) > 0.01) { // Allow for small floating point differences
          return res.status(400).json({
            message: `Reward amount (${rewardAmount}) does not match the calculated percentage amount (${expectedRewardAmount.toFixed(2)}) based on ${rewardPercentage}% of deposit amount (${referralTransaction.referredDepositAmount})`,
            expectedRewardAmount: expectedRewardAmount.toFixed(2),
            providedRewardAmount: rewardAmount,
            rewardPercentage: rewardPercentage,
            depositAmount: referralTransaction.referredDepositAmount
          });
        }
      }

      updateData.rewardAmount = rewardAmount;
    } else if (status === "rejected") {
      if (!rejectionReason) {
        return res.status(400).json({
          message: "Rejection reason is required for rejection"
        });
      }
      updateData.rejectionReason = rejectionReason;
    }

    // Update referral transaction
    const updatedReferralTransaction = await ReferralTransaction.findByIdAndUpdate(
      id,
      updateData,
      { new: true, session }
    ).populate("referrer", "name email")
     .populate("referred", "name email")
     .populate("approvedBy", "name email");

    // If approved, add reward to referrer's portfolio
    if (status === "approved") {
      // Find or create portfolio for referrer
      let portfolio = await Portfolio.findOne({ user: referralTransaction.referrer }).session(session);

      if (!portfolio) {
        // Create new portfolio with referral reward
        portfolio = new Portfolio({
          user: referralTransaction.referrer,
          totalInvested: 0,
          currentValue: rewardAmount,
          totalReturns: rewardAmount,
          totalReturnsPercentage: 0,
          referralRewards: rewardAmount,
          plans: []
        });
      } else {
        // Update existing portfolio
        portfolio.referralRewards = (portfolio.referralRewards || 0) + rewardAmount;
        portfolio.currentValue = (portfolio.currentValue || 0) + rewardAmount;
        portfolio.totalReturns = portfolio.currentValue - portfolio.totalInvested;
        portfolio.totalReturnsPercentage = portfolio.totalInvested > 0
          ? (portfolio.totalReturns / portfolio.totalInvested) * 100
          : 0;
      }

      await portfolio.save({ session });

      // Mark original referral as claimed
      await Referral.findOneAndUpdate(
        {
          referrer: referralTransaction.referrer,
          referred: referralTransaction.referred,
          rewardClaimed: false
        },
        { rewardClaimed: true },
        { session }
      );

      // Create notification for referrer
      await createNotification(
        referralTransaction.referrer,
        `Congratulations! You received a referral reward of $${rewardAmount} for referring ${updatedReferralTransaction.referred.name}`,
        "Referral Reward Approved"
      );
    }

    // Create notification for referred user
    await createNotification(
      referralTransaction.referred,
      `Your referrer has ${status === "approved" ? "received" : "been denied"} a referral reward for your first deposit`,
      `Referral Reward ${status === "approved" ? "Approved" : "Rejected"}`
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: `Referral transaction ${status} successfully`,
      data: updatedReferralTransaction
    });

  } catch (error) {
    console.error("Update referral transaction error:", error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get referral transaction by ID
const getReferralTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Referral transaction ID is required"
      });
    }

    const referralTransaction = await ReferralTransaction.findById(id)
      .populate("referrer", "name email")
      .populate("referred", "name email")
      .populate("approvedBy", "name email")
      .populate("transactionRequestId", "amount type plan");

    if (!referralTransaction) {
      return res.status(404).json({
        message: "Referral transaction not found"
      });
    }

    res.status(200).json({
      message: "Referral transaction fetched successfully",
      data: referralTransaction
    });

  } catch (error) {
    console.error("Get referral transaction by ID error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

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
  getPortfolios,
  addReferralReward,
  getPendingReferralRewards,
  updateInvestmentRequest,
  getInvestmentRequest,
  getInvestmentRequestById,
  deleteInvestmentRequest,
  getAllReferrals,
  getReferralTransactions,
  updateReferralTransaction,
  getReferralTransactionById,
};
