const express = require("express");
const { validateRequest } = require("../middleware/errorHandler");
const merchantService = require("../services/merchant.service");

const router = express.Router();

/**
 * GET /merchants/stats
 * Get merchant statistics for user
 */
router.get("/stats", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const stats = await merchantService.getMerchantStats(user_id);
    res.json({ merchants: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /merchants/:merchant/transactions
 * Get all transactions for a specific merchant
 */
router.get("/:merchant/transactions", async (req, res, next) => {
  try {
    const user_id = req.user_id;
    const { merchant } = req.params;
    const { limit = 50 } = req.query;

    const transactions = await merchantService.getTransactionsByMerchant(
      user_id,
      merchant,
      parseInt(limit)
    );

    res.json({
      merchant,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /merchants/rename
 * Bulk update merchant name across all transactions
 * Body: { old_merchant: string, new_merchant: string }
 */
router.post("/rename", async (req, res, next) => {
  try {
    validateRequest(req.body, ["old_merchant", "new_merchant"]);

    const user_id = req.user_id;
    const { old_merchant, new_merchant } = req.body;

    const result = await merchantService.bulkUpdateMerchantName(
      user_id,
      old_merchant,
      new_merchant
    );

    res.json({
      message: `Successfully updated ${result.updated} transactions`,
      old_merchant,
      new_merchant,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /merchants/merge
 * Merge merchant name variations into one canonical name
 * Body: { merchant_variations: string[], canonical_name: string }
 */
router.post("/merge", async (req, res, next) => {
  try {
    validateRequest(req.body, ["merchant_variations", "canonical_name"]);

    const user_id = req.user_id;
    const result = await merchantService.mergeMerchantIdentities(
      user_id,
      req.body.merchant_variations,
      req.body.canonical_name
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
