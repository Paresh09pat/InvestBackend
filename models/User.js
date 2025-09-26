const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const documentSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: false
    },
    originalName: {
        type: String,
    },
    filePath: {
        type: String,
    },
    fileSize: {
        type: Number,
    },
    mimeType: {
        type: String,
    },
    // Cloudinary fields
    cloudinaryPublicId: {
        type: String,
        required: true
    },
    cloudinaryUrl: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    verifiedAt: {
        type: Date
    },
    verifiedBy: {
        type: String,
        default: 'admin'
    },
    rejectionReason: {
        type: String
    }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    agree: {
        type: Boolean,
        required: [true, 'You must agree to the terms and conditions'],
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified'
    },
    profilePicture: {
        cloudinaryPublicId: {
            type: String
        },
        cloudinaryUrl: {
            type: String
        },
        localPath: {
            type: String
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    documents: {
        aadhaar: documentSchema,
        pan: documentSchema
    },
    totalInvested: {
        type: Number,
        default: 0
    },
    currentBalance: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
}, {
    timestamps: true
});

// Remove password from JSON responses
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
