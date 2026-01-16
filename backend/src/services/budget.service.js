const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");

/**
 * Get or create default budget for a user
 */
async function getOrCreateDefaultBudgets(user_id) {
  const defaultCategories = [
    "Groceries",
    "Entertainment",
    "Transport",
    "Utilities",
    "Dining",
    "Shopping",
    "Health",
    "Education",
    "Travel",
    "Other",
  ];

  for (const category of defaultCategories) {
    await Budget.findOneAndUpdate(
      { user_id, category },
      {
        $setOnInsert: {
          monthly_limit: 5000,
          alert_threshold: 80,
          is_active: true,
        },
      },
      { upsert: true, new: true }
    );
  }
}

/**
 * Calculate spent amount for a category in current month
 */
async function calculateCategorySpent(user_id, category) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const result = await Transaction.aggregate([
    {
      $match: {
        user_id,
        category,
        type: "debit",
        transaction_time: { $gte: monthStart, $lte: monthEnd },
        is_refund: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0
    ? { spent: result[0].total, count: result[0].count }
    : { spent: 0, count: 0 };
}

/**
 * Get budget status for a category
 */
async function getBudgetStatus(user_id, category) {
  const budget = await Budget.findOne({ user_id, category });
  if (!budget) return null;

  const { spent, count } = await calculateCategorySpent(user_id, category);
  const percentage = budget.monthly_limit > 0
    ? Math.round((spent / budget.monthly_limit) * 100)
    : 0;

  return {
    category,
    monthly_limit: budget.monthly_limit,
    spent,
    remaining: Math.max(0, budget.monthly_limit - spent),
    percentage,
    transaction_count: count,
    alert_threshold: budget.alert_threshold,
    is_exceeding: percentage > 100,
    is_near_limit: percentage >= budget.alert_threshold && percentage <= 100,
  };
}

/**
 * Get all budgets with current status
 */
async function getAllBudgetsWithStatus(user_id) {
  const budgets = await Budget.find({ user_id, is_active: true });

  const statusList = await Promise.all(
    budgets.map((b) => getBudgetStatus(user_id, b.category))
  );

  return statusList.filter((b) => b !== null);
}

/**
 * Update budget spent amount (called after transaction update/delete)
 */
async function updateBudgetSpent(user_id, category) {
  const { spent } = await calculateCategorySpent(user_id, category);

  await Budget.updateOne(
    { user_id, category },
    { spent_this_month: spent }
  );
}

/**
 * Get budget alerts for user
 */
async function getBudgetAlerts(user_id) {
  const statuses = await getAllBudgetsWithStatus(user_id);

  return {
    exceeding: statuses.filter((s) => s.is_exceeding),
    near_limit: statuses.filter((s) => s.is_near_limit),
    all_categories: statuses,
  };
}

/**
 * Create category for auto-categorization
 */
async function createCategory(user_id, name, parent_category, keywords = []) {
  const category = await Category.findOneAndUpdate(
    { user_id, name },
    {
      $set: {
        parent_category,
        keywords,
        is_active: true,
      },
    },
    { upsert: true, new: true }
  );

  return category;
}

/**
 * Auto-categorize transaction based on merchant and keywords
 */
async function autoCategorizeMerchant(user_id, merchant) {
  if (!merchant) return "Other";

  const merchantLower = merchant.toLowerCase();

  // Check custom categories first
  const customCategory = await Category.findOne({
    user_id,
    is_active: true,
    $or: [
      { merchant_patterns: { $elemMatch: { $regex: merchantLower, $options: "i" } } },
      { keywords: { $elemMatch: { $regex: merchantLower, $options: "i" } } },
    ],
  });

  if (customCategory) return customCategory.parent_category;

  // Default mappings
  const merchantMappings = {
    Groceries: ["bigbasket", "amazon fresh", "instamart", "blinkit", "grofers", "fresh", "grocery"],
    Dining: ["zomato", "swiggy", "dunkin", "mcd", "kfc", "burger", "pizza", "restaurant", "cafe", "coffee"],
    Entertainment: ["netflix", "prime", "hotstar", "gaming", "movie", "theatre", "cinema"],
    Transport: ["uber", "ola", "fuel", "petrol", "metro", "bus", "railway", "parking"],
    Shopping: ["amazon", "flipkart", "myntra", "snapdeal", "ajio", "mall", "store"],
    Health: ["pharmacy", "medical", "hospital", "doctor", "clinic", "lab", "health"],
    Utilities: ["electricity", "water", "gas", "phone", "internet", "bill"],
    Travel: ["booking", "makemytrip", "goibibo", "hotel", "flight", "flight"],
  };

  for (const [category, keywords] of Object.entries(merchantMappings)) {
    for (const keyword of keywords) {
      if (merchantLower.includes(keyword)) {
        return category;
      }
    }
  }

  return "Other";
}

/**
 * Categorize all uncategorized transactions
 */
async function autoCategorizeTransactions(user_id, limit = 100) {
  const transactions = await Transaction.find({
    user_id,
    category: { $in: [null, "Other", undefined] },
  }).limit(limit);

  let updated = 0;

  for (const tx of transactions) {
    const category = await autoCategorizeMerchant(user_id, tx.merchant);
    await Transaction.updateOne({ _id: tx._id }, { category });
    updated++;
  }

  return { updated, total: transactions.length };
}

module.exports = {
  getOrCreateDefaultBudgets,
  calculateCategorySpent,
  getBudgetStatus,
  getAllBudgetsWithStatus,
  updateBudgetSpent,
  getBudgetAlerts,
  createCategory,
  autoCategorizeMerchant,
  autoCategorizeTransactions,
};
