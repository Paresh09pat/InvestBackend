const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { createDefaultSubscriptions } = require("../controller/subscription-controller");


dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/investment_app';
    
    // Connect to MongoDB without deprecated options
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};



createDefaultSubscriptions();



module.exports = connectDB;
