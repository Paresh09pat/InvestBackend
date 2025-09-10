const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify user authentication
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    console.log("token>>>>>", token);
    console.log("req.cookies.token>>>>>", req.cookies.token);
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
    
    req.user = user;
    next();
  } catch (error) {
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
      message: "Internal server error"
    });
  }
};

// Middleware to verify admin authentication
const authenticateAdmin = async (req, res, next) => {
  try {
    const adminToken = req.cookies.admin_token || req.headers.authorization?.split(' ')[1];
    
    if (!adminToken) {
      return res.status(401).json({ 
        message: "Admin token required" 
      });
    }
    
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET || 'fallback-secret-key');
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        message: "Admin access required" 
      });
    }
    
    req.admin = decoded;
    next();
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
};

// Middleware to check if user is verified for investment operations
const requireVerification = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        message: "User authentication required"
      });
    }
    
    if (user.verificationStatus !== 'verified') {
      return res.status(403).json({
        message: "Document verification required to access investment features",
        verificationStatus: user.verificationStatus
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error"
    });
  }
};

// Middleware to validate file uploads
const validateFileUpload = (req, res, next) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({
      message: 'No file uploaded'
    });
  }
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return res.status(400).json({
      message: 'File size too large. Maximum size is 10MB.'
    });
  }
  
  // Check file type
  const allowedMimes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ];
  
  if (!allowedMimes.includes(file.mimetype)) {
    return res.status(400).json({
      message: 'Only JPG, PNG, and PDF files are allowed'
    });
  }
  
  next();
};

// Middleware to validate document type
const validateDocumentType = (req, res, next) => {
  const { documentType } = req.body;
  
  if (!documentType || !['aadhaar', 'pan'].includes(documentType)) {
    return res.status(400).json({
      message: 'Invalid document type. Must be aadhaar or pan'
    });
  }
  
  next();
};

// Middleware to validate verification action
const validateVerificationAction = (req, res, next) => {
  const { action, rejectionReason } = req.body;
  
  if (!action || !['verify', 'reject'].includes(action)) {
    return res.status(400).json({
      message: 'Invalid action. Must be verify or reject'
    });
  }
  
  if (action === 'reject' && !rejectionReason?.trim()) {
    return res.status(400).json({
      message: 'Rejection reason is required when rejecting a document'
    });
  }
  
  next();
};

// Rate limiting middleware (simple implementation)
const rateLimitMap = new Map();

const rateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(clientId)) {
      rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const clientData = rateLimitMap.get(clientId);
    
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.'
      });
    }
    
    clientData.count++;
    next();
  };
};

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(clientId);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = {
  authenticateUser,
  authenticateAdmin,
  requireVerification,
  validateFileUpload,
  validateDocumentType,
  validateVerificationAction,
  rateLimit
};