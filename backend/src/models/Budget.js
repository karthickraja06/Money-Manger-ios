const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Groceries",
        "Entertainment",
        "Transport",
        "Utilities",
        "Dining",
        "Shopping",
        "Health",
        "Education",
        "Travel",
        "Other",
      ],
    },
    monthly_limit: {
      type: Number,
      required: true,
      min: 0,
    },
    alert_threshold: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    spent_this_month: {
      type: Number,
      default: 0,
    },
    reset_day: {
      type: Number,
      default: 1,
      min: 1,
      max: 31,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Compound index for unique budget per user and category per month
budgetSchema.index({ user_id: 1, category: 1 }, { unique: true });
budgetSchema.index({ user_id: 1, is_active: 1 });

module.exports = mongoose.model("Budget", budgetSchema);
