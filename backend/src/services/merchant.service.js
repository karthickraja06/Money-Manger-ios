const Transaction = require("../models/Transaction");

/**
 * Bulk update merchant name across all transactions
 * Maps old merchant name to new merchant name
 */
async function bulkUpdateMerchantName(user_id, old_merchant, new_merchant) {
  if (!old_merchant || !new_merchant) {
    throw new Error("Both old_merchant and new_merchant are required");
  }

  // Case-insensitive match
  const result = await Transaction.updateMany(
    {
      user_id,
      merchant: { $regex: `^${old_merchant}$`, $options: "i" },
    },
    {
      $set: { merchant: new_merchant },
    }
  );

  return {
    updated: result.modifiedCount,
    matched: result.matchedCount,
  };
}

/**
 * Get merchant statistics for a user
 */
async function getMerchantStats(user_id) {
  const merchants = await Transaction.aggregate([
    { $match: { user_id } },
    {
      $group: {
        _id: "$merchant",
        count: { $sum: 1 },
        total_amount: { $sum: "$amount" },
        last_seen: { $max: "$transaction_time" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);

  return merchants;
}

/**
 * Get transactions for a specific merchant
 */
async function getTransactionsByMerchant(user_id, merchant, limit = 50) {
  return Transaction.find(
    {
      user_id,
      merchant: { $regex: `^${merchant}$`, $options: "i" },
    },
    null,
    { sort: { transaction_time: -1 }, limit }
  );
}

/**
 * Merge merchant identities (consolidate variations)
 * Useful for Zomato, Zomato Food Service, etc.
 */
async function mergeMerchantIdentities(user_id, merchant_variations, canonical_name) {
  if (!Array.isArray(merchant_variations) || merchant_variations.length === 0) {
    throw new Error("merchant_variations must be a non-empty array");
  }

  const regex = merchant_variations.map(m => `^${m}$`).join("|");
  const result = await Transaction.updateMany(
    {
      user_id,
      merchant: { $regex: regex, $options: "i" },
    },
    {
      $set: { merchant: canonical_name },
    }
  );

  return {
    updated: result.modifiedCount,
    canonical: canonical_name,
    merged_variations: merchant_variations,
  };
}

module.exports = {
  bulkUpdateMerchantName,
  getMerchantStats,
  getTransactionsByMerchant,
  mergeMerchantIdentities,
};
