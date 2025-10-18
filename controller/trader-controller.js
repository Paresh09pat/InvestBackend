const Subscription = require("../models/Subscription");
const Trader = require("../models/Trader");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

const createTrader = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      description,
      traderType,
      minInterstRate,
      maxInterstRate,
      minInvestment,
      maxInvestment,
      experience,
    } = req.body;
    if (
      !name ||
      !email ||
      !phone ||
      !description ||
      !traderType ||
      !minInterstRate ||
      !maxInterstRate ||
      !minInvestment ||
      !maxInvestment ||
      !experience
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    let profilePicture = null;
    const picture = req.file;
    if (picture) {
      const uploadResult = await uploadToCloudinary(picture);
      profilePicture = uploadResult.secure_url;
    }

    const existingTrader = await Trader.findOne({ email });
    if (existingTrader) {
      return res.status(400).json({
        message: "Trader with this email already exists",
      });
    }

    const trader = await Trader.create({
      name,
      email,
      phone,
      description,
      traderType,
      minInterstRate,
      maxInterstRate,
      minInvestment,
      maxInvestment,
      experience,
      profilePicture,
    });

    const checkTrader = await Subscription.findOne({ name: traderType });
    if (checkTrader.traders.includes(trader._id)) {
      return res.status(400).json({
        message: `Trader with this email already exists in this ${traderType} subscription.`,
      });
    }
    else {
      const addTrader = await Subscription.findOneAndUpdate({ name: traderType }, {
        $push: { traders: trader._id },
      });
    }




    res.status(201).json({
      message: "Trader created successfully",
      trader: trader.toJSON(),
    });
  } catch (error) {
    console.error("Error creating trader:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const getTraders = async (req, res) => {
  const { search } = req.query;

  try {
    let traders;

    if (search) {
      // Convert search term to number if it's a valid number
      const searchNumber = !isNaN(search) && !isNaN(parseFloat(search)) ? parseFloat(search) : null;

      const searchConditions = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { traderType: { $regex: search, $options: "i" } },
      ];

      // Add numeric field searches only if search term is a number
      if (searchNumber !== null) {
        searchConditions.push(
          { minInterstRate: searchNumber },
          { maxInterstRate: searchNumber },
          { minInvestment: searchNumber },
          { maxInvestment: searchNumber },
          { experience: searchNumber }
        );
      }

      traders = await Trader.find({
        $or: searchConditions,
      }).sort({ createdAt: -1 });
    } else {
      traders = await Trader.find().sort({ createdAt: -1 });
    }

    res.status(200).json({
      message: "Traders fetched successfully",
      traders,
    });
  } catch (error) {
    console.error("Error fetching traders:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const getTraderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Trader id is required",
      });
    }
    const trader = await Trader.findById(id);
    res.status(200).json({
      message: "Trader fetched successfully",
      trader: trader.toJSON(),
    });
  } catch (error) {
    console.error("Error fetching trader by id:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const updateTrader = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      description,
      traderType,
      minInterstRate,
      maxInterstRate,
      minInvestment,
      maxInvestment,
      experience,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Trader ID is required",
      });
    }

    // Check if trader exists
    const existingTrader = await Trader.findById(id);
    if (!existingTrader) {
      return res.status(404).json({
        message: "Trader not found",
      });
    }

    // Build update data object with only provided fields
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (description !== undefined) updateData.description = description;
    if (traderType !== undefined) updateData.traderType = traderType;
    if (minInterstRate !== undefined) updateData.minInterstRate = minInterstRate;
    if (maxInterstRate !== undefined) updateData.maxInterstRate = maxInterstRate;
    if (minInvestment !== undefined) updateData.minInvestment = minInvestment;
    if (maxInvestment !== undefined) updateData.maxInvestment = maxInvestment;
    if (experience !== undefined) updateData.experience = experience;

    // Handle profile picture update if file is uploaded (optional)
    const file = req.file;
    if (file) {
      const uploadResult = await uploadToCloudinary(file);
      updateData.profilePicture = uploadResult.secure_url;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided for update",
      });
    }

    // Validate numeric fields if provided
    if (minInterstRate !== undefined && (isNaN(minInterstRate) || minInterstRate < 0)) {
      return res.status(400).json({
        message: "Minimum interest rate must be a valid positive number",
      });
    }

    if (maxInterstRate !== undefined && (isNaN(maxInterstRate) || maxInterstRate < 0)) {
      return res.status(400).json({
        message: "Maximum interest rate must be a valid positive number",
      });
    }

    if (minInvestment !== undefined && (isNaN(minInvestment) || minInvestment < 0)) {
      return res.status(400).json({
        message: "Minimum investment must be a valid positive number",
      });
    }

    if (maxInvestment !== undefined && (isNaN(maxInvestment) || maxInvestment < 0)) {
      return res.status(400).json({
        message: "Maximum investment must be a valid positive number",
      });
    }

    if (experience !== undefined && (isNaN(experience) || experience < 0)) {
      return res.status(400).json({
        message: "Experience must be a valid positive number",
      });
    }

    // Validate trader type if provided
    if (traderType !== undefined && !["silver", "gold", "platinum"].includes(traderType)) {
      return res.status(400).json({
        message: "Trader type must be 'silver', 'gold', or 'platinum'",
      });
    }

    // Update trader with provided fields
    const updatedTrader = await Trader.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    const checkTrader = await Subscription.findOne({ name: updateData.traderType });
    if (checkTrader.traders.includes(updatedTrader._id)) {
      checkTrader.traders = checkTrader.traders.filter(trader => trader.toString() !== updatedTrader._id.toString());
      await checkTrader.save();

      await Subscription.findOneAndUpdate({ name: updateData.traderType }, {
        $push: { traders: updatedTrader._id },
      });
    }
    else {
      const addTrader = await Subscription.findOneAndUpdate({ name: updateData.traderType }, {
        $push: { traders: updatedTrader._id },
      });
    }



    res.status(200).json({
      message: "Trader updated successfully",
      trader: updatedTrader.toJSON(),
    });
  } catch (error) {
    console.error("Error updating trader:", error);
    res.status(500).json({
      message: "Internal server error. Please try again later.",
    });
  }
};

const deleteTrader = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        message: "Trader id is required",
      });
    }
    await Trader.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Trader deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting trader:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

module.exports = {
  createTrader,
  getTraders,
  getTraderById,
  updateTrader,
  deleteTrader,
};
