const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const User = require('../models/User');
const { uploadProfilePicture, deleteFromCloudinary, deleteFromLocal, isCloudinaryConfigured } = require('../utils/cloudinaryUpload');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Test route to verify profile routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Profile routes are working!' });
});

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'), false);
    }
  }
});

// Test route for upload endpoint (without auth for testing)
router.post('/test-upload', upload.single('profilePicture'), (req, res) => {
  console.log('=== TEST UPLOAD ROUTE HIT ===');
  console.log('File:', req.file ? 'Present' : 'Not present');
  res.json({ message: 'Test upload route working!', file: req.file ? 'Present' : 'Not present' });
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  } else if (err) {
    console.error('Upload error:', err);
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Upload profile picture
router.post('/upload-profile-picture', authenticateUser, upload.single('profilePicture'), handleMulterError, async (req, res) => {
  try {
    console.log('=== PROFILE PICTURE UPLOAD ROUTE HIT ===');
    console.log('Profile picture upload request received');
    console.log('File:', req.file ? 'Present' : 'Not present');
    console.log('User ID:', req.user?._id);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log('User not found:', req.user._id);
      // Clean up temp file
      await fs.remove(req.file.path);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User found:', user.name, user.email);

    // Delete old profile picture if exists
    if (user.profilePicture) {
      try {
        if (isCloudinaryConfigured() && user.profilePicture.cloudinaryPublicId) {
          await deleteFromCloudinary(user.profilePicture.cloudinaryPublicId);
        } else if (user.profilePicture.localPath) {
          await deleteFromLocal(user.profilePicture.localPath);
        }
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue with upload even if deletion fails
      }
    }

    console.log('Uploading profile picture...');
    // Upload profile picture (Cloudinary or local fallback)
    const uploadResult = await uploadProfilePicture(req.file);
    console.log('Upload result:', uploadResult);

    // Update user profile picture
    user.profilePicture = {
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryUrl: uploadResult.secure_url,
      localPath: uploadResult.localPath || undefined,
      uploadedAt: new Date()
    };

    console.log('Saving user profile picture...');
    await user.save();
    console.log('User saved successfully');

    // Clean up temp file
    await fs.remove(req.file.path);
    console.log('Temp file cleaned up');

    const response = {
      message: 'Profile picture uploaded successfully',
      profilePicture: {
        url: uploadResult.secure_url,
        uploadedAt: user.profilePicture.uploadedAt
      },
      user: user
    };

    console.log('Sending response:', response);
    res.json(response);

  } catch (error) {
    console.error('Profile picture upload error:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up temp file if it exists
    if (req.file) {
      try {
        await fs.remove(req.file.path);
        console.log('Temp file cleaned up after error');
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    const errorResponse = { 
      message: error.message || 'Failed to upload profile picture' 
    };
    
    console.log('Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

// Delete profile picture
router.delete('/delete-profile-picture', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.profilePicture) {
      return res.status(400).json({ message: 'No profile picture to delete' });
    }

    // Delete from storage (Cloudinary or local)
    try {
      if (isCloudinaryConfigured() && user.profilePicture.cloudinaryPublicId) {
        await deleteFromCloudinary(user.profilePicture.cloudinaryPublicId);
      } else if (user.profilePicture.localPath) {
        await deleteFromLocal(user.profilePicture.localPath);
      }
    } catch (error) {
      console.error('Error deleting profile picture from storage:', error);
      // Continue with database update even if storage deletion fails
    }

    // Remove from user document
    user.profilePicture = undefined;
    await user.save();

    res.json({
      message: 'Profile picture deleted successfully',
      user: user
    });

  } catch (error) {
    console.error('Profile picture deletion error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete profile picture' 
    });
  }
});

module.exports = router;
