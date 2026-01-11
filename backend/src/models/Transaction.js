const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user_id: { type: String, required: true },

  account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

  amount: Number,
  original_amount: Number,
  net_amount: Number,

  type: { type: String, enum: ["debit", "credit", "atm", "cash"] },

  merchant: String,
  bank_name: String,

  raw_message: String,
  source: String,

  date: Date,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Transaction", transactionSchema);
