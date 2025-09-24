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
    console.log("Boudy>>>", req.body);

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
    const trader = await Trader.findByIdAndUpdate(
      id,
      {
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
      },
      { new: true }
    );
    res.status(200).json({
      message: "Trader updated successfully",
      trader: trader.toJSON(),
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
      message: "Trader deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting trader:", error);
    res.status(500).json({
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
