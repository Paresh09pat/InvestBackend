const { Router } = require("express");
const { authenticateUser } = require("../middleware/auth");
const {
  getNotifications,
  readNotification,
  createAdminNoitification,
  getAllAdminNotifications,
  readAdminNotification,
  deleteAdminNotification,
} = require("../controller/notification-controller");
const { deleteNotification, markAllNotificationsAsRead, deleteAllNotifications } = require("../controller/notification-controller");

const router = Router();

router.use(authenticateUser);
router.get("/", getNotifications);
router.put("/read/:id", readNotification);
router.delete("/delete/:id", deleteNotification);
router.put("/mark-all-as-read", markAllNotificationsAsRead);
router.delete("/delete-all", deleteAllNotifications);

// Admin routes
router.post("/create", createAdminNoitification);
router.route("/admin").get(getAllAdminNotifications).delete(deleteAdminNotification);

router.put("/admin/:id", readAdminNotification);

module.exports = router;
