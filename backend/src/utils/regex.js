/**
 * Enhanced Regex Patterns for Indian Bank SMS Parsing
 * Handles: HDFC, ICICI, Axis, SBI, Kotak, YES, etc.
 * 
 * Strategy: Cascading approach - try multiple patterns, validate results
 * Confidence scoring based on how many patterns match
 */

module.exports = {
  /**
   * AMOUNT PATTERNS
   * Priority: Try contextual first, then general
   */
  amount: {
    // Pattern 1: Contextual (most reliable)
    // Matches: debited by Rs. 1,250.00 | paid Rs 500 | transfer of Rs.2000
    contextual: /(?:debited|credited|paid|spent|transfer|sent|received|withdraw|deposit).*?(?:Rs\.?|INR|₹)\s*([0-9,\.]+)/gi,

    // Pattern 2: Direct currency with amount
    // Matches: Rs. 1,250.00 | INR 500 | ₹ 2000
    direct: /(?:Rs\.?|INR|₹)\s*([0-9,\.]+)/gi,

    // Pattern 3: Regex from reference (works well for simple cases)
    reference: /(?:RS|INR|USD|\$)\.?\s?([0-9,.]+)/gi,

    // Amount validation rules
    validate: (amountStr) => {
      if (!amountStr) return null;
      // Clean: remove commas, trim
      const cleaned = amountStr.replace(/,/g, '').trim();
      const num = parseFloat(cleaned);
      // Must be valid, positive, and reasonable (< 10 crore)
      return (isFinite(num) && num > 0 && num < 100000000) ? num : null;
    }
  },

  /**
   * MERCHANT/RECIPIENT PATTERNS
   * Priority: Context keywords first, then flexible
   */
  merchant: {
    // Pattern 1: Contextual (most reliable)
    // Matches: at ABC STORE | to MERCHANT NAME | for VENDOR | in SHOP
    contextual: /(?:at|to|from|in\s+|\|\s+in\s+|for|merchant|store|shop|outlet)\s+([A-Za-z0-9\s&'-]{3,50})(?:\s+(?:on|at|for|ref|upi|via|using|rupay|card)|\s*$)/gi,

    // Pattern 2: After UPI identifier
    // Matches: UPI ID: name@bank or merchant identifier
    upi: /(?:upi|via)\s+([A-Za-z0-9\s&'-]+?)@/gi,

    // Pattern 3: Reference pattern (from AI suggestion)
    // Matches: "at MERCHANT" or "for MERCHANT" with flexible spacing
    reference: /(?:\sat\s|in\*|for\s)([A-Za-z0-9\*\.\-\s]{3,})(?:\son|\sat|$)/gi,

    // Cleanup function
    clean: (merchantRaw) => {
      if (!merchantRaw) return null;
      let clean = merchantRaw.trim();

      // Remove UPI patterns
      clean = clean.replace(/@\w+/gi, '');

      // Remove common stopwords that aren't merchant names
      // NOTE: "aura" is a valid merchant (Aura banking service), NOT a stopword
      const stopwords = [
        'data', 'gb', 'mb', 'min', 'sec', 'kb',
        'on', 'at', 'for', 'to', 'from', 'via', 'using',
        'call', 'sms', 'block', 'not', 'you', 'click',
        'confirm', 'verify', 'authenticate'
      ];

      const stopwordRegex = new RegExp(`\\b(${stopwords.join('|')})\\b`, 'gi');
      clean = clean.replace(stopwordRegex, ' ').trim();

      // Remove numbers-only or all-caps technical strings
      if (/^\d+$/.test(clean) || /^[A-Z0-9]{15,}$/.test(clean)) {
        return null;
      }

      // Remove trailing date numbers (e.g., "AuraGold 16" → "AuraGold", "RESHMA VEMULA On 15" → "RESHMA VEMULA")
      clean = clean.replace(/\s+(?:on\s+)?\d{1,2}$/i, '').trim();

      // Remove file extensions
      clean = clean.replace(/\.\w+$/i, '');

      // Collapse spaces
      clean = clean.replace(/\s+/g, ' ').trim();

      // Must be at least 2 chars
      return (clean && clean.length >= 2) ? clean : null;
    },

    // Validation
    isValid: (merchant) => {
      if (!merchant) return false;
      // Should contain at least one letter
      return /[A-Za-z]/.test(merchant);
    }
  },

  /**
   * ACCOUNT/CARD NUMBER PATTERNS
   * Matches masked numbers like: XXXX1234, ****5678, *****1235
   */
  account: {
    // Pattern 1: Standard masked (most common)
    // Matches: XXXX1234, ****1234, *****9876
    masked: /(?:A\/C|Account|Card|Ending\s+(?:in|in\s*:))\s*[\*X]+([0-9]{3,})/gi,

    // Pattern 2: Reference pattern
    // Matches: A/C XXXX1235, Ending 1234
    reference: /(?:A\/C|Account|Card|Ending|a\/c)\s[X\*]*([0-9]{3,})/gi,

    // Pattern 3: Generic masked
    // Matches: 123456789012XXXX or similar
    generic: /[X\*]{4,}([0-9]{4})/g,

    // Validation
    validate: (accountStr) => {
      if (!accountStr) return null;
      const clean = accountStr.replace(/\D/g, ''); // Only digits
      // Should be 3-5 digits (last digits of card/account)
      return (clean.length >= 3 && clean.length <= 5) ? clean : null;
    }
  },

  /**
   * BALANCE PATTERNS
   * Extract account balance from SMS
   * Matches: "Available Balance: Rs. 5000", "Bal: 10,000", "Current balance Rs 2500"
   */
  balance: {
    // Pattern 1: Contextual (most reliable)
    // Matches: "Available Balance: Rs. 5000", "Current balance Rs 2500", "Bal: 50,000"
    contextual: /(?:available\s+)?balance\s*(?:is|:|of)?\s*(?:Rs\.?|INR|₹)\s*([0-9,\.]+)/gi,

    // Pattern 2: Short form
    // Matches: "Bal: 5000", "Balance 10000"
    short: /\b(?:bal|current\s+balance)\s*:?\s*(?:Rs\.?|INR|₹)\s*([0-9,\.]+)/gi,

    // Pattern 3: After transaction
    // Matches: "Available balance after this transaction Rs. 5000"
    postTransaction: /(?:after\s+(?:this\s+)?transaction|remaining\s+balance)\s+(?:Rs\.?|INR|₹)\s*([0-9,\.]+)/gi,

    // Validation
    validate: (balanceStr) => {
      if (!balanceStr) return null;
      const cleaned = balanceStr.replace(/,/g, '').trim();
      const num = parseFloat(cleaned);
      // Balance should be reasonable (not negative, < 10 crore)
      return (isFinite(num) && num >= 0 && num < 100000000) ? num : null;
    }
  },

  /**
   * DATE PATTERNS
   * Handles multiple formats used by Indian banks
   */
  date: {
    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
    // Matches: 01/12/2018, 28-01-2018, 31/01/26
    ddmmyyyy: /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/g,

    // Pattern 2: DD Mon YYYY or DD-Mon-YYYY
    // Matches: 28 June 2018, 01-Jan-2018, 31 JAN 2026
    ddmonyyyy: /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/g,

    // Pattern 3: Time pattern (HH:MM AM/PM or HH:MM)
    // Matches: 10:45 PM, 14:30, 09:15am
    time: /(\d{1,2}):(\d{2})\s*(?:am|pm|AM|PM)?/gi,

    // Reference pattern (from AI suggestion)
    reference: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,

    // Month abbreviations for parsing
    months: {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      january: 1, february: 2, march: 3, april: 4, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    }
  },

  /**
   * TRANSACTION TYPE PATTERNS
   * Debit vs Credit detection
   */
  transactionType: {
    // Debit indicators (money going out)
    debit: /(?:debit|sent|transfer|paid|spent|withdraw|withdrawn|payment made|charged|debited|purchased|bought|payment of)/gi,

    // Credit indicators (money coming in)
    credit: /(?:credit|received|deposit|refund|credited|deposited|received|incoming)/gi,

    // Card-specific
    card: /(?:credit\s+card|debit\s+card|card|swipe|pos|atm|rupay|visa|mastercard|auro|amex)/gi
  },

  /**
   * BANK PATTERNS
   * Identify which bank the message is from
   */
  bank: {
    // Pattern 1: Contextual bank mention
    contextual: /(?:from|account|a\/c|ac\s+|bank)[\s:]*([A-Za-z0-9\s&'-]+?)(?:\s+(?:a\/c|ac\s+|account|\*|debit|credit)|\s*$)/gi,

    // Keywords for each bank
    keywords: {
      hdfc: ['hdfc', 'hdfc bank', 'hdfc credit', 'hdfc debit'],
      icici: ['icici', 'icici bank', 'icici direct'],
      axis: ['axis', 'axis bank'],
      sbi: ['sbi', 'state bank', 'statebank'],
      bob: ['bob', 'bank of baroda'],
      union: ['union', 'union bank'],
      idbi: ['idbi'],
      pnb: ['pnb', 'punjab national'],
      boi: ['boi', 'bank of india'],
      canara: ['canara'],
      dena: ['dena'],
      kotak: ['kotak', 'kotak mahindra'],
      yes: ['yes', 'yes bank'],
      federal: ['federal', 'federal bank'],
      hsbc: ['hsbc'],
      citi: ['citi', 'citibank'],
      amex: ['amex', 'american express'],
      diners: ['diners'],
      // Digital wallets
      paytm: ['paytm'],
      phonepe: ['phonepe'],
      googlepay: ['googlepay', 'google pay', 'gpay'],
      whatsapp: ['whatsapp pay'],
      airtel: ['airtel', 'airtel payments'],
      jio: ['jio', 'jio money']
    }
  },

  /**
   * REFERENCE/TXN ID PATTERNS
   * For deduplication
   */
  referenceId: {
    // Matches: Ref 601048839131, REF ID: ABC123, TXN ID: 123456
    pattern: /(?:ref|reference|txn|transaction|id|urn)\s*(?:id|no)?:?\s*([A-Za-z0-9]+)/gi
  },

  /**
   * NON-TRANSACTIONAL MESSAGE FILTERS
   * Exclude messages that are not actual transactions
   */
  nonTransaction: {
    patterns: [
      // Data/recharge messages
      /(\d+%\s+)?data\s+(?:over|remaining|used|consumed|rollover|validity)/i,
      /recharge\s+(?:plan|package|offer|validity|expired)/i,

      // Balance/limit messages
      /balance\s+transfer/i,
      /(?:credit|spending)\s+limit\s+(?:increase|decrease|updated)/i,

      // Compliance/KYC
      /kyc|aadhar|pan|verification|identity|update.*(?:information|details)/i,

      // Account management
      /(?:update|reset|change)\s+(?:password|pin|phone|email|address|beneficiary)/i,

      // Offers/promotions
      /(?:offer|reward|cashback|bonus|promotion|discount|voucher)/i,

      // Status checks
      /(?:application|status|approved|rejected|pending|processing)/i,

      // Non-payment related
      /bill.*due|payment.*due(?!\s+(?:on|at|from))/i, // "due on" is transactional
      /(?:minimum|outstanding)\s+balance/i // just info
    ]
  },

  /**
   * MANDATE/RECURRING PAYMENT PATTERNS
   */
  mandate: {
    pattern: /(?:mandate|standing\s+instruction|recurring|auto[\s-]?debit|auto[\s-]?pay|scheduled\s+payment|emandate)/i
  }
};
