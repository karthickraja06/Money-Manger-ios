const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const { parseMessage } = require("../services/parser.service");
const {
  getOrCreateAccountAndUpdateBalance
} = require("../services/account.service");

// POST /ingest/transaction
router.post("/transaction", async (req, res) => {
  try {
    // -------------------------------
    // 1️⃣ Simple API key auth
    // -------------------------------
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // -------------------------------
    // 2️⃣ Extract request body
    // -------------------------------
    const { user_id, raw_message, received_at, source } = req.body;

    if (!user_id || !raw_message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // -------------------------------
    // 3️⃣ Parse SMS message
    // -------------------------------
    const parsed = parseMessage(raw_message);

    // Ignore non-transaction messages
    if (!parsed) {
      return res.json({
        status: "ignored",
        reason: "non-transaction message"
      });
    }

    // -------------------------------
    // 4️⃣ Normalize date safely (🔥 FIX)
    // -------------------------------
    let txnDate = new Date(received_at);

    // If iOS sends an unparsable date, fallback safely
    if (isNaN(txnDate.getTime())) {
      txnDate = new Date();
    }

    // -------------------------------
    // 5️⃣ Get or create account + update balance
    // -------------------------------
    const account = await getOrCreateAccountAndUpdateBalance(
      user_id,
      parsed.bank_name,
      parsed
    );

    // -------------------------------
    // 6️⃣ Store transaction
    // -------------------------------
    const txn = await Transaction.create({
      user_id,
      account_id: account._id,

      amount: parsed.amount,
      original_amount: parsed.original_amount,
      net_amount: parsed.net_amount,

      type: parsed.type,
      merchant: parsed.merchant,
      bank_name: parsed.bank_name,

      raw_message,
      source,

      date: txnDate
    });

    // -------------------------------
    // 7️⃣ Success response
    // -------------------------------
    return res.json({
      status: "stored",
      transaction_id: txn._id
    });

  } catch (err) {
    console.error("❌ Ingest error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
