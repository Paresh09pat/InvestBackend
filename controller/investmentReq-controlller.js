const mongoose = require("mongoose");
const Portfolio = require("../models/Portfolio");
const InvestRequest = require("../models/InvestRequest");
const User = require("../models/User");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const {
  createAdminNoitification,
  createNotification,
} = require("./notification-controller");
const TransactionHistory = require("../models/TransactionHistory");
const Subscription = require("../models/Subscription");
const Referral = require("../models/Referal");

const createInvestmentRequest = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    const { amount, plan, walletAddress, reason } = req.body;
    const userId = req.user._id;

    if (!amount || !plan || !walletAddress || !reason) {
      return res.status(400).json({
        success: false,
        message: "Fields required: amount, plan, walletAddress, and reason",
      });
    }

    if (!["silver", "gold", "platinum"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Plan must be either 'silver', 'gold', or 'platinum'",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isVerified || user.verificationStatus !== "verified") {
      return res.status(403).json({
        success: false,
        message: "User must be verified to create investment requests",
      });
    }

    if (!user.trustWalletAddress) {
      return res.status(400).json({
        success: false,
        message: "You don't have a registered wallet address in your profile",
      });
    }

    if (user.trustWalletAddress !== walletAddress) {
      return res.status(400).json({
        success: false,
        message:
          "Provided wallet address does not match your registered wallet address",
      });
    }

    const investmentRequest = new InvestRequest({
      userId,
      amount,
      plan,
      walletAddress,
      status: "pending",
      rejectionReason: reason,
    });

    await investmentRequest.save({ session });
    await investmentRequest.populate("userId", "name email phone");

    // ✅ Step 6: Record transaction in history
    await TransactionHistory.create(
      [
        {
          userId: investmentRequest.userId,
          amount: investmentRequest.amount,
          type: "investment",
          status: investmentRequest.status,
          txnReqId: investmentRequest._id,
        },
      ],
      { session }
    );

    await createAdminNoitification(
      `New investment request by ${investmentRequest.userId.name} for amount ${investmentRequest.amount}`,
      `New investment request`
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Investment request created successfully",
      data: investmentRequest,
    });
  } catch (error) {
    console.error("Error creating investment request:", error);
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getInvestmentRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      plan,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by status
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    // Filter by plan
    if (plan && ["silver", "gold", "platinum"].includes(plan)) {
      filter.plan = plan;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Search by user name or email (using regex for partial matching)
    if (search) {
      const userFilter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      };
      
      // Find users matching the search criteria
      const matchingUsers = await User.find(userFilter).select("_id");
      const userIds = matchingUsers.map(user => user._id);
      
      if (userIds.length > 0) {
        filter.userId = { $in: userIds };
      } else {
        // If no users match, return empty result
        filter.userId = { $in: [] };
      }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination info
    const totalCount = await InvestRequest.countDocuments(filter);

    // Get investment requests with pagination
    const investmentRequests = await InvestRequest.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      success: true,
      message: "Investment requests fetched successfully",
      data: investmentRequests,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error("Get investment requests error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

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
      error: error.message,
    });
  }
};

module.exports = {
  createInvestmentRequest,
  getInvestmentRequests,
  getInvestmentRequestById,
};
