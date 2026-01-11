const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  user_id: String,

  bank_name: String,
  account_number: String,

  current_balance: {
    type: Number,
    default: null
  },

  balance_source: {
    type: String,
    enum: ["sms", "calculated", "unknown"],
    default: "unknown"
  },

  last_balance_update_at: {
    type: Date,
    default: null
  },

  created_from_sms: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Account", accountSchema);
