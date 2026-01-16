const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const { parseMessage } = require("../services/parser.service");
const {
  getOrCreateAccountAndUpdateBalance,
  updateBalanceCalculated,
  generateDedupHash,
  isDuplicateTransaction
} = require("../services/account.service");

/**
 * POST /ingest/transaction
 * iOS Shortcut webhook for transaction ingestion
 */
router.post("/transaction", async (req, res) => {
  try {
    // ========================
    // 1️⃣ API KEY VALIDATION
    // ========================
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ 
        error: "Unauthorized",
        code: "INVALID_API_KEY"
      });
    }

    // ========================
    // 2️⃣ REQUEST VALIDATION
    // ========================
    const { user_id, raw_message, received_at, source } = req.body;

    if (!user_id || !raw_message) {
      return res.status(400).json({
        error: "Missing required fields: user_id, raw_message",
        code: "INVALID_REQUEST"
      });
    }

    // ========================
    // 3️⃣ PARSE SMS MESSAGE
    // ========================
    const parsed = parseMessage(raw_message);

    if (!parsed) {
      // Non-transaction message (e.g., promotional)
      return res.status(200).json({
        status: "ignored",
        reason: "non-transaction_message",
        message: "SMS does not contain transaction data"
      });
    }

    // ========================
    // 4️⃣ NORMALIZE DATES SAFELY
    // ========================
    let receivedTime = new Date(received_at);
    if (isNaN(receivedTime.getTime())) {
      receivedTime = new Date();
    }

    let transactionTime = parsed.transaction_time || receivedTime;

    // ========================
    // 5️⃣ GENERATE DEDUP HASH
    // ========================
    const dedupHash = generateDedupHash(
      user_id,
      parsed.bank_name,
      parsed.amount,
      parsed.type,
      parsed.merchant,
      transactionTime
    );

    // ========================
    // 6️⃣ CHECK FOR DUPLICATES
    // ========================
    const isDuplicate = await isDuplicateTransaction(dedupHash);

    if (isDuplicate) {
      return res.status(200).json({
        status: "duplicate",
        reason: "dedup_hash_matched",
        message: "Transaction already ingested",
        dedup_hash: dedupHash
      });
    }

    // ========================
    // 7️⃣ GET OR CREATE ACCOUNT
    // ========================
    const account = await getOrCreateAccountAndUpdateBalance(
      user_id,
      parsed.bank_name,
      parsed
    );

    // ========================
    // 8️⃣ CREATE TRANSACTION DOCUMENT
    // ========================
    const transaction = new Transaction({
      user_id,
      account_id: account._id,
      amount: parsed.amount,
      original_amount: parsed.original_amount,
      net_amount: parsed.net_amount,
      type: parsed.type,
      merchant: parsed.merchant,
      receiver_name: parsed.receiver_name,
      sender_name: parsed.sender_name,
      account_holder: parsed.account_holder,
      bank_name: parsed.bank_name,
      raw_message,
      dedup_hash: dedupHash,
      source: source || "ios_shortcut",
      transaction_time: transactionTime,
      received_time: receivedTime,
      time_confidence: parsed.time_confidence
    });

    await transaction.save();

    // ========================
    // 9️⃣ UPDATE BALANCE (if no SMS balance, calculate it)
    // ========================
    if (parsed.balance_from_sms === null) {
      // SMS didn't have balance, so calculate it
      await updateBalanceCalculated(account._id, parsed.type, parsed.amount);
    }

    // ========================
    // ✅ SUCCESS RESPONSE
    // ========================
    return res.status(201).json({
      status: "ingested",
      transaction_id: transaction._id,
      account_id: account._id,
      dedup_hash: dedupHash,
      account: {
        bank_name: account.bank_name,
        current_balance: account.current_balance,
        balance_source: account.balance_source
      },
      transaction: {
        amount: transaction.amount,
        type: transaction.type,
        merchant: transaction.merchant,
        receiver_name: transaction.receiver_name,
        sender_name: transaction.sender_name,
        transaction_time: transaction.transaction_time
      }
    });

  } catch (error) {
    console.error("❌ Ingestion Error:", error);

    // Database-specific errors
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Duplicate transaction detected",
        code: "DUPLICATE_KEY",
        field: Object.keys(error.keyPattern)[0]
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      message: error.message
    });
  }
});

/**
 * GET /ingest/health
 * Health check for iOS Shortcut
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
