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
    
    console.log("🔐 Hashing password for:", ADMIN_EMAIL);
    console.log("🔑 New hashed password:", hashedPassword);
    
    // Find the admin user
    const admin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (!admin) {
      console.log("❌ Admin user not found with email:", ADMIN_EMAIL);
      console.log("📝 Creating new admin user...");
      
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
      
      console.log("✅ New admin user created successfully");
      console.log("👤 Admin ID:", newAdmin._id);
    } else {
      console.log("👤 Found existing admin user:", admin.email);
      
      // Update the password
      admin.password = hashedPassword;
      await admin.save();
      
      console.log("✅ Admin password updated successfully");
      console.log("👤 Admin ID:", admin._id);
    }
    
    // Verify the password works
    const testAdmin = await User.findOne({ email: ADMIN_EMAIL });
    const isPasswordValid = bcrypt.compareSync(newPassword, testAdmin.password);
    
    if (isPasswordValid) {
      console.log("✅ Password verification successful - login should work");
    } else {
      console.log("❌ Password verification failed");
    }
    
    console.log("\n📋 Summary:");
    console.log("Email:", ADMIN_EMAIL);
    console.log("New Password:", newPassword);
    console.log("Hashed Password:", hashedPassword);
    
  } catch (error) {
    console.error("❌ Error updating admin password:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
};

// Run the update
updateAdminPassword();
