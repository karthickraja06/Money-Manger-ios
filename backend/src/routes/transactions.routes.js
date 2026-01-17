const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const {
  buildTransactionFilters,
  buildAggregationPipeline,
  buildSort,
  getPagination,
  formatTransaction
} = require("../services/filter.service");
const crypto = require('crypto');
const {
  linkRefund,
  unlinkRefund,
  getRefundPairs,
  getPotentialRefunds,
  calculateNetSpend,
  autoLinkRefunds
} = require("../services/refund.service");
const { authenticateUser } = require("../middleware/auth");

/**
 * GET /transactions
 * List transactions with filtering, sorting, pagination
 * Query params:
 *   - start_date, end_date (ISO string)
 *   - type (debit, credit, atm, cash)
 *   - account_ids (comma-separated)
 *   - bank_name
 *   - merchant
 *   - category
 *   - tags (comma-separated)
 *   - min_amount, max_amount
 *   - receiver_name, sender_name
 *   - page (1), limit (20, max 100)
 *   - sort_by (transaction_time), order (desc/asc)
 */
router.get("/", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const {
      start_date,
      end_date,
      type,
      account_ids,
      bank_name,
      merchant,
      category,
      tags,
      min_amount,
      max_amount,
      receiver_name,
      sender_name,
      page = 1,
      limit = 20,
      sort_by = "transaction_time",
      order = "desc"
    } = req.query;

    // Build filters
    const filters = {
      user_id,
      start_date,
      end_date,
      bank_name,
      merchant,
      category,
      min_amount,
      max_amount,
      receiver_name,
      sender_name
    };

    // Parse array filters
    if (type) {
      filters.type = type.split(",").map(t => t.trim());
    }

    if (account_ids) {
      filters.account_ids = account_ids.split(",").map(id => id.trim());
    }

    if (tags) {
      filters.tags = tags.split(",").map(t => t.trim());
    }

    const query = buildTransactionFilters(filters);
    const sort = buildSort(sort_by, order);
    const { skip, limit: pageLimit } = getPagination(page, limit);

    // Execute query
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageLimit)
      .populate("account_id", "bank_name account_number account_holder");

    // Calculate totals from current page
    const pageStats = {
      total_items: transactions.length,
      total_debit: transactions
        .filter(t => t.type === "debit" || t.type === "atm")
        .reduce((sum, t) => sum + t.net_amount, 0),
      total_credit: transactions
        .filter(t => t.type === "credit")
        .reduce((sum, t) => sum + t.net_amount, 0),
      net_amount: transactions.reduce((sum, t) => {
        const sign = t.type === "debit" || t.type === "atm" ? -1 : 1;
        return sum + t.net_amount * sign;
      }, 0)
    };

    return res.json({
      status: "ok",
      pagination: {
        page: parseInt(page),
        limit: pageLimit,
        total: total,
        pages: Math.ceil(total / pageLimit)
      },
      stats: pageStats,
      transactions: transactions.map(t => ({
        ...formatTransaction(t),
        account: {
          id: t.account_id._id,
          bank_name: t.account_id.bank_name,
          account_holder: t.account_id.account_holder
        }
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    return res.status(500).json({
      error: "Failed to fetch transactions",
      message: error.message
    });
  }
});

/**
 * GET /transactions/:id
 * Get single transaction detail with linked refunds
 */
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      _id: id,
      user_id
    }).populate("account_id", "bank_name account_number account_holder");

    if (!transaction) {
      return res.status(404).json({
        error: "Transaction not found"
      });
    }

    // Get linked refunds if any
    let linkedRefunds = [];
    if (transaction.linked_refunds && transaction.linked_refunds.length > 0) {
      linkedRefunds = await Transaction.find({
        _id: { $in: transaction.linked_refunds }
      }).select("amount merchant transaction_time");
    }

    // Get original transaction if this is a refund
    let originalTransaction = null;
    if (transaction.is_refund_of) {
      originalTransaction = await Transaction.findById(transaction.is_refund_of).select(
        "amount merchant transaction_time"
      );
    }

    return res.json({
      status: "ok",
      transaction: {
        ...formatTransaction(transaction),
        account: {
          id: transaction.account_id._id,
          bank_name: transaction.account_id.bank_name,
          account_holder: transaction.account_id.account_holder
        },
        linked_refunds: linkedRefunds.map(r => ({
          id: r._id,
          amount: r.amount,
          merchant: r.merchant,
          transaction_time: r.transaction_time
        })),
        original_transaction: originalTransaction ? {
          id: originalTransaction._id,
          amount: originalTransaction.amount,
          merchant: originalTransaction.merchant,
          transaction_time: originalTransaction.transaction_time
        } : null
      }
    });
  } catch (error) {
    console.error("❌ Error fetching transaction:", error);
    return res.status(500).json({
      error: "Failed to fetch transaction",
      message: error.message
    });
  }
});

/**
 * GET /transactions/stats/aggregate
 * Get aggregated stats (by type, merchant, category, etc.)
 */
router.get("/stats/aggregate", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const {
      start_date,
      end_date,
      type,
      account_ids,
      bank_name,
      merchant,
      category
    } = req.query;

    // Build filters
    const filters = {
      user_id,
      start_date,
      end_date,
      bank_name,
      merchant,
      category
    };

    if (type) {
      filters.type = type.split(",").map(t => t.trim());
    }

    if (account_ids) {
      filters.account_ids = account_ids.split(",").map(id => id.trim());
    }

    const pipeline = buildAggregationPipeline(filters);
    const results = await Transaction.aggregate(pipeline);

    const [facetResults] = results;

    return res.json({
      status: "ok",
      summary: facetResults.summary[0] || {
        total_transactions: 0,
        total_debit: 0,
        total_credit: 0,
        net_amount: 0
      },
      by_type: facetResults.by_type || [],
      top_merchants: facetResults.by_merchant || [],
      by_category: facetResults.by_category || []
    });
  } catch (error) {
    console.error("❌ Error fetching aggregate stats:", error);
    return res.status(500).json({
      error: "Failed to fetch stats",
      message: error.message
    });
  }
});

