const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const { buildTransactionFilters } = require("../services/filter.service");
const { authenticateUser } = require("../middleware/auth");

/**
 * GET /dashboard/summary
 * Overall dashboard summary
 */
router.get("/summary", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month transactions
    const currentMonthTxns = await Transaction.find({
      user_id,
      transaction_time: { $gte: currentMonthStart }
    });

    // Last month transactions
    const lastMonthTxns = await Transaction.find({
      user_id,
      transaction_time: {
        $gte: lastMonthStart,
        $lte: lastMonthEnd
      }
    });

    // Calculate stats
    const currentMonthExpense = currentMonthTxns
      .filter(t => t.type === "debit" || t.type === "atm")
      .reduce((sum, t) => sum + t.net_amount, 0);

    const currentMonthIncome = currentMonthTxns
      .filter(t => t.type === "credit")
      .reduce((sum, t) => sum + t.net_amount, 0);

    const lastMonthIncome = lastMonthTxns
      .filter(t => t.type === "credit")
      .reduce((sum, t) => sum + t.net_amount, 0);

    const currentMonthNet = currentMonthIncome - currentMonthExpense;

    // All accounts
    const accounts = await Account.find({
      user_id,
      is_active: true
    });

    const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

    return res.json({
      status: "ok",
      current_month: {
        expense: currentMonthExpense,
        income: currentMonthIncome,
        net_savings: currentMonthNet,
        transaction_count: currentMonthTxns.length
      },
      last_month: {
        income: lastMonthIncome
      },
      accounts: {
        total_balance: totalBalance,
        count: accounts.length,
        active: accounts.filter(a => a.is_active).length
      }
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
 * GET /dashboard/recent
 * Recent 5 transactions + balance cards
 */
router.get("/recent", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;

    // Get recent transactions
    const recentTxns = await Transaction.find({ user_id })
      .sort({ transaction_time: -1 })
      .limit(5)
      .populate("account_id", "bank_name account_number");

    // Get all accounts with balance
    const accounts = await Account.find({
      user_id,
      is_active: true
    }).sort({ created_at: 1 });

    const accountCards = accounts.map(a => ({
      id: a._id,
      bank_name: a.bank_name,
      account_number: a.account_number,
      account_holder: a.account_holder,
      current_balance: a.current_balance,
      balance_source: a.balance_source,
      account_type: a.account_type
    }));

    return res.json({
      status: "ok",
      recent_transactions: recentTxns.map(t => ({
        id: t._id,
        amount: t.net_amount,
        type: t.type,
        merchant: t.merchant,
        account: {
          bank_name: t.account_id.bank_name,
          account_number: t.account_id.account_number
        },
        transaction_time: t.transaction_time
      })),
      account_cards: accountCards
    });
  } catch (error) {
    console.error("❌ Error fetching recent:", error);
    return res.status(500).json({
      error: "Failed to fetch recent data",
      message: error.message
    });
  }
});

/**
 * GET /dashboard/trends
 * Monthly trends (income vs expense)
 */
router.get("/trends", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const months = 12;
    const trends = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setHours(0, 0, 0, -1);

      const monthTxns = await Transaction.find({
        user_id,
        transaction_time: { $gte: monthStart, $lte: monthEnd }
      });

      const income = monthTxns
        .filter(t => t.type === "credit")
        .reduce((sum, t) => sum + t.net_amount, 0);

      const expense = monthTxns
        .filter(t => t.type === "debit" || t.type === "atm")
        .reduce((sum, t) => sum + t.net_amount, 0);

      trends.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM
        income,
        expense,
        net: income - expense
      });
    }

    return res.json({
      status: "ok",
      trends
    });
  } catch (error) {
    console.error("❌ Error fetching trends:", error);
    return res.status(500).json({
      error: "Failed to fetch trends",
      message: error.message
    });
  }
});

/**
 * GET /dashboard/category-breakdown
 * Spending by category
 */
router.get("/category-breakdown", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { start_date, end_date } = req.query;

    const filters = { user_id };
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const query = buildTransactionFilters(filters);

    const breakdown = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $ifNull: ["$category", "Uncategorized"] },
          total: { $sum: "$net_amount" },
          count: { $sum: 1 },
          avg: { $avg: "$net_amount" }
        }
      },
      { $sort: { total: -1 } }
    ]);

    return res.json({
      status: "ok",
      categories: breakdown
    });
  } catch (error) {
    console.error("❌ Error fetching category breakdown:", error);
    return res.status(500).json({
      error: "Failed to fetch category breakdown",
      message: error.message
    });
  }
});

/**
 * GET /dashboard/top-merchants
 * Top merchants by spending
 */
router.get("/top-merchants", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { limit = 10, start_date, end_date } = req.query;

    const filters = { user_id };
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const query = buildTransactionFilters(filters);

    const merchants = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$merchant",
          total: { $sum: "$net_amount" },
          count: { $sum: 1 },
          avg: { $avg: "$net_amount" },
          latest: { $max: "$transaction_time" }
        }
      },
      { $sort: { total: -1 } },
      { $limit: parseInt(limit) || 10 }
    ]);

    return res.json({
      status: "ok",
      merchants
    });
  } catch (error) {
    console.error("❌ Error fetching top merchants:", error);
    return res.status(500).json({
      error: "Failed to fetch top merchants",
      message: error.message
    });
  }
});

/**
 * GET /dashboard/daily-heatmap
 * Daily spending heatmap (last 90 days)
 */
router.get("/daily-heatmap", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const days = 90;
    const heatmap = {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const txns = await Transaction.find({
      user_id,
      transaction_time: { $gte: startDate }
    });

    // Group by date
    for (const txn of txns) {
      const date = txn.transaction_time.toISOString().split("T")[0];
      if (!heatmap[date]) {
        heatmap[date] = {
          date,
          debit: 0,
          credit: 0,
          count: 0
        };
      }

      if (txn.type === "debit" || txn.type === "atm") {
        heatmap[date].debit += txn.net_amount;
      } else if (txn.type === "credit") {
        heatmap[date].credit += txn.net_amount;
      }

      heatmap[date].count += 1;
    }

    const heatmapArray = Object.values(heatmap).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    return res.json({
      status: "ok",
      heatmap: heatmapArray,
      days
    });
  } catch (error) {
    console.error("❌ Error fetching heatmap:", error);
    return res.status(500).json({
      error: "Failed to fetch heatmap",
      message: error.message
    });
  }
});

/**
 * GET /dashboard/account-wise
 * Breakdown by account
 */
router.get("/account-wise", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;

    const accounts = await Account.find({
      user_id,
      is_active: true
    });

    const breakdown = await Promise.all(
      accounts.map(async (account) => {
        const txns = await Transaction.find({
          account_id: account._id
        });

        const debit = txns
          .filter(t => t.type === "debit" || t.type === "atm")
          .reduce((sum, t) => sum + t.net_amount, 0);

        const credit = txns
          .filter(t => t.type === "credit")
          .reduce((sum, t) => sum + t.net_amount, 0);

        return {
          account: {
            id: account._id,
            bank_name: account.bank_name,
            account_number: account.account_number
          },
          balance: account.current_balance,
          debit,
          credit,
          net: credit - debit,
          transaction_count: txns.length
        };
      })
    );

    return res.json({
      status: "ok",
      accounts: breakdown
    });
  } catch (error) {
    console.error("❌ Error fetching account breakdown:", error);
    return res.status(500).json({
      error: "Failed to fetch account breakdown",
      message: error.message
    });
  }
});

module.exports = router;
