const mongoose = require("mongoose");
const Portfolio = require("../models/Portfolio");
const TransactionRequest = require("../models/TransactionRequest");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const {
  createAdminNoitification,
  createNotification,
} = require("./notification-controller");
const { createTransactionHistory } = require("./transactionhistory-controller");
const TransactionHistory = require("../models/TransactionHistory");

const createTransactionRequest = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    const { amount, type, plan, trader, walletAddress, walletTxId } = req.body;
    // console.log("Body>>>", req.body);
    const userId = req.user._id;
    const transactionImage = req.file;

    const uploadResult = await uploadToCloudinary(transactionImage);
    const transactionImageUrl = uploadResult.secure_url;

    // Validate required fields
    if (!amount || !type || !plan || !walletTxId || !trader || !walletAddress) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: amount, type, plan, walletTxId, and transaction image, trader",
          "All fields are required: amount, type, plan, walletAddress, walletTxId, and transaction image, trader, walletAddress",
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
      trader: [trader], // Convert to array as per model schema
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
    const { type, plan, status, rejectionReason } = req.body;

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

    // === PORTFOLIO UPDATE ===
    if (updateData.status === "approved") {
      let portfolio = await Portfolio.findOne({
        user: updatedTransactionRequest.userId,
      }).session(session);

      if (!portfolio) {
        // create new portfolio
        portfolio = new Portfolio({
          user: updatedTransactionRequest.userId,
          totalInvested: updatedTransactionRequest.amount,
          currentValue: updatedTransactionRequest.amount,
          totalReturns: 0,
          totalReturnsPercentage: 0,
        });
      } else {
        // deposit increases, withdrawal decreases
        if (updatedTransactionRequest.type === "deposit") {
          portfolio.totalInvested += updatedTransactionRequest.amount;
          portfolio.currentValue += updatedTransactionRequest.amount;
        } else if (updatedTransactionRequest.type === "withdrawal") {
          portfolio.totalInvested -= updatedTransactionRequest.amount;
          portfolio.currentValue -= updatedTransactionRequest.amount;
        }
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
      `Your transaction request has been ${
        status == "approved" ? "approved" : "rejected due to " + rejectionReason
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
