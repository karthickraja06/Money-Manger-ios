const express = require("express");
const router = express.Router();
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { formatAccount } = require("../services/filter.service");
const { recomputeBalanceFromTimestamp } = require("../services/account.service");
const { authenticateUser } = require("../middleware/auth");

/**
 * GET /accounts
 * List all accounts for user
 */
router.get("/", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;

    const accounts = await Account.find({
      user_id,
      is_active: true
    }).sort({ created_at: -1 });

    // Calculate transaction count for each account
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        const txnCount = await Transaction.countDocuments({
          account_id: account._id
        });

        return {
          ...formatAccount(account),
          transaction_count: txnCount
        };
      })
    );

    return res.json({
      status: "ok",
      total: accountsWithStats.length,
      accounts: accountsWithStats
    });
  } catch (error) {
    console.error("❌ Error fetching accounts:", error);
    return res.status(500).json({
      error: "Failed to fetch accounts",
      message: error.message
    });
  }
});

/**
 * GET /accounts/:id
 * Get single account details with recent transactions
 */
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;

    const account = await Account.findOne({
      _id: id,
      user_id
    });

    if (!account) {
      return res.status(404).json({
        error: "Account not found"
      });
    }

    // Get recent transactions for this account
    const recentTransactions = await Transaction.find({
      account_id: account._id
    })
      .sort({ transaction_time: -1 })
      .limit(10);

    // Calculate stats
    const allTransactions = await Transaction.find({
      account_id: account._id
    });

    const stats = {
      total_transactions: allTransactions.length,
      total_debit: allTransactions
        .filter(t => t.type === "debit" || t.type === "atm")
        .reduce((sum, t) => sum + t.net_amount, 0),
      total_credit: allTransactions
        .filter(t => t.type === "credit")
        .reduce((sum, t) => sum + t.net_amount, 0)
    };

    return res.json({
      status: "ok",
      account: formatAccount(account),
      recent_transactions: recentTransactions.map(t => ({
        id: t._id,
        amount: t.net_amount,
        type: t.type,
        merchant: t.merchant,
        transaction_time: t.transaction_time
      })),
      stats
    });
  } catch (error) {
    console.error("❌ Error fetching account:", error);
    return res.status(500).json({
      error: "Failed to fetch account",
      message: error.message
    });
  }
});

/**
 * GET /accounts/summary/all
 * Get summary of all accounts (total balance, etc.)
 */
router.get("/summary/all", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;

    const accounts = await Account.find({
      user_id,
      is_active: true
    });

    const summary = {
      total_accounts: accounts.length,
      total_balance: accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0),
      accounts_with_balance: accounts.filter(a => a.current_balance !== null).length,
      accounts_without_balance: accounts.filter(a => a.current_balance === null).length,
      by_type: {
        bank: accounts.filter(a => a.account_type === "bank").length,
        cash: accounts.filter(a => a.account_type === "cash").length,
        wallet: accounts.filter(a => a.account_type === "wallet").length,
        credit_card: accounts.filter(a => a.account_type === "credit_card").length
      }
    };

    return res.json({
      status: "ok",
      summary
    });
  } catch (error) {
    console.error("❌ Error fetching summary:", error);
    return res.status(500).json({
      error: "Failed to fetch summary",
      message: error.message
    });
  }
});

/**
 * PATCH /accounts/:id
 * Update account (e.g., mark as inactive, update notes, update balance)
 */
router.patch("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    const { is_active, current_balance, balance_as_of } = req.body;

    const account = await Account.findOne({
      _id: id,
      user_id
    });

    if (!account) {
      return res.status(404).json({
        error: "Account not found"
      });
    }

    if (is_active !== undefined) {
      account.is_active = is_active;
    }

    // Allow manual/SMS balance update
    if (current_balance !== undefined && typeof current_balance === 'number') {
      if (balance_as_of) {
        console.log(`[ACCOUNTS] Balance update with timestamp for account ${id}: ${account.current_balance} → ${current_balance}, as of ${balance_as_of}`);
        const updated = await recomputeBalanceFromTimestamp(
          account._id,
          current_balance,
          balance_as_of
        );
        return res.json({
          status: "ok",
          account: formatAccount(updated)
        });
      } else {
        console.log(`[ACCOUNTS] Manual balance update for account ${id}: ${account.current_balance} → ${current_balance}`);
        account.current_balance = current_balance;
        account.balance_source = 'manual';
        account.last_balance_update_at = new Date();
      }
    }

    account.updated_at = new Date();
    await account.save();

    return res.json({
      status: "ok",
      account: formatAccount(account)
    });
  } catch (error) {
    console.error("❌ Error updating account:", error);
    return res.status(500).json({
      error: "Failed to update account",
      message: error.message
    });
  }
});

/**
 * POST /accounts/sync/flush
 * Recalculate balances from all transactions for user
 * Useful for syncing after SMS ingestion
 */
router.post("/sync/flush", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;

    console.log(`[ACCOUNTS] Starting flush sync for user: ${user_id}`);

    // Get all accounts for user
    const accounts = await Account.find({ user_id });

    let updatedCount = 0;
    const results = [];

    for (const account of accounts) {
      // Get all transactions for this account
      const transactions = await Transaction.find({
        account_id: account._id
      }).sort({ transaction_time: 1 });

      // Recalculate balance: start from SMS balance or 0, apply all debits/credits
      let calculatedBalance = account.current_balance || 0;

      if (transactions.length > 0) {
        // If we have an SMS-sourced balance, use it as starting point
        if (account.balance_source === 'sms' && account.current_balance) {
          calculatedBalance = account.current_balance;
        } else {
          // Otherwise start from 0 and apply all transactions
          calculatedBalance = 0;
        }

        // Apply each transaction
        for (const tx of transactions) {
          if (tx.type === 'debit') {
            calculatedBalance -= (tx.amount || 0);
          } else if (tx.type === 'credit') {
            calculatedBalance += (tx.amount || 0);
          }
        }
      }

      // Update account if balance changed
      if (calculatedBalance !== account.current_balance) {
        console.log(`[ACCOUNTS] Sync: ${account.bank_name} - ${account.current_balance} → ${calculatedBalance}`);
        account.current_balance = calculatedBalance;
        account.balance_source = 'calculated';
        account.last_balance_update_at = new Date();
        await account.save();
        updatedCount++;

        results.push({
          account_id: account._id,
          bank_name: account.bank_name,
          old_balance: account.current_balance,
          new_balance: calculatedBalance,
          tx_count: transactions.length
        });
      }
    }

    console.log(`[ACCOUNTS] Flush complete - ${updatedCount}/${accounts.length} accounts updated`);

    return res.json({
      status: "ok",
      message: "Sync completed",
      updated_count: updatedCount,
      total_accounts: accounts.length,
      results
    });
  } catch (error) {
    console.error("❌ Error during flush sync:", error);
    return res.status(500).json({
      error: "Failed to sync accounts",
      message: error.message
    });
  }
});

module.exports = router;
