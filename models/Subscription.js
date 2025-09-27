const { Schema, model } = require("mongoose");


const subscriptionSchema = new Schema({
    name: {
        type: String,
        enum: ["silver", "gold", "platinum"]
    },
    minInvestment: {
        type: Number,
    },
    maxInvestment: {
        type: Number,
    },
    features: [{
        type: String
    }],
    minReturnRate: {
        type: Number,
    },
    maxReturnRate: {
        type: Number,
    },
    traders: [{
        type: Schema.Types.ObjectId,
        ref: "Trader"
    }]
})

const Subscription = model("Subscription", subscriptionSchema);

module.exports = Subscription;