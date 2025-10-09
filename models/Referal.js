const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
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
    rewardExpiresAt: {
        type: Date,
        required: true
    },
    rewardClaimed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Referral = mongoose.model("Referral", referralSchema);

module.exports = Referral;
