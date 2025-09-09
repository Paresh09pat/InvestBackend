const express = require('express');
const User = require('../models/User');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const { 
  authenticateUser, 
  authenticateAdmin, 
  validateFileUpload, 
  validateDocumentType, 
  validateVerificationAction,
  rateLimit 
} = require('../middleware/auth');
const { uploadDocument, deleteFromCloudinary } = require('../utils/cloudinaryUpload');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

// Upload document route with rate limiting
router.post('/upload', 
  rateLimit(15 * 60 * 1000, 10), // 10 uploads per 15 minutes
  authenticateUser, 
  uploadSingle, 
  handleUploadError, 
  validateFileUpload,
  validateDocumentType,
  async (req, res) => {
  try {
    const { documentType } = req.body;
    const file = req.file;
    
    // Check if user already has a document of this type
    const existingDoc = req.user.documents[documentType];
    if (existingDoc && existingDoc.cloudinaryPublicId) {
      // Delete old file from Cloudinary
      try {
        await deleteFromCloudinary(existingDoc.cloudinaryPublicId);
      } catch (error) {
        console.error('Error deleting old file from Cloudinary:', error);
      }
    }
    
    // Upload to Cloudinary or local storage
    const uploadResult = await uploadDocument(file);
    
    // Update user document with all required fields
    const documentData = {
      fileName: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
      localPath: uploadResult.localPath || undefined,
      status: 'pending',
      uploadedAt: new Date()
    };
    
    const updateData = {
      [`documents.${documentType}`]: documentData,
      verificationStatus: 'pending'
    };
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    // Clean up temp file after successful Cloudinary upload
    try {
      await fs.remove(file.path);
    } catch (cleanupError) {
      console.error('Error cleaning up temp file:', cleanupError);
    }
    
    res.status(200).json({
      message: 'Document uploaded successfully',
      user: updatedUser.toJSON()
    });
    
  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Get user documents route
router.get('/documents', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('documents verificationStatus');
    
    res.status(200).json({
      documents: user.documents,
      verificationStatus: user.verificationStatus
    });
    
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Admin routes for document verification

// Get all users with pending documents
router.get('/admin/pending', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({
      verificationStatus: 'pending'
    }).select('name email phone documents verificationStatus totalInvested currentBalance createdAt');
    
    res.status(200).json({
      users: users
    });
    
  } catch (error) {
    console.error('Get pending documents error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Get all users for admin management
router.get('/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    let filter = {};
    if (status !== 'all') {
      filter.verificationStatus = status;
    }
    
    const users = await User.find(filter)
      .select('name email phone documents verificationStatus totalInvested currentBalance createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      users: users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total: total
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// Test admin authentication
router.get('/admin/test-auth', authenticateAdmin, async (req, res) => {
  res.json({
    message: 'Admin authentication working',
    admin: req.admin
  });
});

// Verify/reject document with rate limiting
router.post('/admin/verify', 
  rateLimit(15 * 60 * 1000, 50), // 50 verifications per 15 minutes
  authenticateAdmin, 
  validateVerificationAction,
  async (req, res) => {
  try {
    const { userId, documentType, action, rejectionReason } = req.body;
    
    console.log('Document verification request:', { userId, documentType, action, rejectionReason });
    console.log('Admin info:', req.admin);
    
    if (!userId) {
      return res.status(400).json({
        message: 'userId is required'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({
        message: 'User not found'
      });
    }
    
    console.log('User found:', user.name, user.email);
    console.log('User documents:', user.documents);
    
    const document = user.documents[documentType];
    if (!document) {
      console.log('Document not found:', documentType);
      return res.status(404).json({
        message: 'Document not found'
      });
    }
    
    // Update document status
    const updateData = {
      [`documents.${documentType}.status`]: action === 'verify' ? 'verified' : 'rejected',
      [`documents.${documentType}.verifiedAt`]: new Date(),
      [`documents.${documentType}.verifiedBy`]: req.admin.email || 'admin'
    };
    
    if (action === 'reject' && rejectionReason) {
      updateData[`documents.${documentType}.rejectionReason`] = rejectionReason;
    }
    
    // Check if both documents are verified to update overall verification status
    const aadhaarStatus = documentType === 'aadhaar' ? 
      (action === 'verify' ? 'verified' : 'rejected') : 
      user.documents.aadhaar?.status;
    
    const panStatus = documentType === 'pan' ? 
      (action === 'verify' ? 'verified' : 'rejected') : 
      user.documents.pan?.status;
    
    if (aadhaarStatus === 'verified' && panStatus === 'verified') {
      updateData.verificationStatus = 'verified';
      updateData.isVerified = true;
    } else if (action === 'reject') {
      updateData.verificationStatus = 'rejected';
    }
    
    console.log('Update data:', updateData);
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      console.log('Failed to update user:', userId);
      return res.status(500).json({
        message: 'Failed to update user document status'
      });
    }
    
    console.log('User updated successfully:', updatedUser.name);
    console.log('Updated document status:', updatedUser.documents[documentType]?.status);
    console.log('Updated verification status:', updatedUser.verificationStatus);
    
    res.status(200).json({
      message: `Document ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
      user: updatedUser.toJSON()
    });
    
  } catch (error) {
    console.error('Document verification error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        message: 'Validation error',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get document file for admin review
router.get('/admin/document/:userId/:documentType', authenticateAdmin, async (req, res) => {
  try {
    const { userId, documentType } = req.params;
    
    if (!['aadhaar', 'pan'].includes(documentType)) {
      return res.status(400).json({
        message: 'Invalid document type'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }
    
    const document = user.documents[documentType];
    if (!document) {
      return res.status(404).json({
        message: 'Document not found'
      });
    }
    
    // Check if document has Cloudinary URL (new uploads)
    if (document.cloudinaryUrl) {
      // Redirect to Cloudinary URL for viewing
      return res.redirect(document.cloudinaryUrl);
    }
    
    // Fallback to local file (old uploads)
    if (!document.filePath) {
      return res.status(404).json({
        message: 'Document file not found'
      });
    }
    
    // Check if file exists
    const fileExists = await fs.pathExists(document.filePath);
    if (!fileExists) {
      return res.status(404).json({
        message: 'Document file not found'
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Get document file error:', error);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;
