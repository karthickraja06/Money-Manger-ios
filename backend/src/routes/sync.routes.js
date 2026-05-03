const express = require("express");
const syncService = require("../services/sync.service");

const router = express.Router();

/**
 * GET /sync/changes
 * Get changes since a timestamp (for real-time sync polling)
 * Query: since=timestamp (milliseconds since epoch)
 */
router.get("/changes", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const { since } = req.query;
    const since_timestamp = since ? parseInt(since) : null;

    const changes = syncService.getChangesSince(user_id, since_timestamp);

    res.json({
      since_timestamp,
      current_timestamp: Date.now(),
      changes_count: changes.length,
      changes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sync/stats
 * Get sync statistics and summary of changes
 */
router.get("/stats", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const { since } = req.query;
    const since_timestamp = since ? parseInt(since) : null;

    const result = syncService.getSyncStats(user_id, since_timestamp);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sync/queue-status
 * Get current sync queue status (admin/debug)
 */
router.get("/queue-status", async (req, res, next) => {
  try {
    const status = syncService.getQueueStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
