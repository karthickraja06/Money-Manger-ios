// Robust regex collection for parsing Indian bank & UPI SMS
// NOTE: Regex is only step 1 — post-processing is REQUIRED

module.exports = {
  // ============================
  // AMOUNT
  // ============================
  amount: /(?:Rs\.?|₹|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,

  // ============================
  // TRANSACTION TYPE
  // ============================
  debit: /\b(debited|debit|sent|withdrawn|paid|spent|purchase|payment to)\b/i,
  credit: /\b(credited|credit|received|deposited|refund|reversed)\b/i,
  atm: /\b(atm|withdrawal|cash withdrawal)\b/i,

  // ============================
  // CARD INDICATOR (NOT TYPE!)
  // ============================
  credit_card: /\b(credit card|card ending|card no|cc|visa|mastercard|amex|rupay)\b/i,

  // ============================
  // BANK DETECTION (EXCLUSION USE)
  // ============================
  bank: /\b(HDFC|ICICI|SBI|State Bank of India|Axis|YES Bank|Kotak|RBL|IndusInd|IDBI|PNB|BOB|Union Bank|Canara|IDFC)\b/i,

  // ============================
  // MERCHANT EXTRACTION (SOFT)
  // ============================
  merchant: /(at|to|via|from)\s+([A-Za-z0-9&.'\-()\/#,: ]{3,60}?)(?=(?:\s+on|\s+txn|\s+ref|\s+no\.|\s+\d{1,2}:|\s+INR|\s+Rs\.|\s+₹|\.|,|$))/i,

  // ============================
  // BALANCE
  // ============================
  balance: /\b(?:available balance|balance|remaining)\b[:\s]*(?:Rs\.?|₹|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i,

  // ============================
  // TIME
  // ============================
  time: /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/,

  // ============================
  // UPI ID
  // ============================
  upi_id: /\b[a-zA-Z0-9._-]+@[a-zA-Z]{2,}\b/,

  // ============================
  // PHONE (INDIA)
  // ============================
  phone: /\b(?:\+91|91)?\s*\d{10}\b/,

  // ============================
  // MERCHANT STOPWORDS (CLEANUP)
  // ============================
  merchant_stopwords: /\b(on|at|via|by|using|payment|upi|txn|ref|id|no|transfer|to|from|is|for|the|a)\b/gi
};
