const { Router } = require("express");
const { authenticateUser, authenticateAdmin } = require("../middleware/auth");
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


router.get("/", authenticateUser,getNotifications);
router.put("/read/:id", authenticateUser,readNotification);
router.delete("/delete/:id", authenticateUser,deleteNotification);
router.put("/mark-all-as-read", authenticateUser,markAllNotificationsAsRead);
router.delete("/delete-all", authenticateUser,deleteAllNotifications);

// Admin routes
router.use(authenticateAdmin)
router.post("/create", createAdminNoitification);
router.route("/admin").get(getAllAdminNotifications).delete(deleteAdminNotification);

router.put("/admin/:id", readAdminNotification);

module.exports = router;
