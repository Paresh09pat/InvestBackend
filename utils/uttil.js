const crypto = require("crypto");
const User = require("../models/User");

const generateCode = async (name) => {
    // Clean the name and take first 4 characters
    const cleanName = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const prefix = cleanName.slice(0, 4) || "USER";

    let referralCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Keep generating until we get a unique code
    while (!isUnique && attempts < maxAttempts) {
        // Generate a 4-character random part
        const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
        
        // Create the referral code: NAME + random part (8 characters total)
        referralCode = `${prefix}${randomPart}`;

        // Check if this code already exists
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) {
            isUnique = true;
        }
        
        attempts++;
    }

    // If we couldn't generate a unique code, append timestamp
    if (!isUnique) {
        const timestamp = Date.now().toString(36).toUpperCase();
        referralCode = `${prefix}${timestamp.slice(-4)}`;
    }

    return referralCode;
};

module.exports = {
    generateCode
};
