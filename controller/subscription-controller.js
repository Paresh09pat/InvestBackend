const Subscription = require("../models/Subscription");
const { defaultPlans } = require("../config/constant");


const createDefaultSubscriptions = async () => {
    try {
        for (let plan of defaultPlans) {
            const exists = await Subscription.findOne({ name: plan.name });
            if (!exists) {
                await Subscription.create(plan);
                console.log(`Created subscription plan: ${plan.name}`);
            } else {
                console.log(`${plan.name} already exists`);
            }
        }
    } catch (err) {
        console.error("Error creating default subscriptions:", err.message);
    }
};

const getDefaultPlans = async (req,res) => {
    try {
        const plans = await Subscription.find();
        return res.status(200).json({
            message: "Subscription plans retrieved successfully",
            plans,
        });
    } catch (err) {
        console.error("Error fetching default plans:", err.message);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

const getSinglePlan = async (req,res)=>{
    try {
        const {id} = req.params
        const plan = await Subscription.findById(id).populate("traders");
        if (!plan) {
            return res.status(404).json({
                message: "Subscription plan not found",
            });
        }
        res.status(200).json({
            message: "Subscription plan retrieved successfully",
            plan,
        });
    } catch (err) {
        console.error("Error fetching subscription plan:", err.message);
    }
}


const updatePlans = async (req, res) => {
    try {
        const {name} = req.params
        const { 
            minAmount, 
            maxAmount, 
            minInterestRate, 
            maxInterestRate, 
            features, 
            duration, 
            description, 
            isActive 
        } = req.body;

        console.log("req.body",req.body)

        // Convert name to lowercase to match schema enum
        const planName = name.toLowerCase();
        
        // Map request fields to database fields
        const updateData = {
            minInvestment: minAmount,
            maxInvestment: maxAmount,
            minReturnRate: minInterestRate,
            maxReturnRate: maxInterestRate,
            features,
            duration,
            description,
            isActive
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        const updatedPlan = await Subscription.findOneAndUpdate(
            { name: planName }, 
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!updatedPlan) {
            return res.status(404).json({
                message: "Subscription plan not found",
            });
        }

        console.log("updatePlan",updatedPlan)
        res.status(200).json({
            message: "Subscription plan updated successfully",
            updatedPlan,
        });
    } catch (err) {
        console.error("Error updating subscription plans:", err.message);
        res.status(500).json({
            message: "Internal server error",
            error: err.message
        });
    }
};

module.exports = { createDefaultSubscriptions,getDefaultPlans,updatePlans,getSinglePlan }