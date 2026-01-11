module.exports = {
  amount: /(INR|Rs\.?|₹)\s?([\d,]+(\.\d{1,2})?)/i,

  balance: /(available balance|bal|avl bal|balance)\s*(is|:)?\s*(INR|Rs\.?|₹)\s?([\d,]+(\.\d{1,2})?)/i,

  debit: /(debited|spent|withdrawn|paid|sent|dr\b|txn of)/i,
  credit: /(credited|received|refund|cr\b|deposited)/i,

  bank: /(HDFC|ICICI|SBI|AXIS|INDIAN BANK|KOTAK|IDFC)/i,

  merchant: /(at|to|on)\s([A-Z0-9\s&._-]{3,})/i
};
