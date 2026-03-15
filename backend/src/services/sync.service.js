const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

// Queue to track pending syncs
const syncQueue = new Map();
const SYNC_TIMEOUT = 60000; // 60 seconds between syncs for same user
const MAX_QUEUE_SIZE = 100;

/**
 * Background sync service
 * Runs without blocking API responses
 * Processes user sync requests in background
 */
class SyncService {
  constructor() {
    this.isProcessing = false;
    this.lastSyncTime = new Map();
  }

  /**
   * Queue a user for background sync
   * Returns immediately without waiting
   */
  queueUserSync(userId) {
    if (!userId) return;

    const now = Date.now();
    const lastSync = this.lastSyncTime.get(userId) || 0;

    // Skip if recently synced
    if (now - lastSync < SYNC_TIMEOUT) {
      console.log(`[SYNC-SERVICE] User ${userId} - skipped (already synced recently)`);
      return;
    }

    // Add to queue if not already pending
    if (!syncQueue.has(userId)) {
      if (syncQueue.size >= MAX_QUEUE_SIZE) {
        console.warn(`[SYNC-SERVICE] Queue full (${MAX_QUEUE_SIZE}), dropping oldest item`);
        const firstKey = syncQueue.keys().next().value;
        syncQueue.delete(firstKey);
      }
      syncQueue.set(userId, { queuedAt: now, attempts: 0 });
      console.log(`[SYNC-SERVICE] User ${userId} queued for sync (queue size: ${syncQueue.size})`);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process sync queue in background
   * Non-blocking - processes one user at a time
   */
  async processQueue() {
    if (this.isProcessing || syncQueue.size === 0) return;

    this.isProcessing = true;

    while (syncQueue.size > 0) {
      const userId = syncQueue.keys().next().value;
      const queueItem = syncQueue.get(userId);

      try {
        console.log(`[SYNC-SERVICE] Processing sync for user: ${userId}`);
        const result = await this.performSync(userId);
        console.log(`[SYNC-SERVICE] Sync completed for user ${userId}:`, {
          updated: result.updatedCount,
          total: result.totalAccounts,
        });
        this.lastSyncTime.set(userId, Date.now());
        syncQueue.delete(userId);
      } catch (error) {
        queueItem.attempts++;
        if (queueItem.attempts >= 3) {
          console.error(
            `[SYNC-SERVICE] Failed to sync user ${userId} after 3 attempts:`,
            error.message
          );
          syncQueue.delete(userId);
        } else {
          console.warn(
            `[SYNC-SERVICE] Sync failed for user ${userId} (attempt ${queueItem.attempts}/3):`,
            error.message
          );
          // Re-queue for retry after delay
          queueItem.queuedAt = Date.now() + 5000; // 5 second retry delay
        }
      }

      // Small delay between syncs to avoid overwhelming DB
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
    console.log('[SYNC-SERVICE] Queue processing complete');
  }

  /**
   * Perform actual sync for a user
   * Recalculates all account balances from transactions
   */
  async performSync(userId) {
    const accounts = await Account.find({ user_id: userId });
    let updatedCount = 0;

    for (const account of accounts) {
      const transactions = await Transaction.find({
        account_id: account._id,
      }).sort({ transaction_time: 1 });

      // Recalculate balance
      let calculatedBalance = account.current_balance || 0;

      if (transactions.length > 0) {
        if (account.balance_source === 'sms' && account.current_balance) {
          calculatedBalance = account.current_balance;
        } else {
          calculatedBalance = 0;
        }

        for (const tx of transactions) {
          if (tx.type === 'debit') {
            calculatedBalance -= tx.amount || 0;
          } else if (tx.type === 'credit') {
            calculatedBalance += tx.amount || 0;
          }
        }
      }

      // Update if changed
      if (calculatedBalance !== account.current_balance) {
        console.log(
          `[SYNC-SERVICE] ${account.bank_name} - ${account.current_balance} → ${calculatedBalance}`
        );
        account.current_balance = calculatedBalance;
        account.balance_source = 'calculated';
        account.last_balance_update_at = new Date();
        await account.save();
        updatedCount++;
      }
    }

    return {
      updatedCount,
      totalAccounts: accounts.length,
    };
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      queueSize: syncQueue.size,
      isProcessing: this.isProcessing,
      pendingUsers: Array.from(syncQueue.keys()),
      queueDetails: Array.from(syncQueue.entries()).map(([userId, item]) => ({
        userId,
        queuedAt: item.queuedAt,
        attempts: item.attempts,
      })),
    };
  }

  /**
   * Clear queue (for testing/maintenance)
   */
  clearQueue() {
    const clearedCount = syncQueue.size;
    syncQueue.clear();
    this.lastSyncTime.clear();
    console.log(`[SYNC-SERVICE] Queue cleared (${clearedCount} items removed)`);
    return clearedCount;
  }
}

// Export singleton instance
module.exports = new SyncService();
