const regex = require("../utils/regex");

/**
 * Parse SMS message and extract all financial + personal info
 * @param {string} text - Raw SMS message
 * @returns {object | null} Parsed data or null if not transaction
 */
module.exports.parseMessage = (text) => {
  // Ensure we have a string
  if (!text || typeof text !== 'string') return null;

  // Helper: execute regex without the global flag to reliably get capture groups
  const execOnce = (r, str) => {
    try {
      const flags = (r.flags || '').replace('g', '');
      const safeRe = new RegExp(r.source, flags);
      return safeRe.exec(str);
    } catch (e) {
      return null;
    }
  };
  // Helper: test a regex without global flag (avoids stateful tests)
  const testOnce = (r, str) => {
    try {
      const flags = (r.flags || '').replace('g', '');
      const safeRe = new RegExp(r.source, flags);
      return safeRe.test(str);
    } catch (e) {
      return false;
    }
  };

  // Must have amount + currency
  const amountMatch = execOnce(regex.amount, text);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[2] || amountMatch[1] || null;
  if (!rawAmount) return null;
  const amount = Number(rawAmount.replace(/,/g, ""));

  // Determine transaction type (use safe tests)
  let type = "unknown";
  if (testOnce(regex.debit, text)) type = "debit";
  else if (testOnce(regex.credit, text)) type = "credit";
  else if (testOnce(regex.atm, text)) type = "atm";

  // Extract bank name (safe exec)
  const bankMatch = execOnce(regex.bank, text);
  const bank_name = bankMatch && bankMatch[1] ? bankMatch[1].toUpperCase() : "UNKNOWN";

  // Extract merchant (safe exec)
  const merchantMatch = execOnce(regex.merchant, text);
  let merchant = merchantMatch && merchantMatch[2] ? merchantMatch[2].trim() : "UNKNOWN";

  // Post-process merchant: strip common trailing stopwords/patterns and excessive filler words
  if (merchant && merchant !== "UNKNOWN") {
    // Remove known stopwords from utils/regex merchant_stopwords if present
    try {
      merchant = merchant.replace(regex.merchant_stopwords, "").trim();
    } catch (e) {
      merchant = merchant.replace(/\b(is|on|type|txn|ref|refunded|using|via|a|the)\b/ig, "").trim();
    }
    // Remove common UPI ids or patterns
    merchant = merchant.replace(regex.upi_id, "").trim();
    // Remove long numeric references (txn ids, refs) that are likely not merchant names
    merchant = merchant.replace(/\b\d{5,}\b/g, "").trim();
    // Remove trailing non-alphanumeric characters
    merchant = merchant.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").trim();
    // Collapse multiple spaces
    merchant = merchant.replace(/\s{2,}/g, " ");
    if (!merchant) merchant = "UNKNOWN";
  }

  // Extract balance if present (SMS authoritative source)
  let balance = null;
  const balanceMatch = execOnce(regex.balance, text);
  if (balanceMatch) {
    const rawBal = balanceMatch[3] || balanceMatch[2] || null;
    if (rawBal) {
      balance = Number(rawBal.replace(/,/g, ""));
    }
  }

  // 🆕 Extract receiver/sender/account holder names
  let receiver_name = null;
  let sender_name = null;
  let account_holder = null;

  // Pattern: "to John Doe" or "from Jane Smith"
  const toMatch = text.match(/to\s+([A-Za-z\s]+?)(?:\.|,|at|on)/i);
  const fromMatch = text.match(/from\s+([A-Za-z\s]+?)(?:\.|,|at|on)/i);

  if (toMatch) receiver_name = toMatch[1].trim();
  if (fromMatch) sender_name = fromMatch[1].trim();

  // Pattern: "Account holder: John Doe" or similar
  const holderMatch = text.match(/account\s+holder[:\s]+([A-Za-z\s]+?)(?:\.|,|A\/c)/i);
  if (holderMatch) account_holder = holderMatch[1].trim();

  // Extract transaction time (if present)
  let transaction_time = null;
  let time_confidence = "estimated";

  const timeMatch = execOnce(regex.time, text); // HH:MM AM/PM
  if (timeMatch) {
    // If we have time, it's more accurate
    transaction_time = parseTimeFromSMS(timeMatch[0], new Date());
    time_confidence = "exact";
  }

  // Validate parsed amount
  let parsingConfidence = 'low';
  const hasCurrencyMention = testOnce(regex.rupee, text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    // suspicious amount
    return null;
  }

  // Confidence heuristics
  if (hasCurrencyMention && merchant !== 'UNKNOWN' && type !== 'unknown') parsingConfidence = 'high';
  else if (hasCurrencyMention && (merchant !== 'UNKNOWN' || type !== 'unknown')) parsingConfidence = 'medium';
  else parsingConfidence = 'low';

  return {
    amount,
    original_amount: amount,
    net_amount: amount,
    type,
    bank_name,
    merchant,
  // Is this likely a card payment? Helps frontend separate credit-card transactions
  is_card_payment: testOnce(regex.credit_card, text),
    receiver_name,
    sender_name,
    account_holder,
    balance_from_sms: balance,
    transaction_time,
    time_confidence,
    parsing_confidence: parsingConfidence
  };
};

/**
 * Parse time from SMS format (e.g., "01:44 AM")
 */
function parseTimeFromSMS(timeStr, fallbackDate) {
  try {
    const [time, period] = timeStr.split(/\s+/);
    let [hours, minutes] = time.split(":").map(Number);

    if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;

    const parsed = new Date(fallbackDate);
    parsed.setHours(hours, minutes, 0, 0);
    return parsed;
  } catch (e) {
    return fallbackDate; // Fallback to received time
  }
}

module.exports.parseTimeFromSMS = parseTimeFromSMS;
