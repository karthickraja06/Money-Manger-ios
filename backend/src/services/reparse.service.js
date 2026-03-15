const Transaction = require("../models/Transaction");
const { parseTransaction } = require("./parser.service");

/**
 * Re-parse a single transaction
 * Updates ONLY: merchant, bank_name, reference_number, transaction_time
 * DOES NOT update: amount, type, category (to avoid balance recalculation issues)
 */
module.exports.reparseTransaction = async (transactionId) => {
  const txn = await Transaction.findById(transactionId);
  if (!txn) throw new Error("Transaction not found");

  const originalData = { ...txn.toObject() };

  // Re-parse the raw message
  const parsed = await parseTransaction(txn.raw_message || "");

  // Update ONLY these fields (safe fields that don't affect balance)
  txn.merchant = parsed.merchant || txn.merchant;
  txn.bank_name = parsed.bank_name ? parsed.bank_name.toUpperCase() : txn.bank_name;
  txn.reference_number = parsed.reference_number || txn.reference_number;
  txn.transaction_time = parsed.transaction_time || txn.transaction_time;
  txn.parsed_at = new Date();

  // DO NOT update these (to preserve balance calculations):
  // - amount (already correct from SMS)
  // - type (already correct from SMS)
  // - category (user may have manually categorized)

  await txn.save();

  return {
    transaction_id: txn._id,
    originalData,
    updatedData: txn.toObject(),
    changes: {
      merchant: originalData.merchant !== txn.merchant,
      bank_name: originalData.bank_name !== txn.bank_name,
      reference_number: originalData.reference_number !== txn.reference_number,
      transaction_time: originalData.transaction_time !== txn.transaction_time,
    },
  };
};

/**
 * Re-parse multiple transactions
 */
module.exports.reparseTransactions = async (transactionIds = []) => {
  let transactions;

  if (transactionIds.length > 0) {
    // Re-parse specific transactions
    transactions = await Transaction.find({ _id: { $in: transactionIds } });
  } else {
    // Re-parse ALL transactions
    transactions = await Transaction.find({});
  }

  console.log(`[REPARSE] Starting re-parse for ${transactions.length} transactions`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const txn of transactions) {
    try {
      const result = await module.exports.reparseTransaction(txn._id);
      results.push({
        ...result,
        status: "success",
      });
      successCount++;
    } catch (error) {
      results.push({
        transaction_id: txn._id,
        status: "error",
        error: error.message,
      });
      errorCount++;
    }
  }

  console.log(
    `[REPARSE] Complete - ${successCount} success, ${errorCount} errors`
  );

  return {
    total: transactions.length,
    successCount,
    errorCount,
    results,
  };
};
