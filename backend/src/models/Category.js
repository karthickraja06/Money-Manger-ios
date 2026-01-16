const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    parent_category: {
      type: String,
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
      default: "Other",
    },
    keywords: [String], // For auto-categorization
    merchant_patterns: [String], // Regex patterns for merchants
    color: {
      type: String,
      default: "#808080",
    },
    icon: String,
    is_active: {
      type: Boolean,
      default: true,
    },
    transaction_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique per user and category name
categorySchema.index({ user_id: 1, name: 1 }, { unique: true });
categorySchema.index({ user_id: 1, parent_category: 1 });

module.exports = mongoose.model("Category", categorySchema);
