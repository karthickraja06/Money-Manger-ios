const Account = require("../models/Account");
const crypto = require("crypto");

/**
 * Get or create account, update balance if SMS contains it
 * @param {string} user_id
 * @param {string} bank_name
 * @param {object} parsed - Parsed SMS data
 * @returns {object} Account document
 */
module.exports.getOrCreateAccountAndUpdateBalance = async (
  user_id,
  bank_name,
  parsed
) => {
  // Normalize bank name (HDFC, HDFC Bank → hdfc)
  const normalizedBank = normalizeBankName(bank_name);

  // Try to find existing account
  // Prefer matching by account_number when available (more precise)
  let account = null;
  if (parsed.account_number) {
    account = await Account.findOne({
      user_id,
      bank_name: normalizedBank,
      account_number: parsed.account_number
    });
  }

  // If not found, try matching by bank + account_holder (if present)
  if (!account && parsed.account_holder) {
    account = await Account.findOne({
      user_id,
      bank_name: normalizedBank,
      account_holder: parsed.account_holder
    });
  }

  // Fallback: find any recent account for same bank created from SMS (reduce duplicates)
  if (!account) {
    account = await Account.findOne({
      user_id,
      bank_name: normalizedBank,
      created_from_sms: true
    }).sort({ last_balance_update_at: -1, created_at: -1 });
  }

  // Create if doesn't exist
  if (!account) {
    account = new Account({
      user_id,
      bank_name: normalizedBank,
      account_number: parsed.account_number || null,
      account_holder: parsed.account_holder || null,
      created_from_sms: true,
      account_type: parsed.is_card_payment ? 'credit_card' : detectAccountType(normalizedBank)
    });
  } else {
    // If we matched an existing account but now have a more precise account_number or account_holder, update it
    if (parsed.account_number && !account.account_number) account.account_number = parsed.account_number;
    if (parsed.account_holder && !account.account_holder) account.account_holder = parsed.account_holder;
    // If parser says it's a card payment, mark the account_type accordingly
    if (parsed.is_card_payment && account.account_type !== 'credit_card') account.account_type = 'credit_card';
  }

  // 🔥 Update balance from SMS (SMS is authoritative)
  if (parsed.balance_from_sms !== null) {
    account.current_balance = parsed.balance_from_sms;
    account.balance_source = "sms";
    account.balance_confidence = "high";
    account.last_balance_update_at = new Date();
  }

  // Update account holder if we extracted it
  if (parsed.account_holder && !account.account_holder) {
    account.account_holder = parsed.account_holder;
  }

  account.updated_at = new Date();
  await account.save();

  return account;
};

/**
 * Update balance via calculated method (debit/credit from transactions)
 */
module.exports.updateBalanceCalculated = async (accountId, type, amount) => {
  const account = await Account.findById(accountId);
  if (!account) return null;

  if (account.current_balance === null) {
    // Can't calculate without starting balance
    account.balance_source = "unknown";
    account.balance_confidence = "low";
  } else {
    if (type === "debit" || type === "atm") {
      account.current_balance -= amount;
    } else if (type === "credit") {
      account.current_balance += amount;
    }

    account.balance_source = "calculated";
    account.balance_confidence = "medium"; // Lower confidence than SMS
    account.last_balance_update_at = new Date();
  }

  account.updated_at = new Date();
  await account.save();
  return account;
};

/**
 * Generate deduplication hash
 * Hash = SHA256(user_id | bank_name | amount | type | merchant | transaction_time)
 */
module.exports.generateDedupHash = (user_id, bank_name, amount, type, merchant, transaction_time) => {
  const key = `${user_id}|${bank_name}|${amount}|${type}|${merchant}|${transaction_time.toISOString()}`;
  return crypto.createHash("sha256").update(key).digest("hex");
};

/**
 * Check if transaction already exists (dedup)
 */
module.exports.isDuplicateTransaction = async (dedupHash) => {
  const Transaction = require("../models/Transaction");
  const existing = await Transaction.findOne({ dedup_hash: dedupHash });
  return existing ? true : false;
};

/**
 * Normalize bank names (HDFC Bank, HDFC, HDFC_BANK → hdfc)
 */
function normalizeBankName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/_BANK$/i, "")
    .toLowerCase();
}

/**
 * Detect account type from bank name
 */
function detectAccountType(bankName) {
  if (bankName.includes("credit")) return "credit_card";
  if (bankName.includes("wallet") || bankName.includes("upi")) return "wallet";
  if (bankName.includes("cash")) return "cash";
  return "bank";
}

module.exports.normalizeBankName = normalizeBankName;
module.exports.detectAccountType = detectAccountType;
