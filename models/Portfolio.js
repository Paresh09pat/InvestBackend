const { Schema, model } = require("mongoose");

const priceHistorySchema = new Schema({
  value: { type: Number, required: true }, 
  updatedAt: { type: Date, default: Date.now },
});

const portfolioSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalInvested: {
      type: Number,
      default: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    totalReturns: {
      type: Number,
      default: 0,
    },
    totalReturnsPercentage: {
      type: Number,
      default: 0,
    },

    // NEW: store price history for charting
    priceHistory: [priceHistorySchema],
  },
  { timestamps: true }
);

const Portfolio = model("Portfolio", portfolioSchema)

module.exports = Portfolio;
