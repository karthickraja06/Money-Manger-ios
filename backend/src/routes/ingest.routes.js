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
 * Helper: Process a single message
 */
async function processSingleMessage(user_id, raw_message, received_at, source) {
  console.log(`  🔍 Parsing message...`);
  const parsed = parseMessage(raw_message);

  if (!parsed) {
    console.log(`  ⏭️  Non-transaction message - ignoring`);
    return { status: "ignored", reason: "non_transaction_message" };
  }

  let receivedTime = new Date(received_at);
  if (isNaN(receivedTime.getTime())) receivedTime = new Date();
  let transactionTime = parsed.transaction_time || receivedTime;

  console.log(`  ✓ Parsed: ${parsed.type} ${parsed.amount} from ${parsed.merchant}`);

  const dedupHash = generateDedupHash(
    user_id,
    parsed.bank_name,
    parsed.amount,
    parsed.type,
    parsed.merchant,
    transactionTime
  );

  console.log(`  🔐 Dedup hash: ${dedupHash.substring(0, 16)}...`);

  const isDuplicate = await isDuplicateTransaction(dedupHash);
  if (isDuplicate) {
    console.log(`  ⚠️  Duplicate detected`);
    return { status: "duplicate", dedup_hash: dedupHash };
  }

  console.log(`  🏦 Getting/creating account for ${parsed.bank_name}...`);
  const account = await getOrCreateAccountAndUpdateBalance(user_id, parsed.bank_name, parsed);
  console.log(`  ✓ Account: ${account._id}`);

  console.log(`  💾 Saving transaction...`);
  console.log(`  📊 Transaction object being created:`, {
    user_id,
    account_id: account._id,
    amount: parsed.amount,
    type: parsed.type,
    merchant: parsed.merchant,
    bank_name: parsed.bank_name,
    dedup_hash: dedupHash
  });

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

  console.log(`  💾 Calling transaction.save()...`);
  try {
    await transaction.save();
    console.log(`  ✅ Transaction saved: ${transaction._id}`);
  } catch (saveErr) {
    console.error(`  ❌ Transaction save failed:`, saveErr.message);
    console.error(`  Error details:`, saveErr);
    throw saveErr;
  }

  if (parsed.balance_from_sms === null) {
    console.log(`  📊 Updating calculated balance...`);
    await updateBalanceCalculated(account._id, parsed.type, parsed.amount);
  }

  return {
    status: "ingested",
    transaction_id: transaction._id,
    dedup_hash: dedupHash,
    account_id: account._id
  };
}

/**
 * POST /ingest/transaction
 * Unified endpoint for both single message and batch messages
 * 
 * Single message:
 *   { user_id, raw_message, received_at, source }
 * 
 * Batch:
 *   { messages: [{ id, data: { user_id, raw_message, received_at, source, ingested_at } }] }
 */
