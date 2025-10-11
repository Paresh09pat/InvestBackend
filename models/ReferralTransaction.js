const mongoose = require("mongoose");

const referralTransactionSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    referred: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    referredPlan: {
        type: String,
        enum: ["silver", "gold", "platinum"],
        required: true
    },
    referredDepositAmount: {
        type: Number,
        required: true,
        min: [0.01, "Deposit amount must be greater than 0"]
    },
    rewardAmount: {
        type: Number,
        required: true,
        min: [0, "Reward amount must be non-negative"]
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    rejectionReason: {
        type: String
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    approvedAt: {
        type: Date
    },
    transactionRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TransactionRequest",
        required: true
    }
}, { timestamps: true });

// Index for efficient queries
referralTransactionSchema.index({ referrer: 1, status: 1 });
referralTransactionSchema.index({ referred: 1 });
referralTransactionSchema.index({ status: 1, createdAt: -1 });

const ReferralTransaction = mongoose.model("ReferralTransaction", referralTransactionSchema);

module.exports = ReferralTransaction;
