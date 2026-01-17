// Improved regex collection for parsing SMS notifications and UPI messages.
// Goal: reduce merchant extraction noise, better detect amounts and card-related messages.
module.exports = {
  // Amount: Rs. 500, Rs 500.00, ₹500, INR 500
  // Capture groups: full match, optional spaces, numeric amount
  amount: /(?:Rs\.?|₹|INR)\s*(\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,

  // Transaction type keywords
  debit: /\b(debited|debit|sent|withdrawn|paid|spent|purchase|spent by|payment to|card payment)\b/i,
  credit: /\b(credited|credit|received|deposited|refund|refund credited)\b/i,
  atm: /\b(atm|withdrawal|cash withdrawal)\b/i,

  // Detect mentions of card or credit-card related messages
  credit_card: /\b(card|credit card|cc|visa|mastercard|amex|rupay|card ending|card no|card \d{4})\b/i,

  // Bank name (expanded/normalized common banks)
  bank: /\b(HDFC|ICICI|SBI|State Bank of India|Axis|YES|Kotak|RBL|IndusInd|IDBI|PNB|BOI|Bank of India|Union Bank|Canara|BOB|Bank)\b/i,

  // Merchant extraction improvement:
  // Look for patterns like "at Merchant Name", "via Merchant", "to Merchant" but avoid capturing trailing filler words.
  // We capture the merchant in group 2 and then perform post-processing in parser to remove stopwords.
  merchant: /(at|from|to|via)\s+([A-Za-z0-9&.'\-()\/:,#\s]+?)(?=(?:\s+on|\s+at|\s+via|\s+txn|\s+type|\s+ref|\s+\d{1,2}:|\s+INR|\s+Rs\.|\s+₹|\.|,|$))/i,

  // Balance: "Available balance: Rs. 10,450" — capture numeric part at group 2
  balance: /(available balance|balance|remaining)[:\s]*(?:of\s+)?(?:Rs\.?|₹|INR)\s*(\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i,

  // Time: "01:44 AM", "1:44 PM" or 24h times
  time: /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/,

  // Currency patterns
  rupee: /\bRs\.?\b|₹|\bINR\b/,

  // Common UPI patterns
  upi_id: /[a-zA-Z0-9._-]+@[a-zA-Z]{2,}/,

  // Phone number (India)
  phone: /\+?91?\s*\d{10}/,

  // Common stopwords that sometimes get picked up as merchant suffixes
  merchant_stopwords: /(?:on|at|type|txn|ref|refunded|is|via|by|using|a|the|for)\b/i
};