router.post("/transaction", async (req, res) => {
  try {
    console.log("📥 [INGEST] Received POST request");

    // ========================
    // 1️⃣ API KEY VALIDATION
    // ========================
    const apiKey = req.headers["x-api-key"];
    console.log(`🔐 [INGEST] API key check: ${apiKey ? "provided" : "missing"}`);

    if (apiKey !== process.env.API_KEY && apiKey !== process.env.RENDER_API_KEY) {
      console.warn(`🚫 [INGEST] Unauthorized: API key mismatch`);
      return res.status(401).json({
        error: "Unauthorized",
        code: "INVALID_API_KEY"
      });
    }

    console.log(`✓ [INGEST] API key validated`);

    const { messages, user_id, raw_message, received_at, source } = req.body;

    console.log(`📋 [INGEST] req.body keys:`, Object.keys(req.body));
    console.log(`📋 [INGEST] messages value:`, messages);
    console.log(`📋 [INGEST] messages type:`, typeof messages);
    console.log(`📋 [INGEST] Array.isArray(messages):`, Array.isArray(messages));

    // ========================
    // 2️⃣ DETECT BATCH vs SINGLE
    // ========================
    const isBatch = Array.isArray(messages);
    console.log(`📦 [INGEST] Mode: ${isBatch ? "BATCH" : "SINGLE"}`);

    if (isBatch) {
      // ========================
      // BATCH MODE
      // ========================
      console.log(`📦 [INGEST] Processing ${messages.length} messages`);
      const results = [];

      for (const msg of messages) {
        const id = msg.id || null;
        console.log(`\n📌 [INGEST] Message: ${id}`);

        try {
          const data = msg.data || {};
          const { user_id: uid, raw_message: rm, received_at: ra, source: src } = data;

          console.log(`  user_id: ${uid}, raw_message: ${rm?.substring(0, 50)}...`);

          if (!uid || !rm) {
            console.warn(`  ⚠️  Missing fields - skipping`);
            results.push({ id, status: "skipped", reason: "missing_fields" });
            continue;
          }

          const result = await processSingleMessage(uid, rm, ra, src);
          results.push({ id, ...result });
        } catch (e) {
          console.error(`  ❌ Error:`, e.message);
          results.push({ id, status: "error", message: e.message });
        }
      }

      console.log(`\n✅ [INGEST] Batch complete. Results:`, results);
      return res.json({ ok: true, results });
    } else {
      // ========================
      // SINGLE MODE
      // ========================
      console.log(`📌 [INGEST] user_id: ${user_id}, message: ${raw_message?.substring(0, 50)}...`);

      if (!user_id || !raw_message) {
        console.warn(`🚫 [INGEST] Missing required fields`);
        return res.status(400).json({
          error: "Missing required fields: user_id, raw_message",
          code: "INVALID_REQUEST"
        });
      }

      const result = await processSingleMessage(user_id, raw_message, received_at, source);

      if (result.status === "ignored") {
        return res.status(200).json({
          status: "ignored",
          reason: result.reason,
          message: "SMS does not contain transaction data"
        });
      }

      if (result.status === "duplicate") {
        return res.status(200).json({
          status: "duplicate",
          reason: "dedup_hash_matched",
          message: "Transaction already ingested",
          dedup_hash: result.dedup_hash
        });
      }

      if (result.status === "error") {
        throw new Error(result.message);
      }

      console.log(`✅ [INGEST] Complete: ${result.transaction_id}`);
      return res.status(201).json({
        status: "ingested",
        transaction_id: result.transaction_id,
        account_id: result.account_id,
        dedup_hash: result.dedup_hash
      });
    }
  } catch (error) {
    console.error("❌ [INGEST] Fatal error:", error);

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

/**
 * POST /ingest/test
 * Diagnostic endpoint: test parsing and DB connection
 */
router.post("/test", async (req, res) => {
  try {
    console.log("🧪 [INGEST/TEST] Starting diagnostic test...");

    const { raw_message } = req.body;

    if (!raw_message) {
      return res.status(400).json({
        error: "Missing raw_message",
        test_results: {}
      });
    }

    const results = {
      raw_message: raw_message.substring(0, 100),
      parsing: null,
      db_connection: null,
      account_creation: null,
      error: null
    };

    // Test 1: Parsing
    console.log("🧪 Test 1: Parsing...");
    try {
      const parsed = parseMessage(raw_message);
      results.parsing = parsed ? {
        success: true,
        type: parsed.type,
        amount: parsed.amount,
        merchant: parsed.merchant,
        bank_name: parsed.bank_name
      } : {
        success: false,
        reason: "parseMessage returned null"
      };
      console.log(`  ✓ Parse result:`, results.parsing);
    } catch (e) {
      results.parsing = { success: false, error: e.message };
      console.error(`  ✗ Parse error:`, e.message);
    }

    // Test 2: DB Connection
    console.log("🧪 Test 2: MongoDB connection...");
    try {
      const count = await Transaction.countDocuments({});
      results.db_connection = {
        success: true,
        total_transactions: count
      };
      console.log(`  ✓ Connected to MongoDB, ${count} transactions found`);
    } catch (e) {
      results.db_connection = { success: false, error: e.message };
      console.error(`  ✗ DB error:`, e.message);
    }

    // Test 3: Account Creation
    console.log("🧪 Test 3: Test account creation...");
    try {
      const Account = require("../models/Account");
      const testAccount = await Account.findOne({ user_id: "test-diagnostic" }).lean();
      results.account_creation = {
        success: true,
        test_account_exists: !!testAccount,
        message: testAccount ? "Test account found" : "No test account (expected)"
      };
      console.log(`  ✓ Account query successful`);
    } catch (e) {
      results.account_creation = { success: false, error: e.message };
      console.error(`  ✗ Account query error:`, e.message);
    }

    return res.json({
      status: "diagnostic_complete",
      results
    });
  } catch (error) {
    console.error("❌ [INGEST/TEST] Diagnostic error:", error);
    return res.status(500).json({
      error: "Diagnostic failed",
      message: error.message
    });
  }
});

module.exports = router;
