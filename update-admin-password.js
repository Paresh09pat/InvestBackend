const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/investment_app';
    
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

const updateAdminPassword = async () => {
  try {
    await connectDB();
    
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
    const newPassword = "admin@123";
    
    // Hash the new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    
    // Find the admin user
    const admin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (!admin) {

      // Create new admin user
      const newAdmin = await User.create({
        name: "Admin",
        email: ADMIN_EMAIL,
        password: hashedPassword, // This will be hashed again by the pre-save middleware
        role: "admin",
        phone: "8985632145",
        isVerified: true,
        agree: true,
        verificationStatus: "verified"
      });
      
    } else {
      
      // Update the password
      admin.password = hashedPassword;
      await admin.save();
      
    }
    
    // Verify the password works
    const testAdmin = await User.findOne({ email: ADMIN_EMAIL });
    const isPasswordValid = bcrypt.compareSync(newPassword, testAdmin.password);
    
    if (isPasswordValid) {
      }
    
  } catch (error) {
    console.error("❌ Error updating admin password:", error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the update
updateAdminPassword();
