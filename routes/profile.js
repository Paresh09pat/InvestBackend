const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const User = require("../models/User");
const {
  uploadProfilePicture,
  deleteFromCloudinary,
  deleteFromLocal,
  isCloudinaryConfigured,
} = require("../utils/cloudinaryUpload");
const { authenticateUser } = require("../middleware/auth");
const { handleMulterError, upload } = require("../config/utils");

const router = express.Router();

// Test route to verify profile routes are working
router.get("/test", (req, res) => {
  res.json({ message: "Profile routes are working!" });
});

router.post("/test-upload", upload.single("profilePicture"), (req, res) => {
  res.json({
    message: "Test upload route working!",
    file: req.file ? "Present" : "Not present",
  });
});

// Upload profile picture
router.post(
  "/upload-profile-picture",
  authenticateUser,
  upload.single("profilePicture"),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        // Clean up temp file
        await fs.remove(req.file.path);
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (user.profilePicture) {
        try {
          if (
            isCloudinaryConfigured() &&
            user.profilePicture.cloudinaryPublicId
          ) {
            await deleteFromCloudinary(user.profilePicture.cloudinaryPublicId);
          } else if (user.profilePicture.localPath) {
            await deleteFromLocal(user.profilePicture.localPath);
          }
        } catch (error) {
          // Continue with upload even if deletion fails
        }
      }

      // Upload profile picture (Cloudinary or local fallback)
      const uploadResult = await uploadProfilePicture(req.file);

      // Update user profile picture
      user.profilePicture = {
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        uploadedAt: new Date(),
      };

      await user.save();

      const response = {
        success: true,
        message: "Profile picture uploaded successfully",
        profilePicture: {
          url: uploadResult.secure_url,
          uploadedAt: user.profilePicture.uploadedAt,
        },
        user: user,
      };

      res.json(response);
    } catch (error) {
      console.error("Error stack:", error.stack);

      // Clean up temp file if it exists
      if (req.file) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }

      const errorResponse = {
        success: false,
        message: error.message || "Failed to upload profile picture",
      };

      res.status(500).json(errorResponse);
    }
  }
);

// Delete profile picture
router.delete("/delete-profile-picture", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.profilePicture) {
      return res.status(400).json({ success: false, message: "No profile picture to delete" });
    }

    // Delete from storage (Cloudinary or local)
    try {
      if (isCloudinaryConfigured() && user.profilePicture.cloudinaryPublicId) {
        await deleteFromCloudinary(user.profilePicture.cloudinaryPublicId);
      } else if (user.profilePicture.localPath) {
        await deleteFromLocal(user.profilePicture.localPath);
      }
    } catch (error) {
      // Continue with database update even if storage deletion fails
    }

    // Remove from user document
    user.profilePicture = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Profile picture deleted successfully",
      user: user,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete profile picture",
    });
  }
});

module.exports = router;
