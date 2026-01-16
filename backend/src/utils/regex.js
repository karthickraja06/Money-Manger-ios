module.exports = {
  // Amount: Rs. 500, Rs 500, ₹500, INR 500
  amount: /(?:Rs\.?|₹|INR)\s*(\s*)(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,

  // Transaction type
  debit: /debited|debit|sent|withdrawn|paid|spent|purchase/i,
  credit: /credited|credit|received|deposited|refund/i,
  atm: /atm|withdrawal|cash withdrawal/i,

  // Bank name
  bank: /(HDFC|ICICI|SBI|Axis|YES|Kotak|RBL|IndusInd|IDBI|PNB|BOI|Union|Canara|Bob|Boi)\s*(?:Bank)?/i,

  // Merchant (usually after "at" or after specific patterns)
  merchant: /(at|from|to|via)\s+([A-Za-z0-9\s&.'-]+?)(?:\s+on|\s+at|\s+,|\.|\z)/i,

  // Balance: "Available balance: Rs. 10,450"
  balance: /(balance|available|remaining)[:\s]*(?:of\s+)?(?:Rs\.?|₹|INR)\s*(\s*)(\d+(?:,\d{3})*(?:\.\d{2})?)/i,

  // Time: "01:44 AM", "1:44 PM"
  time: /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/,

  // Currency patterns
  rupee: /Rs\.?|₹|INR/,

  // Common UPI patterns
  upi_id: /[a-zA-Z0-9._-]+@[a-zA-Z]{3,}/,

  // Phone number
  phone: /\+?91?\s*\d{10}/
};
