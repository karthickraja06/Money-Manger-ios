const Transaction = require("../models/Transaction");

/**
 * Link a transaction as refund for another transaction
 */
async function linkRefund(user_id, original_tx_id, refund_tx_id) {
  const [originalTx, refundTx] = await Promise.all([
    Transaction.findOne({ _id: original_tx_id, user_id }),
    Transaction.findOne({ _id: refund_tx_id, user_id }),
  ]);

  if (!originalTx || !refundTx) {
    throw new Error("Transaction not found");
  }

  if (originalTx.type !== "debit") {
    throw new Error("Original transaction must be a debit");
  }

  if (refundTx.type !== "credit") {
    throw new Error("Refund transaction must be a credit");
  }

  if (refundTx.amount !== originalTx.amount) {
    throw new Error("Refund amount must match original transaction");
  }

  // Update original transaction with refund reference
  originalTx.refund_linked_id = refund_tx_id;
  originalTx.refund_status = "refunded";
  originalTx.refund_date = new Date();
  await originalTx.save();

  // Update refund transaction
  refundTx.is_refund = true;
  refundTx.original_transaction_id = original_tx_id;
  refundTx.refund_for_merchant = originalTx.merchant;
  await refundTx.save();

  return {
    original_id: original_tx_id,
    refund_id: refund_tx_id,
    amount: originalTx.amount,
    status: "linked",
  };
}

/**
 * Unlink a refund from original transaction
 */
async function unlinkRefund(user_id, original_tx_id) {
  const originalTx = await Transaction.findOne({ _id: original_tx_id, user_id });

  if (!originalTx) {
    throw new Error("Transaction not found");
  }

  if (!originalTx.refund_linked_id) {
    throw new Error("No refund linked to this transaction");
  }

  const refund_tx_id = originalTx.refund_linked_id;

  // Update original transaction
  originalTx.refund_linked_id = null;
  originalTx.refund_status = null;
  originalTx.refund_date = null;
  await originalTx.save();

  // Update refund transaction
  await Transaction.updateOne(
    { _id: refund_tx_id },
    {
      $set: {
        is_refund: false,
        original_transaction_id: null,
        refund_for_merchant: null,
      },
    }
  );

  return {
    original_id: original_tx_id,
    refund_id: refund_tx_id,
    status: "unlinked",
  };
}

/**
 * Get all refund pairs for a user
 */
async function getRefundPairs(user_id) {
  const originalTransactions = await Transaction.find({
    user_id,
    refund_linked_id: { $ne: null },
  }).select("_id amount merchant type refund_linked_id refund_date");

  const pairs = [];

  for (const original of originalTransactions) {
    const refund = await Transaction.findOne({
      _id: original.refund_linked_id,
      user_id,
    }).select("_id amount merchant type transaction_time");

    if (refund) {
      pairs.push({
        original: {
          id: original._id,
          amount: original.amount,
          merchant: original.merchant,
          type: original.type,
        },
        refund: {
          id: refund._id,
          amount: refund.amount,
          merchant: refund.merchant,
          type: refund.type,
          transaction_time: refund.transaction_time,
        },
        linked_date: original.refund_date,
      });
    }
  }

  return pairs;
}

/**
 * Get potential refund candidates for a transaction
 * (credit transactions with same/similar amount within 7 days)
 */
async function getPotentialRefunds(user_id, original_tx_id) {
  const originalTx = await Transaction.findOne({ _id: original_tx_id, user_id });

  if (!originalTx || originalTx.type !== "debit") {
    throw new Error("Original transaction must be a debit");
  }

  const sevenDaysAfter = new Date(
    originalTx.transaction_time.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  const candidates = await Transaction.find({
    user_id,
    type: "credit",
    amount: originalTx.amount,
    transaction_time: {
      $gte: originalTx.transaction_time,
      $lte: sevenDaysAfter,
    },
    is_refund: false,
    refund_linked_id: null,
  }).select("_id amount merchant type transaction_time");

  return candidates;
}

/**
 * Calculate net spend (after refunds)
 */
async function calculateNetSpend(user_id, startDate, endDate) {
  const transactions = await Transaction.aggregate([
    {
      $match: {
        user_id,
        transaction_time: { $gte: startDate, $lte: endDate },
        type: "debit",
        is_refund: false,
      },
    },
    {
      $lookup: {
        from: "transactions",
        let: { refund_id: "$refund_linked_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$refund_id"] },
            },
          },
        ],
        as: "refund",
      },
    },
    {
      $group: {
        _id: null,
        total_debits: { $sum: "$amount" },
        total_refunded: {
          $sum: {
            $cond: [{ $gt: [{ $size: "$refund" }, 0] }, "$amount", 0],
          },
        },
        refund_count: {
          $sum: {
            $cond: [{ $gt: [{ $size: "$refund" }, 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  const result = transactions[0] || { total_debits: 0, total_refunded: 0, refund_count: 0 };

  return {
    total_debits: result.total_debits,
    total_refunded: result.total_refunded,
    net_spend: result.total_debits - result.total_refunded,
    refund_count: result.refund_count,
  };
}

/**
 * Auto-link potential refunds based on amount and merchant
 */
async function autoLinkRefunds(user_id) {
  const debits = await Transaction.find({
    user_id,
    type: "debit",
    refund_linked_id: null,
    is_refund: false,
  });

  let linked = 0;

  for (const debit of debits) {
    const candidates = await getPotentialRefunds(user_id, debit._id);

    if (candidates.length > 0) {
      const bestCandidate = candidates[0]; // Take first match
      try {
        await linkRefund(user_id, debit._id, bestCandidate._id);
        linked++;
      } catch (err) {
        // Skip if linking fails
      }
    }
  }

  return { linked, total_checked: debits.length };
}

module.exports = {
  linkRefund,
  unlinkRefund,
  getRefundPairs,
  getPotentialRefunds,
  calculateNetSpend,
  autoLinkRefunds,
};
