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

module.exports = {
  createNotification,
  getNotifications,
  readNotification,
  deleteNotification,
  markAllNotificationsAsRead,
  deleteAllNotifications,
};
