const express = require("express");
const router = express.Router();
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { formatAccount } = require("../services/filter.service");
const { authenticateUser } = require("../middleware/auth");

/**
 * GET /accounts
 * List all accounts for user
 */
router.get("/", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    console.log(`[ACCOUNTS] GET / - Fetching accounts for user_id: ${user_id}`);

    const accounts = await Account.find({
      user_id,
      is_active: true
    }).sort({ created_at: -1 });

    console.log(`[ACCOUNTS] GET / - Found ${accounts.length} active accounts for user_id: ${user_id}`);

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

    console.log(`[ACCOUNTS] GET / - Returning ${accountsWithStats.length} accounts with stats`);
    return res.json({
      status: "ok",
      total: accountsWithStats.length,
      accounts: accountsWithStats
    });
  } catch (error) {
    console.error(`[ACCOUNTS] GET / - Error:`, error);
    console.error(`[ACCOUNTS] GET / - Error stack:`, error.stack);
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
    console.log(`[ACCOUNTS] GET /:id - Fetching account ${id} for user_id: ${user_id}`);

    const account = await Account.findOne({
      _id: id,
      user_id
    });

    if (!account) {
      console.log(`[ACCOUNTS] GET /:id - Account ${id} not found for user_id: ${user_id}`);
      return res.status(404).json({
        error: "Account not found"
      });
    }

    console.log(`[ACCOUNTS] GET /:id - Found account: ${account.account_holder} (${account.account_number})`);

    // Get recent transactions for this account
    const recentTransactions = await Transaction.find({
      account_id: account._id
    })
      .sort({ transaction_time: -1 })
      .limit(10);

    console.log(`[ACCOUNTS] GET /:id - Found ${recentTransactions.length} recent transactions`);

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

    console.log(`[ACCOUNTS] GET /:id - Stats: debit=${stats.total_debit}, credit=${stats.total_credit}`);
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
 * Update account (e.g., mark as inactive, update notes)
 */
router.patch("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    const { is_active } = req.body;

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

module.exports = router;
