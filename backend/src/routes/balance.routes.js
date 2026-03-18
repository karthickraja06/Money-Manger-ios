const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const {
  reconcileBalance,
  applyReconciledBalance,
  applyReconciledBalances,
  reconcileAllBalances
} = require("../services/balance.service");

/**
 * GET /balance/reconcile/:accountId
 * Get reconciled balance for an account (view only, doesn't update)
 */
router.get("/reconcile/:accountId", authenticateUser, async (req, res, next) => {
  try {
    const { accountId } = req.params;

    console.log(`[BALANCE-ROUTES] Reconciling balance for account ${accountId}`);

    const result = await reconcileBalance(accountId);

    return res.json({
      status: "ok",
      ...result
    });
  } catch (error) {
    console.error("[BALANCE-ROUTES] Error:", error);
    next(error);
  }
});

/**
 * POST /balance/apply/:accountId
 * Apply reconciled balance to account
 */
router.post("/apply/:accountId", authenticateUser, async (req, res, next) => {
  try {
    const { accountId } = req.params;

    console.log(`[BALANCE-ROUTES] Applying reconciled balance to account ${accountId}`);

    const result = await applyReconciledBalance(accountId);

    return res.json({
      status: "ok",
      ...result
    });
  } catch (error) {
    console.error("[BALANCE-ROUTES] Error:", error);
    next(error);
  }
});

/**
 * POST /balance/apply-all
 * Apply reconciled balances for all accounts
 * 
 * Body (optional):
 * {
 *   account_ids?: string[]  // Specific accounts to update, or all if empty
 * }
 */
router.post("/apply-all", authenticateUser, async (req, res, next) => {
  try {
    const { account_ids = [] } = req.body;

    console.log(`[BALANCE-ROUTES] Applying reconciled balances${
      account_ids.length > 0 ? ` for ${account_ids.length} accounts` : " for all accounts"
    }`);

    const result = await applyReconciledBalances(account_ids);

    return res.json({
      status: "ok",
      message: `Applied reconciled balances to ${result.success_count} accounts`,
      ...result
    });
  } catch (error) {
    console.error("[BALANCE-ROUTES] Error:", error);
    next(error);
  }
});

module.exports = router;
