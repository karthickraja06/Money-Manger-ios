const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const { reparseTransactions } = require("../services/reparse.service");

/**
 * POST /reparse/transactions
 * Re-parse transactions through the parser
 * 
 * Body:
 * {
 *   transaction_ids?: string[]  // If empty, re-parse ALL transactions
 * }
 * 
 * Returns: Results of re-parsing with success/error details
 */
router.post("/transactions", authenticateUser, async (req, res, next) => {
  try {
    const { user_id } = req.user;
    const { transaction_ids = [] } = req.body;

    console.log(`[REPARSE-ROUTES] User ${user_id} requesting re-parse`, {
      transactionCount: transaction_ids.length || "ALL",
    });

    const results = await reparseTransactions(transaction_ids);

    return res.json({
      status: "ok",
      message: `Re-parsed ${results.successCount} transactions`,
      ...results,
    });
  } catch (error) {
    console.error("[REPARSE-ROUTES] Error:", error);
    next(error);
  }
});

module.exports = router;
