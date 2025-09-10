const express = require("express");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const router = express.Router();
const jwt = require("jsonwebtoken");

// Input validation middleware
const validateRegistration = (req, res, next) => {
  const { name, email, phone, password, agree } = req.body;
  
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ 
      message: "All fields are required" 
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ 
      message: "Password must be at least 6 characters long" 
    });
  }
  
  if (!agree) {
    return res.status(400).json({ 
      message: "You must agree to the terms and conditions" 
    });
  }
  
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      message: "Email and password are required" 
    });
  }
  
  next();
};

// Registration route
router.post("/register", validateRegistration, async (req, res) => {
  try {
    const { name, email, phone, password, agree } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { phone }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ 
          message: "User with this email already exists" 
        });
      } else {
        return res.status(400).json({ 
          message: "User with this phone number already exists" 
        });
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      agree
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: "24h" }
    );
    
    // Set HTTP-only cookie

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in prod
      sameSite: "None", // allow cross-domain cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/", // optional, covers all routes
    });
    
    res.status(201).json({
      message: "User created successfully",
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      message: "Internal server error. Please try again later."
    });
  }
});

// Login route
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid Credentials" 
      });
    }
    
    // Check if user agreed to terms
    if (!user.agree) {
      return res.status(401).json({ 
        message: "Please agree to the terms and conditions" 
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid Credentials" 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: "24h" }
    );
    
    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000, 
      path: "/", 
    });
    
    res.status(200).json({
      message: "Login successful",
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: "Internal server error. Please try again later."
    });
  }
});

// Get user profile (protected route)
router.get("/profile", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        message: "Access token required" 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }
    
    res.status(200).json({
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: "Invalid token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token expired" 
      });
    }
    
    res.status(500).json({
      message: "Internal server error. Please try again later."
    });
  }
});

// Update user profile route
router.put("/profile", async (req, res) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        message: "Access token required" 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    const { name, phone } = req.body; // Removed email from allowed updates
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        message: "Name and phone are required"
      });
    }
    
    // Find and update user (only name and phone)
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      { 
        name: name.trim(), 
        phone: phone.trim() 
        // Email is intentionally excluded for security
      },
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }
    
    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser.toJSON()
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: "Invalid token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token expired" 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      message: "Internal server error. Please try again later."
    });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.status(200).json({
    message: "Logged out successfully"
  });
});

// Admin delete user route
router.delete("/admin/delete-user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    
    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required'
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }
    
    
    
    // Delete user documents from filesystem if they exist
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      // Delete Aadhaar document
      if (user.documents?.aadhaar?.filePath) {
        const aadhaarPath = path.join(__dirname, '..', user.documents.aadhaar.filePath);
        if (fs.existsSync(aadhaarPath)) {
          fs.unlinkSync(aadhaarPath);
          
        }
      }
      
      // Delete PAN document
      if (user.documents?.pan?.filePath) {
        const panPath = path.join(__dirname, '..', user.documents.pan.filePath);
        if (fs.existsSync(panPath)) {
          fs.unlinkSync(panPath);
          
        }
      }
    } catch (fileError) {
      console.error('Error deleting user documents:', fileError);
      // Continue with user deletion even if file deletion fails
    }
    
    // Delete user from database
    await User.findByIdAndDelete(userId);
    
    
    
    res.status(200).json({
      message: 'User deleted successfully',
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Get recent users for admin dashboard
router.get("/admin/recent-users", async (req, res) => {
  try {
    
    
    // Get recent users (last 10, sorted by join date)
    const recentUsers = await User.find({})
      .select('-password -documents') // Exclude sensitive data
      .sort({ joinDate: -1 }) // Sort by join date descending
      .limit(10);
    
    
    
    res.status(200).json({
      message: 'Recent users retrieved successfully',
      users: recentUsers
    });
    
  } catch (error) {
    console.error('Recent users error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Get admin dashboard statistics
router.get("/admin/stats", async (req, res) => {
  try {
    
    
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get verified users count
    const verifiedUsers = await User.countDocuments({ verificationStatus: 'verified' });
    
    // Get pending verification count
    const pendingVerifications = await User.countDocuments({ verificationStatus: 'pending' });
    
    // Get users with documents uploaded
    const usersWithDocuments = await User.countDocuments({
      $or: [
        { 'documents.aadhaar.status': { $exists: true } },
        { 'documents.pan.status': { $exists: true } }
      ]
    });
    
    // Calculate total invested amount (from user's totalInvested field)
    const totalInvestmentResult = await User.aggregate([
      {
        $group: {
          _id: null,
          totalInvested: { $sum: '$totalInvested' },
          totalBalance: { $sum: '$currentBalance' }
        }
      }
    ]);
    
    const totalInvested = totalInvestmentResult[0]?.totalInvested || 0;
    const totalBalance = totalInvestmentResult[0]?.totalBalance || 0;
    
    const stats = {
      totalUsers,
      verifiedUsers,
      pendingVerifications,
      usersWithDocuments,
      totalInvested,
      totalBalance,
      monthlyGrowth: 12.5, // This could be calculated from historical data
      platformHealth: 'Excellent'
    };
    
      
    
    res.status(200).json({
      message: 'Admin statistics retrieved successfully',
      stats
    });
    
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;
