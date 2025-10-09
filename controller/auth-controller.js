const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const fs = require("fs-extra");
const Notification = require("../models/Notification");
const { generateToken, cookieOptions } = require("../config/utils");
const {
  uploadProfilePicture,
  deleteFromCloudinary,
  deleteFromLocal,
  isCloudinaryConfigured,
} = require("../utils/cloudinaryUpload");
const Portfolio = require("../models/Portfolio");
const Referral = require("../models/Referal");
const { generateCode } = require("../utils/uttil");

// const register = async (req, res) => {
//   try {
//     const { name, email, phone, password, agree, referralCode } = req.body;


//     if (!name || !email || !phone || !password) {
//       return res.status(400).json({
//         message: "All fields are required",
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         message: "Password must be at least 6 characters long",
//       });
//     }

//     if (!agree) {
//       return res.status(400).json({
//         message: "You must agree to the terms and conditions",
//       });
//     }


//     // Check if user already exists
//     const existingUser = await User.findOne({
//       $or: [{ email: email.toLowerCase() }, { phone }],
//     });

//     if (existingUser) {
//       if (existingUser.email === email.toLowerCase()) {
//         return res.status(400).json({
//           message: "User with this email already exists",
//         });
//       } else {
//         return res.status(400).json({
//           message: "User with this phone number already exists",
//         });
//       }
//     }

//     const user = await User.create({
//       name: name.trim(),
//       email: email.toLowerCase().trim(),
//       phone: phone.trim(),
//       password: password,
//       agree
//     });

//     // Generate JWT token
//     const token = generateToken(user);

//     // Set HTTP-only cookie
//     res.cookie("_trdexa_", token, cookieOptions);

//     res.status(201).json({
//       message: "User created successfully",
//       user: user.toJSON(),
//     });
//   } catch (error) {
//     console.error("Registration error:", error);

//     // Handle duplicate key errors
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyValue)[0];
//       return res.status(400).json({
//         message: `${field.charAt(0).toUpperCase() + field.slice(1)
//           } already exists`,
//       });
//     }

//     // Handle validation errors
//     if (error.name === "ValidationError") {
//       const messages = Object.values(error.errors).map((err) => err.message);
//       return res.status(400).json({
//         message: messages.join(", "),
//       });
//     }

//     res.status(500).json({
//       message: "Internal server error. Please try again later.",
//     });
//   }
// };

const register = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    const { name, email, phone, password, agree, referralCode } = req.body;

    // 1️⃣ Validation
    if (!name || !email || !phone || !password) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!agree) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "You must agree to the terms and conditions",
      });
    }

    // 2️⃣ Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({
          message: "User with this email already exists",
        });
      } else {
        return res.status(400).json({
          message: "User with this phone number already exists",
        });
      }
    }

    // 3️⃣ Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      console.log("Referral code", referralCode.trim())
      referrer = await User.findOne({ referralCode: referralCode.trim() }).session(session);
      if (!referrer) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Invalid referral code",
        });
      }
    }

    const user = await User.create([{
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: password,
      agree,
    }], { session });

    const newUser = user[0];

    if (referrer) {
      const rewardExpiryDays = 30; 
      await Referral.create([{
        referrer: referrer._id,
        referred: newUser._id,
        rewardExpiresAt: new Date(Date.now() + rewardExpiryDays * 24 * 60 * 60 * 1000),
        rewardClaimed: false
      }], { session });
    }

    // 7️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 8️⃣ Generate JWT token
    const token = generateToken(newUser);

    // 9️⃣ Set HTTP-only cookie
    res.cookie("_trdexa_", token, cookieOptions);

    // 🔟 Respond
    res.status(201).json({
      message: "User created successfully",
      user: newUser.toJSON(),
    });
  } catch (error) {
    console.error("Registration error:", error);
    await session.abortTransaction();
    session.endSession();

    // Duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      });
    }

    // Validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }

    // Check if user agreed to terms
    if (!user.agree) {
      return res.status(401).json({
        message: "Please agree to the terms and conditions",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid Credentials",
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Set HTTP-only cookie
    res.cookie("_trdexa_", token, cookieOptions);

    res.status(200).json({
      message: "Login successful",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    const admin = await User.findOne({ email: process.env.ADMIN_EMAIL, role: "admin" }).select("-password").exec()


    const notifications = await Notification.find({
      userId: req.user._id,
      read: false,
    }).countDocuments();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const referralLink = user.referralCode ? `https://trdexa.com/signup?referralCode=${user.referralCode}` : null;

    res.status(200).json({
      user: { ...user.toJSON(), referralLink: referralLink },
      adminQR: admin?.profilePicture?.cloudinaryUrl,
      notifications,
    });
  } catch (error) {
    console.error("Profile error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const token =
      req.cookies._trdexa_ || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Access token required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret-key"
    );

    const { name, phone, trustWalletAddress = null } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        message: "Name and phone are required",
      });
    }

    // Find user first
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
    };

    // Add trust wallet if provided
    if (trustWalletAddress) {
      updateData.trustWalletAddress = trustWalletAddress.trim();

      // ✅ If both Aadhaar and PAN are verified, mark user verified
      if (
        user.documents?.aadhaar?.status === "verified" &&
        user.documents?.pan?.status === "verified"
      ) {
        updateData.verificationStatus = "verified";
        updateData.isVerified = true;
      }
    }

    const referalCode = await generateCode(name);
    updateData.referralCode = referalCode;
    // updateData.referralCodeGeneratedAt = new Date();

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};



const logout = async (req, res) => {
  res.clearCookie("_trdexa_", cookieOptions);

  res.status(200).json({
    message: "Logged out successfully",
  });
};

const uploadProfilePictureController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      // Clean up temp file
      await fs.remove(req.file.path);
      return res.status(404).json({ message: "User not found" });
    }

    // Delete old profile picture if exists
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
      localPath: uploadResult.localPath || undefined,
      uploadedAt: new Date(),
    };

    await user.save();

    // Clean up temp file
    await fs.remove(req.file.path);

    const response = {
      message: "Profile picture uploaded successfully",
      profilePicture: {
        url: uploadResult.secure_url,
        uploadedAt: user.profilePicture.uploadedAt,
      },
      user: user.toJSON(),
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
      message: error.message || "Failed to upload profile picture",
    };

    res.status(500).json(errorResponse);
  }
};

const deleteProfilePictureController = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profilePicture) {
      return res.status(400).json({ message: "No profile picture to delete" });
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
      message: "Profile picture deleted successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: error.message || "Failed to delete profile picture",
    });
  }
};

const getPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    res.status(200).json({
      message: "Portfolio fetched successfully",
      portfolio,
    })
  }
  catch (err) {
    console.error(err)
    res.status(500).json({
      message: "Internal server error",
    })
  }
}

module.exports = {
  register,
  login,
  profile,
  updateProfile,
  logout,
  uploadProfilePictureController,
  deleteProfilePictureController,
  getPortfolio,
};
