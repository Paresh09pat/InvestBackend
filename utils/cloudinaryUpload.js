const cloudinary = require('../config/cloudinary')
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
};



const uploadToCloudinary = async (file, folder = "investment-app") => {
  if (!file) {
    throw new Error("No file provided for upload");
  }

  if (!file.buffer) {
    throw new Error("No file buffer provided for upload. Make sure you're using memory storage in multer.");
  }

  // Convert buffer → base64 string
  const base64File = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  try {
    const result = await cloudinary.uploader.upload(base64File, {
      folder,
      resource_type: "auto",
      quality: "auto",
      fetch_format: "auto",
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
    console.error("Cloudinary Upload Error:", error);
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
};


module.exports = uploadToCloudinary;



// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    throw new Error("No publicId provided for deletion");
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image", // or "video", or "raw", depending on file type
    });

    return result; // { result: "ok" } if deleted successfully
  } catch (error) {
    console.error("Cloudinary Deletion Error:", error);
    throw new Error("Failed to delete file from Cloudinary");
  }
};


// Upload profile picture (with fallback)
const uploadProfilePicture = async (file) => {
  if (isCloudinaryConfigured()) {
    return await uploadToCloudinary(file, 'investment-app/profile-pictures');
  }
};

// Upload document (with fallback)
const uploadDocument = async (file) => {

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Please add Cloudinary credentials to your .env file.');
  }
  return await uploadToCloudinary(file, 'investment-app/documents');

};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadProfilePicture,
  uploadDocument,
  isCloudinaryConfigured,
};
