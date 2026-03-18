const Transaction = require("../models/Transaction");
const Account = require("../models/Account");

/**
 * Reconcile account balance from transactions
 * 
 * Algorithm:
 * 1. Find the latest balance confirmation message (balance_after field)
 * 2. Get the timestamp of that message
 * 3. Apply only transactions that happened at or after that timestamp (>=)
 * 4. Calculate: balance = balance_after_confirmation + sum(transactions >= timestamp)
 * 
 * Example:
 * - Balance message at 2026-03-18 10:00 PM: balance = 1000
 * - Debit at 2026-03-18 09:59 PM: -100 (IGNORED - before balance confirmation)
 * - Credit at 2026-03-18 10:01 PM: +150 (INCLUDED)
 * - Debit at 2026-03-18 10:30 PM: -75 (INCLUDED)
 * - Final balance: 1000 + 150 - 75 = 1075
 */
module.exports.reconcileBalance = async (accountId) => {
  try {
    const account = await Account.findById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Get all transactions for this account
    const transactions = await Transaction.find({
      account_id: accountId
    }).sort({ transaction_time: 1 });

    if (transactions.length === 0) {
      console.log(`[BALANCE] No transactions found for account ${accountId}`);
      return {
        account_id: accountId,
        status: 'no_transactions',
        reconciled_balance: null
      };
    }

    // Find latest balance confirmation message
    const balanceConfirmation = transactions
      .filter(t => t.balance_after !== null && t.balance_after !== undefined)
      .sort((a, b) => new Date(b.transaction_time) - new Date(a.transaction_time))[0];

    if (!balanceConfirmation) {
      console.log(`[BALANCE] No balance confirmation found for account ${accountId}`);
      return {
        account_id: accountId,
        status: 'no_balance_confirmation',
        reconciled_balance: null,
        note: 'No balance confirmation message in transactions'
      };
    }

    const confirmationTime = new Date(balanceConfirmation.transaction_time);
    const confirmationBalance = balanceConfirmation.balance_after;

    console.log(`[BALANCE] Found balance confirmation at ${confirmationTime.toISOString()}: ${confirmationBalance}`);

    // Get transactions after (>=) the confirmation time
    const applicableTransactions = transactions.filter(t => {
      const txTime = new Date(t.transaction_time);
      return txTime >= confirmationTime && t._id.toString() !== balanceConfirmation._id.toString();
    });

    // Calculate balance changes from applicable transactions
    let balanceChange = 0;
    const appliedTransactions = [];

    for (const tx of applicableTransactions) {
      if (tx.type === 'debit' || tx.type === 'atm' || tx.type === 'cash') {
        balanceChange -= (tx.net_amount || tx.amount);
        appliedTransactions.push({
          id: tx._id,
          merchant: tx.merchant,
          type: tx.type,
          amount: -(tx.net_amount || tx.amount),
          time: tx.transaction_time
        });
      } else if (tx.type === 'credit') {
        balanceChange += (tx.net_amount || tx.amount);
        appliedTransactions.push({
          id: tx._id,
          merchant: tx.merchant,
          type: tx.type,
          amount: tx.net_amount || tx.amount,
          time: tx.transaction_time
        });
      }
    }

    const reconciledBalance = confirmationBalance + balanceChange;

    console.log(`[BALANCE] Reconciled balance for account ${accountId}:`, {
      confirmationBalance,
      balanceChange,
      reconciledBalance,
      applicableTransactionCount: appliedTransactions.length
    });

    return {
      account_id: accountId,
      status: 'success',
      confirmation_time: confirmationTime,
      confirmation_balance: confirmationBalance,
      balance_change: balanceChange,
      reconciled_balance: reconciledBalance,
      applied_transaction_count: appliedTransactions.length,
      applied_transactions: appliedTransactions.slice(0, 20) // Last 20 for brevity
    };
  } catch (error) {
    console.error(`[BALANCE] Error reconciling balance for account ${accountId}:`, error);
    throw error;
  }
};

/**
 * Reconcile balances for all accounts
 */
module.exports.reconcileAllBalances = async () => {
  try {
    const accounts = await Account.find({ is_active: true });

    console.log(`[BALANCE] Starting balance reconciliation for ${accounts.length} accounts`);

    const results = [];
    for (const account of accounts) {
      try {
        const result = await module.exports.reconcileBalance(account._id);
        results.push(result);
      } catch (error) {
        console.error(`[BALANCE] Error reconciling ${account._id}:`, error.message);
        results.push({
          account_id: account._id,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      total_accounts: accounts.length,
      results
    };
  } catch (error) {
    console.error('[BALANCE] Error in reconcileAllBalances:', error);
    throw error;
  }
};

/**
 * Update account balance if reconciliation succeeded
 */
module.exports.applyReconciledBalance = async (accountId) => {
  try {
    const result = await module.exports.reconcileBalance(accountId);

    if (result.status !== 'success') {
      console.log(`[BALANCE] Cannot apply reconciled balance: ${result.status}`);
      return result;
    }

    // Update account with reconciled balance
    const account = await Account.findByIdAndUpdate(
      accountId,
      {
        current_balance: result.reconciled_balance,
        balance_source: 'calculated',
        last_balance_update_at: new Date(),
        updated_at: new Date()
      },
      { new: true }
    );

    console.log(`[BALANCE] Updated account ${accountId} balance to ${result.reconciled_balance}`);

    return {
      ...result,
      account_updated: true,
      new_balance: account.current_balance
    };
  } catch (error) {
    console.error(`[BALANCE] Error applying reconciled balance:`, error);
    throw error;
  }
};

/**
 * Batch update balances for multiple accounts
 */
module.exports.applyReconciledBalances = async (accountIds = []) => {
  let accounts;

  if (accountIds.length > 0) {
    accounts = await Account.find({ _id: { $in: accountIds } });
  } else {
    accounts = await Account.find({ is_active: true });
  }

  console.log(`[BALANCE] Applying reconciled balances for ${accounts.length} accounts`);

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const account of accounts) {
    try {
      const result = await module.exports.applyReconciledBalance(account._id);
      results.push(result);
      if (result.status === 'success') {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`[BALANCE] Error updating ${account._id}:`, error.message);
      results.push({
        account_id: account._id,
        status: 'error',
        error: error.message
      });
      failureCount++;
    }
  }

  return {
    total: accounts.length,
    success_count: successCount,
    failure_count: failureCount,
    results
  };
};