/**
 * PATCH /transactions/:id
 * Update transaction (category, tags, notes)
 */
router.patch("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    const { category, tags, notes } = req.body;

    const transaction = await Transaction.findOne({
      _id: id,
      user_id
    });

    if (!transaction) {
      return res.status(404).json({
        error: "Transaction not found"
      });
    }

    if (category !== undefined) transaction.category = category;
    if (tags !== undefined) transaction.tags = Array.isArray(tags) ? tags : [];
    if (notes !== undefined) transaction.notes = notes;

    transaction.updated_at = new Date();
    await transaction.save();

    return res.json({
      status: "ok",
      transaction: formatTransaction(transaction)
    });
  } catch (error) {
    console.error("❌ Error updating transaction:", error);
    return res.status(500).json({
      error: "Failed to update transaction",
      message: error.message
    });
  }
});

/**
 * DELETE /transactions/:id
 * (Soft) delete transaction
 */
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      _id: id,
      user_id
    });

    if (!transaction) {
      return res.status(404).json({
        error: "Transaction not found"
      });
    }

    // Soft delete by marking or removing
    await Transaction.deleteOne({ _id: id });

    return res.json({
      status: "ok",
      message: "Transaction deleted"
    });
  } catch (error) {
    console.error("❌ Error deleting transaction:", error);
    return res.status(500).json({
      error: "Failed to delete transaction",
      message: error.message
    });
  }
});

/**
 * POST /transactions/:id/link-refund
 * Link a refund transaction to original transaction
 */
router.post("/:id/link-refund", authenticateUser, async (req, res, next) => {
  try {
    const { refund_tx_id } = req.body;

    if (!refund_tx_id) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "refund_tx_id is required",
      });
    }

    const result = await linkRefund(req.user.user_id, req.params.id, refund_tx_id);

    res.json({
      success: true,
      message: "Refund linked successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /transactions/:id/unlink-refund
 * Unlink refund from original transaction
 */
router.delete("/:id/unlink-refund", authenticateUser, async (req, res, next) => {
  try {
    const result = await unlinkRefund(req.user.user_id, req.params.id);

    res.json({
      success: true,
      message: "Refund unlinked successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /transactions/:id/potential-refunds
 * Get potential refund candidates for a transaction
 */
router.get("/:id/potential-refunds", authenticateUser, async (req, res, next) => {
  try {
    const candidates = await getPotentialRefunds(req.user.user_id, req.params.id);

    res.json({
      success: true,
      total: candidates.length,
      data: candidates,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /transactions/refunds/pairs
 * Get all refund pairs for user
 */
router.get("/refunds/pairs", authenticateUser, async (req, res, next) => {
  try {
    const pairs = await getRefundPairs(req.user.user_id);

    res.json({
      success: true,
      total: pairs.length,
      data: pairs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /transactions/refunds/auto-link
 * Auto-link potential refunds
 */
router.post("/refunds/auto-link", authenticateUser, async (req, res, next) => {
  try {
    const result = await autoLinkRefunds(req.user.user_id);

    res.json({
      success: true,
      message: "Auto-linking complete",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /transactions/refunds/net-spend
 * Get net spend (after refunds) for date range
 */
router.get("/refunds/net-spend", authenticateUser, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "start_date and end_date are required",
      });
    }

    const result = await calculateNetSpend(
      req.user.user_id,
      new Date(start_date),
      new Date(end_date)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /transactions/manual
 * Create a manual transaction (cash spend) for the user
 */
router.post('/manual', authenticateUser, async (req, res) => {
  try {
    console.log('POST /transactions/manual body:', JSON.stringify(req.body));
    const { user_id } = req.user;
    const { amount, merchant = 'Cash Spend', notes, transaction_time } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'amount is required and must be > 0' });
    }

    // Find or create a cash account for the user
    let account = await Account.findOne({ user_id, account_type: 'cash' });
    if (!account) {
      account = new Account({
        user_id,
        bank_name: 'Cash',
        account_number: null,
        account_holder: null,
        created_from_sms: false,
        account_type: 'cash',
        current_balance: null
      });
      await account.save();
    }

    const txTime = transaction_time ? new Date(transaction_time) : new Date();

    const dedupHash = crypto.randomBytes(16).toString('hex');

    const TransactionModel = require('../models/Transaction');
    const transaction = new TransactionModel({
      user_id,
      account_id: account._id,
      amount: Number(amount),
      original_amount: Number(amount),
      net_amount: Number(amount),
      type: 'debit',
      merchant,
      notes: notes || null,
      bank_name: account.bank_name,
      account_number: account.account_number || null,
      raw_message: `manual_entry:${user_id}:${Date.now()}`,
      dedup_hash: dedupHash,
      source: 'manual',
      transaction_time: txTime,
      received_time: new Date(),
      time_confidence: 'exact'
    });

    await transaction.save();

    // Update cash account balance if possible
    try {
      const { updateBalanceCalculated } = require('../services/account.service');
      await updateBalanceCalculated(account._id, 'debit', Number(amount));
    } catch (e) {
      // non-fatal
      console.warn('Failed to update calculated balance for cash account', e.message || e);
    }

    return res.status(201).json({ success: true, transaction: transaction });
  } catch (err) {
    console.error('Error creating manual transaction', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
});

module.exports = router;

