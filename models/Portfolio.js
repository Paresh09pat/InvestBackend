const { Schema, model } = require("mongoose");

const priceHistorySchema = new Schema({
  value: { type: Number, required: true }, 
  updatedAt: { type: Date, default: Date.now },
},{id:false});

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
    referralRewards: {
      type: Number,
      default: 0,
    },
    referralAmount: {
      type: Number,
      default: 0,
    },

    // Per-plan breakdown to attribute investments and returns
    plans: [
      {
        name: {
          type: String,
          enum: ["silver", "gold", "platinum"],
          required: true,
        },
        invested: {
          type: Number,
          default: 0,
        },
        currentValue: {
          type: Number,
          default: 0,
        },
        returns: {
          type: Number,
          default: 0,
        },
        returnRate: {
          min: { type: Number },
          max: { type: Number },
        },
        // Per-plan price history for charting
        priceHistory: [priceHistorySchema],
      },
    ],
  },
  { timestamps: true }
);

const Portfolio = model("Portfolio", portfolioSchema)

module.exports = Portfolio;
