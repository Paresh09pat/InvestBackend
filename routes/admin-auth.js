// server/routes/admin-auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const router = express.Router();

// Predefined admin (hashed password for security)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET ;

// Hash admin password if not already hashed
let hashedAdminPassword;
try {
  hashedAdminPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
} catch (error) {
  console.error('Error hashing admin password:', error);
  hashedAdminPassword = bcrypt.hashSync('admin123', 10); // fallback
}

// Admin login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Check if email matches admin email
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        return res.status(400).json({ 
        message: "Invalid admin credentials" 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, hashedAdminPassword);
    
    if (!isMatch) {
      return res.status(400).json({ 
        message: "Invalid admin credentials" 
      });
    }

    // Generate JWT token
    const adminToken = jwt.sign(
      { 
        name: 'Super Admin',
        role: "admin", 
        email: email.toLowerCase(),
        isAdmin: true
      }, 
      JWT_SECRET, 
      { 
        expiresIn: "24h" 
      }
    );

    // Set HTTP-only cookie for admin
    res.cookie('admin_token', adminToken, {
      httpOnly: true,
      secure: false, // Set to false for development
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      path: '/' // Explicitly set path
    });

    // Return success response
    res.status(200).json({ 
      message: "Admin login successful", 
      user: {
        name: 'Super Admin',
        email: email.toLowerCase(),
        role: 'admin',
        isAdmin: true
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      message: "Internal server error during admin login" 
    });
  }
});

// Admin profile route (protected)
router.get("/profile", async (req, res) => {
  try {
    
    const adminToken = req.cookies.admin_token || req.headers.authorization?.split(' ')[1];
    
    
    if (!adminToken) {
      return res.status(401).json({ 
        message: "Admin token required" 
      });
    }
    
    const decoded = jwt.verify(adminToken, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        message: "Admin access required" 
      });
    }
    
    
    // Check if token is close to expiry (less than 2 hours remaining)
    const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = tokenExpiry - now;
    const twoHours = 2 * 60 * 60 * 1000;
    
    if (timeUntilExpiry < twoHours && timeUntilExpiry > 0) {
      
      // Generate new token
      const newAdminToken = jwt.sign(
        { 
          name: 'Super Admin',
          role: "admin", 
          email: decoded.email,
          isAdmin: true
        }, 
        JWT_SECRET, 
        { 
          expiresIn: "24h" 
        }
      );

      // Set new cookie
      res.cookie('admin_token', newAdminToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });
      
    }
    
    res.status(200).json({
      message: "Admin profile retrieved successfully",
      user: {
        name: decoded.name || 'Super Admin',
        email: decoded.email,
        role: decoded.role,
        isAdmin: decoded.isAdmin
      }
    });
    
  } catch (error) {
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: "Invalid admin token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Admin token expired" 
      });
    }
    
    res.status(500).json({
      message: "Internal server error"
    });
  }
});

// Admin logout route
router.post("/logout", (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: false, // Set to false for development
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    path: '/' // Explicitly set path
  });
  
  res.status(200).json({
    message: "Admin logged out successfully"
  });
});

module.exports = router;
