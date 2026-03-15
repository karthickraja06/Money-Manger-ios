const Transaction = require("../models/Transaction");
const { parseTransaction } = require("./parser.service");

/**
 * Re-parse a single transaction
 * Updates merchant, bank_name, category, and other extracted fields
 */
module.exports.reparseTransaction = async (transactionId) => {
  const txn = await Transaction.findById(transactionId);
  if (!txn) throw new Error("Transaction not found");

  const originalData = { ...txn.toObject() };

  // Re-parse the raw message
  const parsed = await parseTransaction(txn.raw_message || "");

  // Update transaction fields
  txn.merchant = parsed.merchant || txn.merchant;
  txn.bank_name = parsed.bank_name ? parsed.bank_name.toUpperCase() : txn.bank_name;
  txn.category = parsed.category || txn.category;
  txn.amount = parsed.amount || txn.amount;
  txn.type = parsed.type || txn.type;
  txn.reference_number = parsed.reference_number || txn.reference_number;
  txn.transaction_time = parsed.transaction_time || txn.transaction_time;
  txn.parsed_at = new Date();

  await txn.save();

  return {
    transaction_id: txn._id,
    originalData,
    updatedData: txn.toObject(),
    changes: {
      merchant: originalData.merchant !== txn.merchant,
      bank_name: originalData.bank_name !== txn.bank_name,
      category: originalData.category !== txn.category,
      amount: originalData.amount !== txn.amount,
      type: originalData.type !== txn.type,
      reference_number: originalData.reference_number !== txn.reference_number,
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
