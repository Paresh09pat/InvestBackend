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
      min: [0.01, "Amount must be greater than 0"],
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
      // Required only for deposits, optional for withdrawals
    },
    walletAddress: {
      type: String,
      // required: true,
    },
    walletTxId: {
      type: String,
      // Optional for both deposit and withdrawal
    },
    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Custom validation for transactionImage based on type
transactionRequestSchema.pre('validate', function(next) {
  if (this.type === 'deposit' && !this.transactionImage) {
    this.invalidate('transactionImage', 'Transaction image is required for deposits');
  }
  next();
});

const TransactionRequest = model(
  "TransactionRequest",
  transactionRequestSchema
);

module.exports = TransactionRequest;
