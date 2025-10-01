const Notification = require("../models/Notification");

const createNotification = async (userId, message, title) => {
  const notification = await Notification.create({ userId, message, title });
  return notification;
};

const getNotifications = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ read: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Notification.countDocuments({ userId: req.user._id });

  res.status(200).json({
    notifications,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total: total,
  });
};

const readNotification = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      message: "Notification id is required",
    });
  }
  const notification = await Notification.findByIdAndUpdate(
    id,
    { read: true },
    { new: true }
  );
  res.status(200).json({
    success: true,
    message: "Notification read successfully",
  });
};

const deleteNotification = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      message: "Notification id is required",
    });
  }
  await Notification.findByIdAndDelete(id);
  res.status(200).json({
    success: true,
    message: "Notification deleted successfully",
  });
};

const markAllNotificationsAsRead = async (req, res) => {
  await Notification.updateMany({ userId: req.user._id }, { read: true });
  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
};

const deleteAllNotifications = async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });
  res.status(200).json({
    success: true,
    message: "All notifications deleted successfully",
  });
};

const createAdminNoitification = async (message, title) => {
  try {
    const id = req.admin._id;

    await Notification.create({
      userId: id,
      message,
      title,
      read: false
    })
    return res.status(200).json({
      success: true,
      message: "Notification created successfully"
    })
  }
  catch (err) {
    console.log("error", err)

    return res.status(500).json({
      success: false,
      message: "Internal Server error"
    })
  }
}

const getAllAdminNotifications = async (req, res) => {
  try {
    const { page } = req.query || 1;
    const { limit } = req.query || 10;
    const skip = (page - 1) * limit;
    const notifications = await Notification.find({ userId: req.admin._id })
      .sort({ read: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Notification.countDocuments({ userId: req.admin._id });
    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      notifications,
      total,
    })
  }
  catch (err) {
    console.log("err", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server error"
    })
  }
}

const readAdminNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification id is required"
      })
    }
    const notification = await Notification.findByIdAndUpdate(id, { read: true }, { new: true });
    return res.status(200).json({
      success: true,
      message: "Notification read successfully",
      notification
    })
  }
  catch (err) {
    console.log("err", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server error"
    })
  }
}

const deleteAdminNotification = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification id is required"
      })
    }

    if (Array.isArray(ids)) {
      await Notification.deleteMany({ _id: { $in: ids } });
      return res.status(200).json({
        success: true,
        message: "Notifications deleted successfully"
      })
    } else {
      await Notification.findByIdAndDelete(ids);
      return res.status(200).json({
        success: true,
        message: "Notification deleted successfully"
      })
    }

  }
  catch (err) {
    console.log("err", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server error"
    })
  }

}

module.exports = {
  createNotification,
  getNotifications,
  readNotification,
  deleteNotification,
  markAllNotificationsAsRead,
  deleteAllNotifications,
  createAdminNoitification,
  getAllAdminNotifications,
  readAdminNotification,
  deleteAdminNotification
};
