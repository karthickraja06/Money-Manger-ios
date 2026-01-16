const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  // User & Account
  user_id: { type: String, required: true, index: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account", index: true },

  // Amount
  amount: { type: Number, required: true },
  original_amount: { type: Number, required: true },
  net_amount: { type: Number, required: true }, // after refunds
  type: { type: String, enum: ["debit", "credit", "atm", "cash", "unknown"], default: "unknown" },

  // Merchant & Receiver/Sender Info
  merchant: { type: String, default: "UNKNOWN" },
  receiver_name: { type: String, default: null }, // Person/Bank who received
  sender_name: { type: String, default: null },   // Person/Bank who sent
  account_holder: { type: String, default: null }, // Full name if available

  // Bank Info
  bank_name: { type: String, required: true, index: true },
  account_number: { type: String, default: null }, // Last 4 digits typically

  // Raw Data & Deduplication
  raw_message: { type: String, required: true },
  dedup_hash: { type: String, unique: true, sparse: true, index: true },
  source: { type: String, default: "ios_shortcut" },

  // Transaction Timing
  transaction_time: { type: Date, required: true, index: true },
  received_time: { type: Date, default: Date.now },
  time_confidence: { type: String, enum: ["exact", "estimated"], default: "exact" },

  // Categorization (Phase 3)
  category: { type: String, default: null },
  tags: [String],
  notes: { type: String, default: null },

  // Refund System (Phase 3)
  is_refund_of: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
  linked_refunds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
  
  // Metadata
  visit_count: { type: Number, default: 1 }, // How many times same merchant
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

// Compound index for dedup
transactionSchema.index({ 
  user_id: 1, 
  bank_name: 1, 
  amount: 1, 
  type: 1, 
  merchant: 1, 
  transaction_time: 1 
});

module.exports = mongoose.model("Transaction", transactionSchema);
