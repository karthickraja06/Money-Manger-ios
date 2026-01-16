const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  // User & Identification
  user_id: { type: String, required: true, index: true },
  bank_name: { type: String, required: true },
  account_number: { type: String, default: null }, // Last 4 digits
  account_holder: { type: String, default: null }, // Full name if available

  // Balance Tracking
  current_balance: { type: Number, default: null },
  balance_source: { 
    type: String, 
    enum: ["sms", "calculated", "unknown"], 
    default: "unknown"
  },
  balance_confidence: { type: String, enum: ["high", "medium", "low"], default: "low" },
  last_balance_update_at: { type: Date, default: null },

  // Metadata
  created_from_sms: { type: Boolean, default: true },
  is_active: { type: Boolean, default: true },
  account_type: { type: String, enum: ["bank", "cash", "wallet", "credit_card"], default: "bank" },
  
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

// Ensure one account per user per bank + account_number
accountSchema.index({ user_id: 1, bank_name: 1, account_number: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Account", accountSchema);
