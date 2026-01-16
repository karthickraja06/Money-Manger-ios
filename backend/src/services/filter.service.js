/**
 * Filter Service - Build MongoDB query filters for transactions
 * Handles: date range, type, account, merchant, category, tags, etc.
 */

/**
 * Build filter query for transactions
 * @param {object} filters - Filter parameters
 * @returns {object} MongoDB query object
 */
module.exports.buildTransactionFilters = (filters) => {
  const query = {};

  // User ID (always required)
  if (filters.user_id) {
    query.user_id = filters.user_id;
  }

  // Date range filters
  if (filters.start_date || filters.end_date) {
    query.transaction_time = {};
    
    if (filters.start_date) {
      const startDate = new Date(filters.start_date);
      if (!isNaN(startDate.getTime())) {
        query.transaction_time.$gte = startDate;
      }
    }
    
    if (filters.end_date) {
      const endDate = new Date(filters.end_date);
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
      if (!isNaN(endDate.getTime())) {
        query.transaction_time.$lte = endDate;
      }
    }
  }

  // Transaction type filter (multi-select)
  if (filters.type && Array.isArray(filters.type) && filters.type.length > 0) {
    query.type = { $in: filters.type };
  } else if (filters.type && typeof filters.type === "string") {
    query.type = filters.type;
  }

  // Account filter (multi-select)
  if (filters.account_ids && Array.isArray(filters.account_ids) && filters.account_ids.length > 0) {
    const ObjectId = require("mongoose").Types.ObjectId;
    query.account_id = { $in: filters.account_ids.map(id => new ObjectId(id)) };
  }

  // Bank name filter
  if (filters.bank_name) {
    query.bank_name = filters.bank_name.toLowerCase();
  }

  // Merchant search (partial match)
  if (filters.merchant) {
    query.merchant = { $regex: filters.merchant, $options: "i" };
  }

  // Category filter
  if (filters.category) {
    query.category = filters.category;
  }

  // Tags filter (contains any tag)
  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  // Refund status filter
  if (filters.refund_status) {
    if (filters.refund_status === "linked") {
      query.linked_refunds = { $exists: true, $ne: [] };
    } else if (filters.refund_status === "unlinked") {
      query.linked_refunds = { $exists: true, $eq: [] };
    } else if (filters.refund_status === "is_refund") {
      query.is_refund_of = { $ne: null };
    }
  }

  // Amount range
  if (filters.min_amount !== undefined || filters.max_amount !== undefined) {
    query.net_amount = {};
    if (filters.min_amount !== undefined) {
      query.net_amount.$gte = parseFloat(filters.min_amount);
    }
    if (filters.max_amount !== undefined) {
      query.net_amount.$lte = parseFloat(filters.max_amount);
    }
  }

  // Receiver/Sender name search
  if (filters.receiver_name) {
    query.receiver_name = { $regex: filters.receiver_name, $options: "i" };
  }

  if (filters.sender_name) {
    query.sender_name = { $regex: filters.sender_name, $options: "i" };
  }

  return query;
};

/**
 * Build aggregation pipeline for transaction stats
 * @param {object} filters - Filter parameters
 * @returns {array} MongoDB aggregation pipeline
 */
module.exports.buildAggregationPipeline = (filters) => {
  const matchStage = { $match: module.exports.buildTransactionFilters(filters) };

  return [
    matchStage,
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              total_transactions: { $sum: 1 },
              total_debit: {
                $sum: {
                  $cond: [
                    { $in: ["$type", ["debit", "atm"]] },
                    "$net_amount",
                    0
                  ]
                }
              },
              total_credit: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", "credit"] },
                    "$net_amount",
                    0
                  ]
                }
              },
              net_amount: {
                $sum: {
                  $cond: [
                    { $in: ["$type", ["debit", "atm"]] },
                    { $multiply: ["$net_amount", -1] },
                    "$net_amount"
                  ]
                }
              },
              avg_transaction: { $avg: "$net_amount" },
              min_transaction: { $min: "$net_amount" },
              max_transaction: { $max: "$net_amount" }
            }
          }
        ],
        by_type: [
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
              total: { $sum: "$net_amount" },
              avg: { $avg: "$net_amount" }
            }
          }
        ],
        by_merchant: [
          {
            $group: {
              _id: "$merchant",
              count: { $sum: 1 },
              total: { $sum: "$net_amount" },
              latest: { $max: "$transaction_time" }
            }
          },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ],
        by_category: [
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              total: { $sum: "$net_amount" }
            }
          },
          { $sort: { total: -1 } }
        ]
      }
    }
  ];
};

/**
 * Build sorting object
 */
module.exports.buildSort = (sortBy = "transaction_time", order = "desc") => {
  const validSortFields = [
    "transaction_time",
    "amount",
    "merchant",
    "created_at",
    "net_amount"
  ];

  if (!validSortFields.includes(sortBy)) {
    sortBy = "transaction_time";
  }

  const direction = order === "asc" ? 1 : -1;
  return { [sortBy]: direction };
};

/**
 * Get pagination params
 */
module.exports.getPagination = (page = 1, limit = 20) => {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.max(1, Math.min(100, parseInt(limit) || 20)); // Max 100 per page

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Format transaction for response
 */
module.exports.formatTransaction = (txn) => {
  return {
    id: txn._id,
    amount: txn.amount,
    original_amount: txn.original_amount,
    net_amount: txn.net_amount,
    type: txn.type,
    merchant: txn.merchant,
    receiver_name: txn.receiver_name,
    sender_name: txn.sender_name,
    bank_name: txn.bank_name,
    category: txn.category,
    tags: txn.tags,
    notes: txn.notes,
    transaction_time: txn.transaction_time,
    received_time: txn.received_time,
    time_confidence: txn.time_confidence,
    is_refund_of: txn.is_refund_of,
    linked_refunds: txn.linked_refunds,
    created_at: txn.created_at
  };
};

/**
 * Format account for response
 */
module.exports.formatAccount = (account) => {
  return {
    id: account._id,
    bank_name: account.bank_name,
    account_number: account.account_number,
    account_holder: account.account_holder,
    current_balance: account.current_balance,
    balance_source: account.balance_source,
    balance_confidence: account.balance_confidence,
    last_balance_update_at: account.last_balance_update_at,
    account_type: account.account_type,
    is_active: account.is_active,
    created_at: account.created_at
  };
};
