const mongoose = require("mongoose");

const investRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    walletAddress: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      enum: ["silver", "gold", "platinum"],
      
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

const InvestRequest = mongoose.model("InvestRequest", investRequestSchema);

module.exports = InvestRequest;
