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

const getDefaultPlans = async () => {
  try {
    const plans = await Subscription.find();
    return plans;
  } catch (err) {
    console.error("Error fetching default plans:", err.message);
    return [];
  }
};

const updatePlans = async (plans) => {
  try {
    for (let plan of plans) {
      await Subscription.findOneAndUpdate({ name: plan.name }, plan);
      console.log(`Updated subscription plan: ${plan.name}`);
    }
  } catch (err) {
    console.error("Error updating subscription plans:", err.message);
  }
};

module.exports = {createDefaultSubscriptions}