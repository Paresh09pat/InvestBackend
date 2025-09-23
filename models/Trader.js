const { Schema, model } = require("mongoose");
const traderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    description: {
      type: String,
    },
    phone: {
      type: String,
    },
    traderType: {
      type: String,
      enum: ["silver", "gold", "platinum"],
      default: "silver",
    },
    minInterstRate: {
      type: Number,
    },
    maxInterstRate: {
      type: Number,
    },
    minInvestment: {
      type: Number,
    },
    maxInvestment: {
      type: Number,
    },
    experience: {
      type: Number,
      default: 0,
    },
    profilePicture: {
      type: String,
    },
  },
  { timestamps: true }
);

const Trader = model("Trader", traderSchema);

module.exports = Trader;