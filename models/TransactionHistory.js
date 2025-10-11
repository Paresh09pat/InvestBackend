const { Schema, model } = require("mongoose");

const transactionHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    type: {
      type: String,
      enum: ["deposit", "withdrawal", "investment"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },
    txnReqId: {
      type: Schema.Types.ObjectId,
      ref: "TransactionRequest",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const TransactionHistory = model(
  "TransactionHistory",
  transactionHistorySchema
);

module.exports = TransactionHistory;
