const express = require("express");
const router = express.Router();
const Budget = require("../models/Budget");
const Category = require("../models/Category");
const {
  getOrCreateDefaultBudgets,
  getBudgetStatus,
  getAllBudgetsWithStatus,
  updateBudgetSpent,
  getBudgetAlerts,
  createCategory,
  autoCategorizeMerchant,
  autoCategorizeTransactions,
} = require("../services/budget.service");
const { authenticateUser } = require("../middleware/auth");

/**
 * GET /budgets
 * Get all budgets for user with current status
 */
router.get("/", authenticateUser, async (req, res, next) => {
  try {
    const budgets = await getAllBudgetsWithStatus(req.user.user_id);

    res.json({
      success: true,
      total: budgets.length,
      data: budgets,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /budgets/alerts
 * Get budget alerts (exceeding, near limit)
 */
router.get("/alerts", authenticateUser, async (req, res, next) => {
  try {
    const alerts = await getBudgetAlerts(req.user.user_id);

    res.json({
      success: true,
      alerts,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /budgets/:category
 * Get budget for specific category
 */
router.get("/:category", authenticateUser, async (req, res, next) => {
  try {
    const status = await getBudgetStatus(req.user.user_id, req.params.category);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: "BUDGET_NOT_FOUND",
        message: "Budget not found for this category",
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /budgets
 * Create or update budget
 */
router.post("/", authenticateUser, async (req, res, next) => {
  try {
    // Log incoming payload for debugging
    console.log('POST /budgets payload:', JSON.stringify(req.body));
    const { category, monthly_limit, alert_threshold, reset_day, notes } = req.body;

    if (!category || monthly_limit === undefined) {
      console.error('Validation failed for POST /budgets, missing fields', { category, monthly_limit });
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "category and monthly_limit are required",
      });
    }

    const budget = await Budget.findOneAndUpdate(
      { user_id: req.user.user_id, category },
      {
        user_id: req.user.user_id,
        category,
        monthly_limit,
        alert_threshold: alert_threshold || 80,
        reset_day: reset_day || 1,
        notes,
        is_active: true,
      },
      { upsert: true, new: true }
    );

    const status = await getBudgetStatus(req.user.user_id, category);

    res.status(201).json({
      success: true,
      message: "Budget created/updated",
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /budgets/:category
 * Update budget
 */
router.patch("/:category", authenticateUser, async (req, res, next) => {
  try {
    const { monthly_limit, alert_threshold, reset_day, notes, is_active } = req.body;

    const budget = await Budget.findOneAndUpdate(
      { user_id: req.user.user_id, category: req.params.category },
      {
        $set: {
          ...(monthly_limit !== undefined && { monthly_limit }),
          ...(alert_threshold !== undefined && { alert_threshold }),
          ...(reset_day !== undefined && { reset_day }),
          ...(notes !== undefined && { notes }),
          ...(is_active !== undefined && { is_active }),
        },
      },
      { new: true }
    );

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: "BUDGET_NOT_FOUND",
        message: "Budget not found",
      });
    }

    const status = await getBudgetStatus(req.user.user_id, req.params.category);

    res.json({
      success: true,
      message: "Budget updated",
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /budgets/:category
 * Delete budget
 */
router.delete("/:category", authenticateUser, async (req, res, next) => {
  try {
    const result = await Budget.deleteOne({
      user_id: req.user.user_id,
      category: req.params.category,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "BUDGET_NOT_FOUND",
        message: "Budget not found",
      });
    }

    res.json({
      success: true,
      message: "Budget deleted",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /categories
 * Create custom category
 */
router.post("/categories", authenticateUser, async (req, res, next) => {
  try {
    const { name, parent_category, keywords, merchant_patterns, color, icon } = req.body;

    if (!name || !parent_category) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "name and parent_category are required",
      });
    }

    const category = await Category.findOneAndUpdate(
      { user_id: req.user.user_id, name },
      {
        user_id: req.user.user_id,
        name,
        parent_category,
        keywords: keywords || [],
        merchant_patterns: merchant_patterns || [],
        color: color || "#808080",
        icon,
        is_active: true,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: "Category created",
      data: category,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /categories
 * Get all custom categories
 */
router.get("/categories", authenticateUser, async (req, res, next) => {
  try {
    const categories = await Category.find({ user_id: req.user.user_id, is_active: true });

    res.json({
      success: true,
      total: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /categories/:id
 * Update category
 */
router.patch("/categories/:id", authenticateUser, async (req, res, next) => {
  try {
    const { keywords, merchant_patterns, color, icon, is_active } = req.body;

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.user_id },
      {
        $set: {
          ...(keywords !== undefined && { keywords }),
          ...(merchant_patterns !== undefined && { merchant_patterns }),
          ...(color !== undefined && { color }),
          ...(icon !== undefined && { icon }),
          ...(is_active !== undefined && { is_active }),
        },
      },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category updated",
      data: category,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /budgets/auto-categorize
 * Auto-categorize transactions
 */
router.post("/auto-categorize", authenticateUser, async (req, res, next) => {
  try {
    const { limit = 100 } = req.body;

    const result = await autoCategorizeTransactions(req.user.user_id, limit);

    res.json({
      success: true,
      message: "Auto-categorization complete",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /budgets/init-defaults
 * Initialize default budgets for user
 */
router.post("/init-defaults", authenticateUser, async (req, res, next) => {
  try {
    await getOrCreateDefaultBudgets(req.user.user_id);

    const budgets = await getAllBudgetsWithStatus(req.user.user_id);

    res.status(201).json({
      success: true,
      message: "Default budgets created",
      total: budgets.length,
      data: budgets,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
