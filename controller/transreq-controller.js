const mongoose = require("mongoose");
const Portfolio = require("../models/Portfolio");
const TransactionRequest = require("../models/TransactionRequest");
const User = require("../models/User");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const {
  createAdminNoitification,
  createNotification,
} = require("./notification-controller");
const TransactionHistory = require("../models/TransactionHistory");
const Subscription = require("../models/Subscription");

const createTransactionRequest = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    const { amount, type, plan, trader, walletTxId, walletAddress } = req.body;
    const userId = req.user._id;
    const transactionImage = req.file;

    // Validate required fields
    if (!amount || !type || !plan || !walletAddress || !trader) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: amount, type, plan, walletAddress, and trader",
      });
    }

    // Check if user is verified
    const user = await User.findById(userId).session(session);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isVerified || user.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: "User must be verified to create transaction requests",
      });
    }

    // Validate wallet address matches user's profile
    if (user.trustWalletAddress && user.trustWalletAddress !== walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet address does not match your registered wallet address",
      });
    }

    // Handle transaction image upload (required for deposits, optional for withdrawals)
    let transactionImageUrl = null;
    if (transactionImage) {
      const uploadResult = await uploadToCloudinary(transactionImage);
      transactionImageUrl = uploadResult.secure_url;
    } else if (type === 'deposit') {
      return res.status(400).json({
        success: false,
        message: "Transaction image is required for deposits",
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Validate type
    if (!["deposit", "withdrawal"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either 'deposit' or 'withdrawal'",
      });
    }

    // Validate plan
    if (!["silver", "gold", "platinum"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Plan must be either 'silver', 'gold', or 'platinum'",
      });
    }

    // Create transaction request
    const transactionRequest = new TransactionRequest({
      userId,
      amount,
      type,
      plan,
      walletAddress,
      walletTxId,
      transactionImage: transactionImageUrl,
      trader: [trader], 
      status: "pending",
    });

    await transactionRequest.save({ session });

    // Populate user details for response
    await transactionRequest.populate("userId", "name email phone");

    await TransactionHistory.create(
      [
        {
          userId: transactionRequest.userId,
          amount: transactionRequest.amount,
          type: transactionRequest.type,
          status: transactionRequest.status,
          txnReqId: transactionRequest._id,
        },
      ],
      { session }
    );

    await createAdminNoitification(
      `New transaction request created by ${transactionRequest.userId.name} for amount ${transactionRequest.amount}`,
      `New transaction request created`
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Transaction request created successfully",
      data: transactionRequest,
    });
  } catch (error) {
    console.error("Error creating transaction request:", error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getTransactionRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, plan, search } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (plan) {
      filter.plan = { $regex: plan, $options: "i" };
    }

    if (search) {
      filter.$or = [
        { plan: { $regex: search, $options: "i" } },
        { "userId.name": { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get transaction requests with pagination and filtering
    const transactionRequests = await TransactionRequest.find(filter)
      .populate("userId", "name email")
      .populate("trader", "name email traderType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await TransactionRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Transaction requests fetched successfully",
      data: transactionRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting transaction requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getTransactionRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Transaction request ID is required",
      });
    }

    const transactionRequest = await TransactionRequest.findById(id)
      .populate("userId", "name email phone")
      .populate("trader", "name email traderType");

    if (!transactionRequest) {
      return res.status(404).json({
        success: false,
        message: "Transaction request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction request fetched successfully",
      data: transactionRequest,
    });
  } catch (error) {
    console.error("Error getting transaction request by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateTransactionRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { type, plan, status, rejectionReason, trustWalletAddress } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Transaction request ID is required",
      });
    }

    const transactionRequest = await TransactionRequest.findById(id).session(
      session
    );
    if (!transactionRequest) {
      return res.status(404).json({
        success: false,
        message: "Transaction request not found",
      });
    }

    // Validate fields
    // Validate fields
    if (type && !["deposit", "withdrawal"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be either 'deposit' or 'withdrawal'",
      });
    }

    if (plan && !["silver", "gold", "platinum"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Plan must be either 'silver', 'gold', or 'platinum'",
      });
    }

    if (status && !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'pending', 'approved', or 'rejected'",
      });
    }

    // Prepare updates
    const updateData = {};
    if (type) updateData.type = type;
    if (plan) updateData.plan = plan;
    if (status) updateData.status = status;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (trustWalletAddress) updateData.walletAddress = trustWalletAddress;
    

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields provided for update. Only 'type', 'plan', 'status', and 'rejectionReason' are allowed",
      });
    }

    // Update Transaction Request inside transaction
    const updatedTransactionRequest =
      await TransactionRequest.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
        session,
      })
        .populate("userId", "name email phone")
        .populate("trader", "name email traderType");

    if (updateData.status === "approved") {
      // Ensure we have the latest plan on the request
      const planName = updatedTransactionRequest.plan;
      const txnType = updatedTransactionRequest.type; // deposit | withdrawal
      const txnAmount = updatedTransactionRequest.amount;

      // Fetch subscription plan to get return rate bounds
      const subscriptionPlan = await Subscription.findOne({ name: planName }).session(session);

      let portfolio = await Portfolio.findOne({
        user: updatedTransactionRequest.userId,
      }).session(session);

      if (!portfolio) {
        // Initialize a fresh portfolio with plan buckets
        const plans = ["silver", "gold", "platinum"].map((name) => ({
          name,
          invested: 0,
          currentValue: 0,
          returns: 0,
          returnRate: {
            min: null,
            max: null,
          },
          priceHistory: [],
        }));

        // Set the active plan's return rates if available
        const activeIdx = plans.findIndex((p) => p.name === planName);
        if (activeIdx !== -1 && subscriptionPlan) {
          plans[activeIdx].returnRate.min = subscriptionPlan.minReturnRate ?? null;
          plans[activeIdx].returnRate.max = subscriptionPlan.maxReturnRate ?? null;
        }

        // Apply the transaction to the plan
        if (activeIdx !== -1) {
          if (txnType === "deposit") {
            plans[activeIdx].invested += txnAmount;
            plans[activeIdx].currentValue += txnAmount;
            // Add initial price history entry for deposit
            plans[activeIdx].priceHistory.push({
              value: txnAmount,
              updatedAt: new Date(),
            });
          } else if (txnType === "withdrawal") {
            plans[activeIdx].invested = Math.max(0, plans[activeIdx].invested - txnAmount);
            plans[activeIdx].currentValue = Math.max(0, plans[activeIdx].currentValue - txnAmount);
            // Add price history entry for withdrawal
            plans[activeIdx].priceHistory.push({
              value: plans[activeIdx].currentValue,
              updatedAt: new Date(),
            });
          }
          plans[activeIdx].returns = plans[activeIdx].currentValue - plans[activeIdx].invested;
        }

        // Compute portfolio aggregates
        const totalInvested = plans.reduce((s, p) => s + p.invested, 0);
        const currentValue = plans.reduce((s, p) => s + p.currentValue, 0);
        const totalReturns = currentValue - totalInvested;
        const totalReturnsPercentage = totalInvested ? (totalReturns / totalInvested) * 100 : 0;

        // Set portfolio-level return rate from the active subscription plan
        const portfolioReturnRate = subscriptionPlan ? {
          min: subscriptionPlan.minReturnRate,
          max: subscriptionPlan.maxReturnRate,
        } : { min: null, max: null };

        portfolio = new Portfolio({
          user: updatedTransactionRequest.userId,
          totalInvested,
          currentValue,
          totalReturns,
          totalReturnsPercentage,
          returnRate: portfolioReturnRate,
          plans,
        });
      } else {
        // Update the appropriate plan bucket in existing portfolio
        if (!Array.isArray(portfolio.plans)) {
          portfolio.plans = [];
        }

        let planBucket = portfolio.plans.find((p) => p.name === planName);
        if (!planBucket) {
          planBucket = {
            name: planName,
            invested: 0,
            currentValue: 0,
            returns: 0,
            returnRate: {
              min: subscriptionPlan?.minReturnRate ?? null,
              max: subscriptionPlan?.maxReturnRate ?? null,
            },
            priceHistory: [],
          };
          portfolio.plans.push(planBucket);
        } else {
          // Update known return bounds if available
          if (subscriptionPlan) {
            planBucket.returnRate = planBucket.returnRate || {};
            if (subscriptionPlan.minReturnRate != null) planBucket.returnRate.min = subscriptionPlan.minReturnRate;
            if (subscriptionPlan.maxReturnRate != null) planBucket.returnRate.max = subscriptionPlan.maxReturnRate;
          }
          // Ensure priceHistory exists
          if (!planBucket.priceHistory) {
            planBucket.priceHistory = [];
          }
        }

        if (txnType === "deposit") {
          planBucket.invested += txnAmount;
          planBucket.currentValue += txnAmount;
          // Add price history entry for deposit
          planBucket.priceHistory.push({
            value: planBucket.currentValue,
            updatedAt: new Date(),
          });
        } else if (txnType === "withdrawal") {
          planBucket.invested = Math.max(0, (planBucket.invested || 0) - txnAmount);
          planBucket.currentValue = Math.max(0, (planBucket.currentValue || 0) - txnAmount);
          // Add price history entry for withdrawal
          planBucket.priceHistory.push({
            value: planBucket.currentValue,
            updatedAt: new Date(),
          });
        }
        planBucket.returns = (planBucket.currentValue || 0) - (planBucket.invested || 0);

        // Recompute aggregates from plan buckets
        portfolio.totalInvested = portfolio.plans.reduce((s, p) => s + (p.invested || 0), 0);
        portfolio.currentValue = portfolio.plans.reduce((s, p) => s + (p.currentValue || 0), 0);
        portfolio.totalReturns = portfolio.currentValue - portfolio.totalInvested;
        portfolio.totalReturnsPercentage = portfolio.totalInvested
          ? (portfolio.totalReturns / portfolio.totalInvested) * 100
          : 0;
      }

      await portfolio.save({ session });
    }

    // Update TransactionHistory status if status is being updated
    if (updateData.status) {
      await TransactionHistory.findOneAndUpdate(
        { txnReqId: id },
        { status: updateData.status },
        { session }
      );
    }

    await createNotification(
      updatedTransactionRequest.userId,
      `Your transaction request has been ${status == "approved" ? "approved" : "rejected due to " + rejectionReason
      } for amount ${updatedTransactionRequest.amount}`,
      `Transaction request ${status == "approved" ? "approved" : "rejected"}`
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Transaction request updated successfully",
      data: updatedTransactionRequest,
    });
  } catch (error) {
    console.error("Error updating transaction request:", error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteTransactionRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Transaction request ID is required",
      });
    }

    // Check if user is admin
    if (req.admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete transaction requests",
      });
    }

    // Find the transaction request
    const transactionRequest = await TransactionRequest.findById(id);
    if (!transactionRequest) {
      return res.status(404).json({
        success: false,
        message: "Transaction request not found",
      });
    }

    // Delete the transaction request
    await TransactionRequest.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Transaction request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting transaction request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getMyTransactionRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, sortBy, sortOrder = 'desc' } = req.query;
    const userId = req.user._id;

    // Build filter object
    const filter = { userId };

    // Add status filter if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    // Add type filter if provided
    if (type && ['deposit', 'withdrawal'].includes(type)) {
      filter.type = type;
    }

    // Build sort object
    const sort = {};
    // Map underscore field names to camelCase for MongoDB
    const fieldMapping = {
      'created_at': 'createdAt',
      'updated_at': 'updatedAt'
    };

    let finalSortBy = 'createdAt';

    if (sortBy) {
      // Convert underscore to camelCase if needed
      finalSortBy = fieldMapping[sortBy] || sortBy;

      // Validate sortBy field (only allow certain fields for security)
      const allowedSortFields = ['createdAt', 'updatedAt', 'amount', 'status', 'type'];
      if (allowedSortFields.includes(finalSortBy)) {
        sort[finalSortBy] = sortOrder === 'desc' ? -1 : 1;
      } else {
        // Default sort by createdAt if invalid sortBy provided
        finalSortBy = 'createdAt';
        sort.createdAt = -1;
      }
    } else {
      // Default sort by createdAt descending
      sort.createdAt = -1;
    }

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get transaction requests with filters, sorting, and pagination
    const transactionRequests = await TransactionRequest.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .populate('userId', 'firstName lastName email')
      .populate('trader', 'firstName lastName email');

    // Get total count with same filters (for pagination)
    const total = await TransactionRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "My transaction requests fetched successfully",
      data: transactionRequests,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber),
        totalItems: total,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < Math.ceil(total / limitNumber),
        hasPrevPage: pageNumber > 1,
      },
      filters: {
        status: status || null,
        type: type || null,
      },
      sorting: {
        sortBy: finalSortBy,
        sortOrder: sortOrder || 'desc',
      },
    });
  } catch (error) {
    console.error("Error getting my transaction requests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = {
  createTransactionRequest,
  getTransactionRequests,
  getTransactionRequestById,
  updateTransactionRequest,
  deleteTransactionRequest,
  getMyTransactionRequests,
};
