const regex = require("../utils/regex");

/**
 * Parse SMS message and extract all financial + personal info
 * @param {string} text - Raw SMS message
 * @returns {object | null} Parsed data or null if not transaction
 */
module.exports.parseMessage = (text) => {
  // Must have amount + currency
  const amountMatch = text.match(regex.amount);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[2].replace(/,/g, ""));

  // Determine transaction type
  let type = "unknown";
  if (regex.debit.test(text)) type = "debit";
  else if (regex.credit.test(text)) type = "credit";
  else if (regex.atm.test(text)) type = "atm";

  // Extract bank name
  const bankMatch = text.match(regex.bank);
  const bank_name = bankMatch ? bankMatch[1] : "UNKNOWN";

  // Extract merchant
  const merchantMatch = text.match(regex.merchant);
  const merchant = merchantMatch ? merchantMatch[2].trim() : "UNKNOWN";

  // Extract balance if present (SMS authoritative source)
  let balance = null;
  const balanceMatch = text.match(regex.balance);
  if (balanceMatch) {
    balance = Number(balanceMatch[4].replace(/,/g, ""));
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

  const timeMatch = text.match(regex.time); // HH:MM AM/PM
  if (timeMatch) {
    // If we have time, it's more accurate
    transaction_time = parseTimeFromSMS(timeMatch[0], new Date());
    time_confidence = "exact";
  }

  return {
    amount,
    original_amount: amount,
    net_amount: amount,
    type,
    bank_name,
    merchant,
    receiver_name,
    sender_name,
    account_holder,
    balance_from_sms: balance,
    transaction_time,
    time_confidence
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
