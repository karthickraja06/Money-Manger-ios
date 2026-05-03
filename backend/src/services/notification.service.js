// In-memory notifications store (can be replaced with Redis for production)
const notifications = [];
const MAX_NOTIFICATIONS = 1000;

/**
 * Create a budget exceeded notification
 */
async function createBudgetNotification(user_id, budget) {
  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id,
    type: "budget_exceeded",
    category: budget.category,
    spent: budget.spent,
    limit: budget.monthlyLimit,
    percentage: budget.percentage,
    message: `Budget alert: ${budget.category} at ${budget.percentage}% (${budget.spent} / ${budget.monthlyLimit})`,
    timestamp: new Date(),
    read: false,
    action_url: `/budgets`,
  };

  notifications.push(notification);

  // Keep memory bounded
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.shift();
  }

  return notification;
}

/**
 * Get unread notifications for user
 */
async function getUserNotifications(user_id, limit = 20) {
  return notifications
    .filter(n => n.user_id === user_id)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notification_id) {
  const notif = notifications.find(n => n.id === notification_id);
  if (notif) {
    notif.read = true;
  }
  return notif;
}

/**
 * Clear all notifications for user
 */
async function clearUserNotifications(user_id) {
  const initialLength = notifications.length;
  const filtered = notifications.filter(n => n.user_id !== user_id);
  notifications.length = 0;
  notifications.push(...filtered);
  return initialLength - filtered.length;
}

/**
 * Check budgets and create notifications for user
 */
async function checkAndNotifyBudgetAlerts(user_id, budgets) {
  const alerts = [];

  for (const budget of budgets) {
    if (budget.percentage >= 80) {
      const existing = notifications.find(
        n => n.user_id === user_id && 
             n.type === "budget_exceeded" && 
             n.category === budget.category &&
             n.read === false
      );

      // Only create if not already notified today
      if (!existing || (Date.now() - existing.timestamp) > 86400000) {
        const notif = await createBudgetNotification(user_id, budget);
        alerts.push(notif);
      }
    }
  }

  return alerts;
}

module.exports = {
  createBudgetNotification,
  getUserNotifications,
  markNotificationAsRead,
  clearUserNotifications,
  checkAndNotifyBudgetAlerts,
};
