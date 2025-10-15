const User = require("../models/User");
const TransactionHistory = require("../models/TransactionHistory");
const TransactionRequest = require("../models/TransactionRequest");
const Portfolio = require("../models/Portfolio");
const Trader = require("../models/Trader");
const Subscription = require("../models/Subscription");

// Helper function to get date range
const getDateRange = (period = '30d') => {
  const now = new Date();
  let startDate;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
};

// Comprehensive Dashboard Analytics - Single endpoint with all data
const getComprehensiveDashboard = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Execute all analytics queries in parallel for maximum performance
    const [
      // User Analytics
      totalUsers,
      newUsers,
      verifiedUsers,
      userStats,
      verificationStats,
      userRegistrationTrends,
      documentStats,
      totalInvestment,
      portfolioStats,
      investmentTrends,
      topInvestors,
      investmentDistribution,

      // Transaction Analytics
      transactionStats,
      transactionTrends,
      statusDistribution,
      typeDistribution,
      planDistribution,

      // Trader Analytics
      traderStats,
      traderTypeDistribution,
      traderPerformance,

      // TransactionHistory Analytics
      transactionHistoryStats,
      transactionHistoryTrends,

      // Additional counts
      totalTransactions,
      totalTraders,
      totalSubscriptions,
      totalTransactionHistory
    ] = await Promise.all([
      // User Analytics
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      User.countDocuments({ verificationStatus: 'verified' }),

      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "verified"] }, 1, 0] }
            },
            pendingUsers: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "pending"] }, 1, 0] }
            },
            rejectedUsers: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "rejected"] }, 1, 0] }
            },
            unverifiedUsers: {
              $sum: { $cond: [{ $eq: ["$verificationStatus", "unverified"] }, 1, 0] }
            }
          }
        }
      ]),

      User.aggregate([
        {
          $group: {
            _id: "$verificationStatus",
            count: { $sum: 1 }
          }
        }
      ]),

      // User registration trends - monthly data
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      User.aggregate([
        {
          $group: {
            _id: null,
            usersWithAadhaar: {
              $sum: { $cond: [{ $ne: ["$documents.aadhaar", null] }, 1, 0] }
            },
            usersWithPan: {
              $sum: { $cond: [{ $ne: ["$documents.pan", null] }, 1, 0] }
            },
            verifiedAadhaar: {
              $sum: { $cond: [{ $eq: ["$documents.aadhaar.status", "verified"] }, 1, 0] }
            },
            verifiedPan: {
              $sum: { $cond: [{ $eq: ["$documents.pan.status", "verified"] }, 1, 0] }
            }
          }
        }
      ]),

      // Total investment from TransactionRequest (approved deposits)
      TransactionRequest.aggregate([
        {
          $match: {
            status: "approved",
            type: "deposit"
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]),

      // Portfolio statistics
      Portfolio.aggregate([
        {
          $group: {
            _id: null,
            totalPortfolios: { $sum: 1 },
            totalInvested: { $sum: "$totalInvested" },
            totalCurrentValue: { $sum: "$currentValue" },
            totalReturns: { $sum: "$totalReturns" },
            avgReturnPercentage: { $avg: "$totalReturnsPercentage" },
            profitablePortfolios: {
              $sum: { $cond: [{ $gt: ["$totalReturns", 0] }, 1, 0] }
            },
            lossMakingPortfolios: {
              $sum: { $cond: [{ $lt: ["$totalReturns", 0] }, 1, 0] }
            }
          }
        }
      ]),

      // Investment trends - monthly data from TransactionRequest
      TransactionRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: "approved"
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            totalAmount: { $sum: "$amount" },
            depositAmount: {
              $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] }
            },
            withdrawalAmount: {
              $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] }
            }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // Top investors from TransactionRequest
      TransactionRequest.aggregate([
        {
          $match: {
            status: "approved",
            type: "deposit"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        },
        {
          $group: {
            _id: "$userId",
            name: { $first: "$user.name" },
            email: { $first: "$user.email" },
            totalInvested: { $sum: "$amount" },
            verificationStatus: { $first: "$user.verificationStatus" }
          }
        },
        { $sort: { totalInvested: -1 } },
        { $limit: 10 }
      ]),

      // Investment distribution from TransactionRequest
      TransactionRequest.aggregate([
        {
          $match: {
            status: "approved",
            type: "deposit"
          }
        },
        {
          $group: {
            _id: "$userId",
            totalInvested: { $sum: "$amount" }
          }
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lte: ["$totalInvested", 10000] }, then: "0-10K" },
                  { case: { $lte: ["$totalInvested", 50000] }, then: "10K-50K" },
                  { case: { $lte: ["$totalInvested", 100000] }, then: "50K-100K" },
                  { case: { $lte: ["$totalInvested", 500000] }, then: "100K-500K" },
                  { case: { $gt: ["$totalInvested", 500000] }, then: "500K+" }
                ],
                default: "Unknown"
              }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalInvested" }
          }
        },
        { $sort: { "_id": 1 } }
      ]),

      // Transaction statistics from TransactionRequest
      TransactionRequest.aggregate([
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
            maxAmount: { $max: "$amount" },
            minAmount: { $min: "$amount" },
            approvedTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            },
            totalDeposits: {
              $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] }
            },
            totalWithdrawals: {
              $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] }
            }
          }
        }
      ]),

      // Transaction trends - monthly data from TransactionRequest
      TransactionRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // Transaction status distribution
      TransactionRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]),

      // Transaction type distribution
      TransactionRequest.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" }
          }
        }
      ]),

      // Plan distribution from TransactionRequest
      TransactionRequest.aggregate([
        {
          $group: {
            _id: "$plan",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" }
          }
        }
      ]),

      // Trader statistics
      Trader.aggregate([
        {
          $group: {
            _id: null,
            totalTraders: { $sum: 1 },
            avgExperience: { $avg: "$experience" },
            maxExperience: { $max: "$experience" },
            minExperience: { $min: "$experience" },
            avgMinRate: { $avg: "$minInterstRate" },
            avgMaxRate: { $avg: "$maxInterstRate" },
            avgMinInvestment: { $avg: "$minInvestment" },
            avgMaxInvestment: { $avg: "$maxInvestment" }
          }
        }
      ]),

      // Trader type distribution
      Trader.aggregate([
        {
          $group: {
            _id: "$traderType",
            count: { $sum: 1 },
            avgExperience: { $avg: "$experience" },
            avgMinRate: { $avg: "$minInterstRate" },
            avgMaxRate: { $avg: "$maxInterstRate" }
          }
        }
      ]),

      // Trader performance from TransactionRequest
      TransactionRequest.aggregate([
        {
          $unwind: "$trader"
        },
        {
          $lookup: {
            from: "traders",
            localField: "trader",
            foreignField: "_id",
            as: "traderInfo"
          }
        },
        {
          $unwind: "$traderInfo"
        },
        {
          $group: {
            _id: "$trader",
            traderName: { $first: "$traderInfo.name" },
            traderType: { $first: "$traderInfo.traderType" },
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
            approvedTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedTransactions: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            successRate: {
              $cond: [
                { $gt: ["$totalTransactions", 0] },
                {
                  $multiply: [
                    { $divide: ["$approvedTransactions", "$totalTransactions"] },
                    100
                  ]
                },
                0
              ]
            }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]),

      // TransactionHistory statistics
      TransactionHistory.aggregate([
        {
          $group: {
            _id: null,
            totalTransactionHistory: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
            maxAmount: { $max: "$amount" },
            minAmount: { $min: "$amount" },
            approvedHistory: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingHistory: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedHistory: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            },
            totalDepositsHistory: {
              $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] }
            },
            totalWithdrawalsHistory: {
              $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] }
            }
          }
        }
      ]),

      // TransactionHistory trends - monthly data
      TransactionHistory.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
            }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // Additional counts
      TransactionRequest.countDocuments(),
      Trader.countDocuments(),
      Subscription.countDocuments(),
      TransactionHistory.countDocuments()
    ]);

    // Calculate growth rates and metrics
    const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousPeriodUsers = await User.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: startDate }
    });

    const userGrowthRate = previousPeriodUsers > 0
      ? ((newUsers - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(2)
      : newUsers > 0 ? 100 : 0;

    const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0;
    const transactionSuccessRate = totalTransactions > 0
      ? (transactionStats[0]?.approvedTransactions / totalTransactions * 100).toFixed(2)
      : 0;

    const platformHealthScore = (
      (parseFloat(verificationRate) * 0.3) +
      (parseFloat(transactionSuccessRate) * 0.4) +
      (parseFloat(userGrowthRate) * 0.3)
    ).toFixed(2);

    // Comprehensive dashboard data
    const dashboardData = {
      // Overview Cards
      overview: {
        totalUsers,
        newUsers,
        verifiedUsers,
        totalInvestment: totalInvestment[0]?.total || 0,
        totalTransactions,
        totalTraders,
        totalSubscriptions,
        totalTransactionHistory,
        userGrowthRate: parseFloat(userGrowthRate),
        verificationRate: parseFloat(verificationRate),
        platformHealthScore: parseFloat(platformHealthScore)
      },

      // User Analytics
      users: {
        stats: userStats[0] || {},
        verificationDistribution: verificationStats,
        registrationTrends: userRegistrationTrends,
        documentStats: documentStats[0] || {}
      },

      // Financial Analytics
      financial: {
        portfolioStats: portfolioStats[0] || {},
        investmentTrends,
        topInvestors,
        investmentDistribution
      },

      // Transaction Analytics
      transactions: {
        stats: transactionStats[0] || {},
        trends: transactionTrends,
        statusDistribution,
        typeDistribution,
        planDistribution,
        successRate: parseFloat(transactionSuccessRate)
      },

      // Trader Analytics
      traders: {
        stats: traderStats[0] || {},
        typeDistribution: traderTypeDistribution,
        performance: traderPerformance
      },

      // TransactionHistory Analytics
      transactionHistory: {
        stats: transactionHistoryStats[0] || {},
        trends: transactionHistoryTrends
      },

      // Chart Data for Visualizations
      charts: {
        // User registration over time (monthly)
        userRegistrationChart: userRegistrationTrends.map(item => ({
          date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
          users: item.count
        })),

        // Investment trends over time (monthly)
        investmentTrendsChart: investmentTrends.map(item => ({
          date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
          deposits: item.depositAmount,
          withdrawals: item.withdrawalAmount,
          total: item.totalAmount
        })),

        // Transaction trends over time (monthly)
        transactionTrendsChart: transactionTrends.map(item => ({
          date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
          approved: item.approvedCount,
          pending: item.pendingCount,
          rejected: item.rejectedCount,
          total: item.count
        })),

        // TransactionHistory trends over time (monthly)
        transactionHistoryTrendsChart: transactionHistoryTrends.map(item => ({
          date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
          approved: item.approvedCount,
          pending: item.pendingCount,
          rejected: item.rejectedCount,
          total: item.count
        })),

        // Verification status donut chart
        verificationDonutChart: verificationStats.map(item => ({
          status: item._id,
          count: item.count
        })),

        // Transaction status donut chart
        transactionStatusDonutChart: statusDistribution.map(item => ({
          status: item._id,
          count: item.count,
          amount: item.totalAmount
        })),

        // Transaction type donut chart
        transactionTypeDonutChart: typeDistribution.map(item => ({
          type: item._id,
          count: item.count,
          amount: item.totalAmount
        })),

        // Plan distribution donut chart (Silver, Gold, Platinum)
        planDistributionDonutChart: planDistribution.map(item => ({
          plan: item._id,
          count: item.count,
          amount: item.totalAmount,
          avgAmount: item.avgAmount
        })),

        // Trader type donut chart (Silver, Gold, Platinum)
        traderTypeDonutChart: traderTypeDistribution.map(item => ({
          type: item._id,
          count: item.count,
          avgExperience: item.avgExperience,
          avgMinRate: item.avgMinRate,
          avgMaxRate: item.avgMaxRate
        })),

        // Investment distribution donut chart
        investmentDistributionDonutChart: investmentDistribution.map(item => ({
          range: item._id,
          count: item.count,
          amount: item.totalAmount
        }))
      },

      // Period information
      period: {
        startDate,
        endDate,
        period
      }
    };

    res.status(200).json({
      message: "Comprehensive dashboard data retrieved successfully",
      data: dashboardData
    });

  } catch (error) {
    console.error("Comprehensive dashboard error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

const homeAnalytics = async (req, res) => {
  try {
    const totalAmountInvestedResult = await TransactionRequest.aggregate([
      {
        $match: {
          status: "approved",
          type: "deposit"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    // ✅ Count total users excluding admins
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

    // ✅ Sum of total returns
    const totalReturnsResult = await Portfolio.aggregate([
      {
        $match: {
          totalReturns: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalReturns" }
        }
      }
    ]);

    // ✅ Extract numbers only (no arrays, no _id)
    const totalAmountInvested = totalAmountInvestedResult[0]?.total || 0;
    const totalReturns = totalReturnsResult[0]?.total || 0;

    // ✅ Send clean response
    return res.status(200).json({
      message: "Home analytics retrieved successfully",
      data: {
        totalAmountInvested,
        totalUsers,
        totalReturns
      }
    });

  } catch (err) {
    console.error("Err", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
};


// Export analytics function
module.exports = {
  getComprehensiveDashboard,
  homeAnalytics
};
