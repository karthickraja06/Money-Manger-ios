const Transaction = require("../models/Transaction");
const { parseTransaction } = require("./parser.service");
const { parseTransactionsInBatches } = require("./gemini.service");

/**
 * Re-parse a single transaction
 * Updates: merchant, bank_name, reference_number, transaction_time, category, balance_after
 * Marks ai_parsed status and tracks missing fields
 */
module.exports.reparseTransaction = async (transactionId) => {
  const txn = await Transaction.findById(transactionId);
  if (!txn) throw new Error("Transaction not found");

  const originalData = { ...txn.toObject() };

  // Re-parse the raw message
  const parsed = await parseTransaction(txn.raw_message || "");

  // Update fields from new parse
  txn.merchant = parsed.merchant || txn.merchant;
  txn.bank_name = parsed.bank_name ? parsed.bank_name.toUpperCase() : txn.bank_name;
  txn.reference_number = parsed.reference_number || txn.reference_number;
  txn.transaction_time = parsed.transaction_time || txn.transaction_time;
  txn.category = parsed.category_hint || txn.category;
  
  // Track balance if found
  if (parsed.balance_from_sms) {
    txn.balance_after = parsed.balance_from_sms;
    txn.balance_confidence = 'confirmed';
  }
  
  // Mark as AI parsed if from AI service
  txn.ai_parsed = !!parsed.from_ai;
  txn.ai_parse_confidence = parsed.confidence || null;
  txn.updated_at = new Date();

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
      category: originalData.category !== txn.category,
      balance: originalData.balance_after !== txn.balance_after,
    },
  };
};

/**
 * Re-parse multiple transactions using AI batch processing
 * - Fetches all/selected transactions
 * - Groups them into batches respecting token limits
 * - Sends to Gemini for batch parsing
 * - Updates only transactions that need reparsing (where ai_parsed=false)
 */
module.exports.reparseTransactions = async (transactionIds = []) => {
  console.log('[REPARSE] Starting reparsing process...');
  console.log('[REPARSE] Request:', { selectedTransactionIds: transactionIds.length, mode: transactionIds.length > 0 ? 'specific' : 'all' });

  let transactions;

  if (transactionIds.length > 0) {
    // Re-parse specific transactions (those not yet ai_parsed)
    console.log(`[REPARSE] Fetching ${transactionIds.length} specific transactions...`);
    transactions = await Transaction.find({ 
      _id: { $in: transactionIds }
    });
    // Filter out already parsed ones
    transactions = transactions.filter(t => !t.ai_parsed);
    console.log(`[REPARSE] Found ${transactions.length} unparsed transactions from the ${transactionIds.length} requested`);
  } else {
    // Re-parse ALL unparsed transactions
    console.log('[REPARSE] Fetching ALL unparsed transactions...');
    transactions = await Transaction.find({});

    // Filter out already parsed ones
    transactions = transactions.filter(t => !t.ai_parsed);
    console.log(`[REPARSE] Found ${transactions.length} unparsed transactions total`);
  }

  if (transactions.length === 0) {
    console.log('[REPARSE] ⚠️  No unparsed transactions to process');
    return {
      total: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      results: []
    };
  }

  try {
    console.log(`[REPARSE] Starting AI batch parsing for ${transactions.length} transactions...`);
    
    // Log sample transactions to debug
    if (transactions.length > 0) {
      console.log('[REPARSE] Sample transactions:');
      for (let i = 0; i < Math.min(3, transactions.length); i++) {
        const t = transactions[i];
        console.log(`  [${i}] ID: ${t._id}, raw_message length: ${(t.raw_message || '').length}, has data: ${!!t.raw_message}`);
        if (t.raw_message) {
          console.log(`      Preview: "${t.raw_message.substring(0, 80)}..."`);
        }
      }
    }
    
    // Batch parse through Gemini AI
    const batchResults = await parseTransactionsInBatches(
      transactions.map(t => {
        console.log(`[REPARSE] Mapped transaction: ${t._id} - msg length: ${(t.raw_message || '').length} chars`);
        return {
          id: t._id.toString(),
          raw_message: t.raw_message
        };
      }),
      {
        maxTokensPerBatch: 200000,
        maxBatchSize: 50
      }
    );

    console.log(`[REPARSE] ✅ Received ${batchResults.length} parse results from AI`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Update each transaction with AI parse results
    for (let i = 0; i < batchResults.length; i++) {
      const batchResult = batchResults[i];
      const txn = transactions[i];

      console.log(`[REPARSE] Processing result ${i+1}/${batchResults.length}: txn=${txn._id}, valid=${batchResult.valid}, error=${batchResult.error}`);

      if (!batchResult.valid) {
        // Skip transactions that couldn't be parsed
        console.log(`[REPARSE]   ⏭️  Skipping: invalid parse result - ${batchResult.error}`);
        skippedCount++;
        continue;
      }

      try {
        const data = batchResult.data;
        const originalData = { ...txn.toObject() };

        console.log(`[REPARSE]   📝 Updating transaction with: type=${data.type}, amount=${data.amount}, merchant=${data.merchant}`);

        // Update parsed fields
        if (data.merchant) txn.merchant = data.merchant;
        if (data.bank_name) txn.bank_name = data.bank_name.toUpperCase();
        if (data.reference_number) txn.reference_number = data.reference_number;
        
        // Handle transaction_time - try to construct from date+time, or use existing time, or use current date
        if (data.transaction_date && data.transaction_time) {
          // Both present - use them
          txn.transaction_time = new Date(`${data.transaction_date}T${data.transaction_time}`);
        } else if (data.transaction_time && !data.transaction_date) {
          // Only time present - use it with today's date
          const today = new Date().toISOString().split('T')[0];
          txn.transaction_time = new Date(`${today}T${data.transaction_time}`);
        } else if (data.transaction_date) {
          // Only date present - use it with default time
          txn.transaction_time = new Date(`${data.transaction_date}T00:00:00`);
        } else if (!txn.transaction_time) {
          // No time extracted and transaction doesn't have one - use date field or current time
          txn.transaction_time = txn.date || new Date();
        }
        
        if (data.category_hint) txn.category = data.category_hint;
        if (data.balance_after) {
          txn.balance_after = data.balance_after;
          txn.balance_confidence = 'confirmed';
        }

        // Mark as AI parsed
        txn.ai_parsed = true;
        txn.ai_parse_confidence = 0.95; // High confidence from batch parse
        txn.ai_missing_fields = batchResult.missing_fields || [];
        txn.updated_at = new Date();

        await txn.save();
        console.log(`[REPARSE]   ✅ Saved successfully`);

        results.push({
          transaction_id: txn._id,
          status: "success",
          missing_fields: batchResult.missing_fields,
          changes: {
            merchant: originalData.merchant !== txn.merchant,
            bank_name: originalData.bank_name !== txn.bank_name,
            reference_number: originalData.reference_number !== txn.reference_number,
            transaction_time: originalData.transaction_time !== txn.transaction_time,
            category: originalData.category !== txn.category,
            balance: originalData.balance_after !== txn.balance_after,
          }
        });
        successCount++;
      } catch (error) {
        console.error(`[REPARSE]   ❌ Error updating transaction ${txn._id}:`, error.message);
        results.push({
          transaction_id: txn._id,
          status: "error",
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(
      `[REPARSE] ✅ Complete - ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`
    );

    return {
      total: transactions.length,
      successCount,
      errorCount,
      skippedCount,
      results
    };
  } catch (error) {
    console.error('[REPARSE] ❌ Batch parse failed:', error.message);
    console.error('[REPARSE] Stack:', error.stack);
    throw error;
  }
};
