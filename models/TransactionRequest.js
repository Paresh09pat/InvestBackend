const { Schema, model } = require("mongoose");

const transactionRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    plan: {
      type: String,
      enum: ["silver", "gold", "platinum"],
      required: true,
    },
    trader: [
      {
        type: Schema.Types.ObjectId,
        ref: "Trader",
      },
    ],
    type: {
      type: String,
      enum: ["deposit", "withdrawal"],
      required: true,
    },
    transactionImage: {
      type: String,
      required: true,
    },

    walletAddress: {
      type: String,
      // required: true,
    },
    walletTxId: {
      type: String,
      required: true,
    },

    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const TransactionRequest = model(
  "TransactionRequest",
  transactionRequestSchema
);

module.exports = TransactionRequest;
