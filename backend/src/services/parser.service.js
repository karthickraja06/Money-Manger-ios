const regex = require("../utils/regex");

module.exports.parseMessage = (text) => {
  const amountMatch = text.match(regex.amount);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[2].replace(/,/g, ""));

  let type = "unknown";
  if (regex.debit.test(text)) type = "debit";
  else if (regex.credit.test(text)) type = "credit";

  const bankMatch = text.match(regex.bank);
  const bank_name = bankMatch ? bankMatch[1] : "UNKNOWN";

  const merchantMatch = text.match(regex.merchant);
  const merchant = merchantMatch ? merchantMatch[2].trim() : "UNKNOWN";

  // NEW: extract balance if present
  let balance = null;
  const balanceMatch = text.match(regex.balance);
  if (balanceMatch) {
    balance = Number(balanceMatch[4].replace(/,/g, ""));
  }

  return {
    amount,
    original_amount: amount,
    net_amount: amount,
    type,
    bank_name,
    merchant,
    balance_from_sms: balance // may be null
  };
};
