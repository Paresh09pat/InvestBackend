const TransactionHistory = require("../models/TransactionHistory");

const createTransactionHistory = async (req, res) => {
  try {
    const { userId, amount, type, status, txnReqId } = req.body;

    const transactionHistory = await TransactionHistory.create({
      userId,
      amount,
      type,
      status,
      txnReqId,
    });

    res.status(201).json({
      success: true,
      message: "Transaction history created successfully",
      data: transactionHistory,
    });
  } catch (error) {
    console.error("Error creating transaction history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all transaction history
const getTransactionHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      startDate,
      endDate,
    } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Add date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add 23:59:59 to endDate to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    const transactionHistory = await TransactionHistory.find(filter)
      .populate("userId", "name email")
      .populate("txnReqId", "plan type walletAddress walletTxId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TransactionHistory.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Transaction history fetched successfully",
      data: transactionHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
      filters: {
        status,
        type,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("Error getting transaction history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get transaction history by ID
const getTransactionHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const transactionHistory = await TransactionHistory.findById(id)
      .populate("userId", "name email phone")
      .populate(
        "txnReqId",
        "plan type walletAddress walletTxId transactionImage"
      );

    if (!transactionHistory) {
      return res.status(404).json({
        success: false,
        message: "Transaction history not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully",
      data: transactionHistory,
    });
  } catch (error) {
    console.error("Error getting transaction history by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getMyTransactionHistory = async (req, res) => {
  try {
    const { status, type, date, minAmount, maxAmount, sortBy, sortOrder, page = 1, limit = 10 } = req.query;
    const filter = {};

    // filtering
    if (status) filter.status = status;
    if (type) filter.type = type;

    // filter by specific date (whole day range)
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // filter by amount range
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    const userId = req.user._id;

    // sorting (default: newest first)
    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }

    // pagination
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    const [transactionHistory, total] = await Promise.all([
      TransactionHistory.find({ userId, ...filter })
        .populate("userId", "name email phone")
        .populate("txnReqId", "plan type walletAddress walletTxId")
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize),
      TransactionHistory.countDocuments({ userId, ...filter }),
    ]);

    res.status(200).json({
      success: true,
      message: "My transaction history fetched successfully",
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: transactionHistory,
    });
  } catch (err) {
    console.log("Error getting my transaction history:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};



module.exports = {
  createTransactionHistory,
  getTransactionHistory,
  getTransactionHistoryById,
  getMyTransactionHistory,
};
