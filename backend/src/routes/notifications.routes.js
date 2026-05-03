const express = require("express");
const notificationService = require("../services/notification.service");

const router = express.Router();

/**
 * GET /notifications
 * Get user's notifications
 */
router.get("/", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const { limit = 20 } = req.query;

    const notifications = await notificationService.getUserNotifications(
      user_id,
      parseInt(limit)
    );

    res.json({
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /notifications/:id/read
 * Mark notification as read
 */
router.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markNotificationAsRead(id);

    res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /notifications
 * Clear all notifications for user
 */
router.delete("/", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const cleared = await notificationService.clearUserNotifications(user_id);

    res.json({
      message: `Cleared ${cleared} notifications`,
      cleared,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
