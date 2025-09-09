const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs-extra');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Upload image to Cloudinary
const uploadToCloudinary = async (file, folder = 'investment-app') => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Please add Cloudinary credentials to your .env file.');
  }

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    });
    
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to Cloudinary');
  }
};

// Upload to local storage as fallback
const uploadToLocal = async (file, folder = 'uploads') => {
  try {
    const uploadDir = path.join(__dirname, '..', folder);
    await fs.ensureDir(uploadDir);
    
    // Use different prefixes based on folder type
    const prefix = folder.includes('profile') ? 'profile' : 'document';
    const fileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, fileName);
    
    await fs.copy(file.path, filePath);
    
    return {
      public_id: fileName,
      secure_url: `/uploads/${fileName}`,
      format: path.extname(file.originalname).slice(1),
      width: null,
      height: null,
      bytes: file.size,
      localPath: filePath
    };
  } catch (error) {
    console.error('Local upload error:', error);
    throw new Error('Failed to upload file locally');
  }
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary not configured, skipping deletion');
    return { result: 'ok' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

// Delete from local storage
const deleteFromLocal = async (filePath) => {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
    return { result: 'ok' };
  } catch (error) {
    console.error('Local delete error:', error);
    throw new Error('Failed to delete local file');
  }
};

// Upload profile picture (with fallback)
const uploadProfilePicture = async (file) => {
  if (isCloudinaryConfigured()) {
    return await uploadToCloudinary(file, 'investment-app/profile-pictures');
  } else {
    console.log('Using local storage for profile picture upload');
    return await uploadToLocal(file, 'uploads/profile-pictures');
  }
};

// Upload document (with fallback)
const uploadDocument = async (file) => {
  if (isCloudinaryConfigured()) {
    return await uploadToCloudinary(file, 'investment-app/documents');
  } else {
    console.log('Using local storage for document upload');
    return await uploadToLocal(file, 'uploads/documents');
  }
};

module.exports = {
  uploadToCloudinary,
  uploadToLocal,
  deleteFromCloudinary,
  deleteFromLocal,
  uploadProfilePicture,
  uploadDocument,
  isCloudinaryConfigured,
};
