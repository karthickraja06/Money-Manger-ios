const regex = require("../utils/regex");
const crypto = require("crypto");
const { parseTransactionWithAI, compareResults } = require("./gemini.service");

/**
 * Safe regex execution without global flag issues
 */
function execOnce(pattern, text) {
  if (!text || typeof text !== 'string') return null;
  const flags = pattern.flags.replace('g', '');
  const safePattern = new RegExp(pattern.source, flags);
  return safePattern.exec(text);
}

/**
 * Safe regex test
 */
function testOnce(pattern, text) {
  if (!text || typeof text !== 'string') return false;
  const flags = pattern.flags.replace('g', '');
  const safePattern = new RegExp(pattern.source, flags);
  return safePattern.test(text);
}

/**
 * Extract all matches globally (safe version)
 */
function extractAll(pattern, text) {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const safePattern = new RegExp(pattern.source, flags);
  let match;
  while ((match = safePattern.exec(text)) !== null) {
    matches.push(match);
  }
  return matches;
}

/**
 * Check if message is non-transactional
 */
function isNonTransactional(rawMessage) {
  if (!rawMessage) return false;

  for (const pattern of regex.nonTransaction.patterns) {
    if (testOnce(pattern, rawMessage)) {
      console.log('[PARSER] Non-transactional message detected:', pattern.source.slice(0, 50));
      return true;
    }
  }

  return false;
}

/**
 * Check if message is a mandate/recurring payment
 */
function isMandate(rawMessage) {
  if (!rawMessage) return false;
  return testOnce(regex.mandate.pattern, rawMessage);
}

/**
 * Extract amount with cascading approach
 */
function extractAmount(rawMessage) {
  if (!rawMessage) return null;

  // Try patterns in priority order
  const patterns = [
    regex.amount.contextual, // Most reliable
    regex.amount.direct,
    regex.amount.reference
  ];

  for (const pattern of patterns) {
    const matches = extractAll(pattern, rawMessage);

    for (const match of matches) {
      if (match[1]) {
        const validated = regex.amount.validate(match[1]);
        if (validated) {
          console.log('[PARSER] Amount extracted:', validated);
          return validated;
        }
      }
    }
  }

  return null;
}

/**
 * Extract merchant with cascading approach
 */
function extractMerchant(rawMessage) {
  if (!rawMessage) return null;

  const patterns = [
    regex.merchant.contextual,
    regex.merchant.reference,
    regex.merchant.upi
  ];

  for (const pattern of patterns) {
    const matches = extractAll(pattern, rawMessage);

    for (const match of matches) {
      if (match[1]) {
        const cleaned = regex.merchant.clean(match[1]);
        if (cleaned && regex.merchant.isValid(cleaned)) {
          console.log('[PARSER] Merchant extracted:', cleaned);
          return cleaned;
        }
      }
    }
  }

  return null;
}

/**
 * Extract account/card number
 */
function extractAccount(rawMessage) {
  if (!rawMessage) return null;

  const patterns = [
    regex.account.masked,
    regex.account.reference,
    regex.account.generic
  ];

  for (const pattern of patterns) {
    const matches = extractAll(pattern, rawMessage);

    for (const match of matches) {
      if (match[1]) {
        const validated = regex.account.validate(match[1]);
        if (validated) {
          console.log('[PARSER] Account extracted:', validated);
          return validated;
        }
      }
    }
  }

  return null;
}

/**
 * Extract bank name
 */
function extractBank(rawMessage) {
  if (!rawMessage) return null;

  const messageLower = rawMessage.toLowerCase();

  // Check keywords first (faster)
  for (const [bankCode, keywords] of Object.entries(regex.bank.keywords)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        const standardName = {
          hdfc: 'HDFC',
          icici: 'ICICI',
          axis: 'Axis',
          sbi: 'SBI',
          bob: 'BOB',
          union: 'Union Bank',
          idbi: 'IDBI',
          pnb: 'PNB',
          boi: 'BOI',
          canara: 'Canara',
          dena: 'Dena',
          kotak: 'Kotak',
          yes: 'YES Bank',
          federal: 'Federal',
          hsbc: 'HSBC',
          citi: 'Citi',
          amex: 'Amex',
          diners: 'Diners',
          paytm: 'Paytm',
          phonepe: 'PhonePe',
          googlepay: 'Google Pay',
          whatsapp: 'WhatsApp Pay',
          airtel: 'Airtel',
          jio: 'Jio'
        }[bankCode];

        if (standardName) {
          console.log('[PARSER] Bank detected:', standardName);
          return standardName;
        }
      }
    }
  }

  return null;
}

/**
 * Extract current balance
 */
function extractBalance(rawMessage) {
  if (!rawMessage) return null;

  const patterns = [
    regex.balance.contextual,  // Most reliable
    regex.balance.short,
    regex.balance.postTransaction
  ];

  for (const pattern of patterns) {
    const matches = extractAll(pattern, rawMessage);

    for (const match of matches) {
      if (match[1]) {
        const validated = regex.balance.validate(match[1]);
        if (validated !== null) {
          console.log('[PARSER] Balance extracted:', validated);
          return validated;
        }
      }
    }
  }

  return null;
}

/**
 * Extract date/time
 */
function extractDate(rawMessage) {
  if (!rawMessage) return null;

  // Try date patterns
  let dateMatch = execOnce(regex.date.ddmmyyyy, rawMessage);

  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    let year = parseInt(dateMatch[3]);

    // Handle 2-digit year
    if (year < 100) {
      year = year < 30 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month - 1, day);
  }

  // Try mon format
  dateMatch = execOnce(regex.date.ddmonyyyy, rawMessage);

  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const monthName = dateMatch[2].toLowerCase();
    const year = parseInt(dateMatch[3]) < 100 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3]);

    const monthNum = regex.date.months[monthName];
    if (monthNum) {
      return new Date(year, monthNum - 1, day);
    }
  }

  return null;
}

/**
 * Main parse function with Gemini AI + Regex Fallback
 * 1. Tries Gemini AI for intelligent parsing
 * 2. Falls back to regex if AI fails
 * 3. Compares both results and uses the best one
 */
async function parseMessage(rawMessage, options = {}) {
  console.log('[PARSER] ========== PARSE START ==========');
  console.log('[PARSER] Input length:', rawMessage?.length || 0);

  // Validate input
  if (!rawMessage || typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
    console.warn('[PARSER] ❌ Invalid input');
    return null;
  }

  // Check if non-transactional
  if (isNonTransactional(rawMessage)) {
    console.log('[PARSER] Non-transactional message, skipping');
    return null;
  }

  // 🤖 Step 1: Try Gemini AI parsing
  console.log('[PARSER] Attempting AI parsing...');
  let aiResult = null;
  try {
    aiResult = await parseTransactionWithAI(rawMessage);
  } catch (error) {
    console.warn('[PARSER] AI parsing failed, will use regex fallback:', error.message);
  }

  // 📍 Step 2: Parse with regex (always as fallback)
  console.log('[PARSER] Running regex fallback parsing...');
  const regexResult = parseMessageWithRegex(rawMessage);

  // 🔀 Step 3: Merge results (prefer AI if valid, fall back to regex)
  if (aiResult && aiResult.valid) {
    console.log('[PARSER] Using AI result (valid)');
    return mergeAIAndRegexResults(aiResult, regexResult);
  } else {
    console.log('[PARSER] Using regex result (AI not available or invalid)');
    return regexResult;
  }
}

/**
 * Pure regex parsing (no AI dependency)
 */
function parseMessageWithRegex(rawMessage) {
  console.log('[PARSER] ========== REGEX PARSE START ==========');

  // Filter non-transactional
  if (isNonTransactional(rawMessage)) {
    console.warn('[PARSER] ❌ Non-transactional message');
    return null;
  }

  // Detect transaction type
  const isDebit = testOnce(regex.transactionType.debit, rawMessage);
  const isCredit = testOnce(regex.transactionType.credit, rawMessage);
  const type = isDebit ? 'debit' : isCredit ? 'credit' : null;

  if (!type) {
    console.warn('[PARSER] ❌ No transaction type detected');
    return null;
  }

  console.log('[PARSER] Type:', type);

  // Extract amount
  const amount = extractAmount(rawMessage);
  if (!amount) {
    console.warn('[PARSER] ❌ No valid amount found');
    return null;
  }

  console.log('[PARSER] Amount:', amount);

  // Extract merchant
  const merchant = extractMerchant(rawMessage) || 'UNIDENTIFIED';
  console.log('[PARSER] Merchant:', merchant);

  // Extract bank
  const bank_name = extractBank(rawMessage);
  console.log('[PARSER] Bank:', bank_name);

  // Extract account
  const account_number = extractAccount(rawMessage);
  console.log('[PARSER] Account:', account_number);

  // Extract balance
  const current_balance = extractBalance(rawMessage);
  console.log('[PARSER] Balance:', current_balance);

  // Extract reference
  const refMatch = execOnce(regex.referenceId.pattern, rawMessage);
  const reference_id = refMatch ? refMatch[1] : null;
  console.log('[PARSER] Reference:', reference_id);

  // Extract date
  const transaction_date = extractDate(rawMessage) || new Date(options.received_at || Date.now());
  console.log('[PARSER] Date:', transaction_date.toISOString());

  // Detect card payment
  const is_card_payment = testOnce(regex.transactionType.card, rawMessage);
  console.log('[PARSER] Card payment:', is_card_payment);

  // Detect mandate
  const is_mandate = isMandate(rawMessage);
  console.log('[PARSER] Mandate:', is_mandate);

  // Calculate confidence
  const confidenceFactors = [
    type && 1,
    amount && 1,
    merchant && merchant !== 'UNIDENTIFIED' && 1,
    bank_name && 1,
    reference_id && 1,
    transaction_date && 1,
    account_number && 1,
    current_balance && 1  // New factor for balance extraction
  ].filter(Boolean).length;

  const parsing_confidence = confidenceFactors >= 6 ? 'high' : confidenceFactors >= 4 ? 'medium' : 'low';

  console.log('[PARSER] Confidence:', parsing_confidence, `(${confidenceFactors}/8 factors)`);
  console.log('[PARSER] ========== REGEX PARSE SUCCESS ==========\n');

  return {
    type,
    amount,
    original_amount: amount,
    net_amount: amount,
    merchant,
    bank_name,
    account_number,
    current_balance,
    reference_id,
    transaction_time: transaction_date,
    is_card_payment,
    is_mandate,
    parsing_confidence,
    source: 'regex',
    _raw_length: rawMessage.length
  };
}

/**
 * Merge AI result with regex fallback
 * Preferences: AI primary fields > Regex fallback
 */
function mergeAIAndRegexResults(aiResult, regexResult) {
  console.log('[PARSER] ========== MERGING AI + REGEX RESULTS ==========');

  // Use AI result as primary, fill gaps with regex
  const merged = {
    type: aiResult.type || regexResult?.type,
    amount: aiResult.amount || regexResult?.amount,
    original_amount: aiResult.amount || regexResult?.amount,
    net_amount: aiResult.amount || regexResult?.amount,
    merchant: aiResult.merchant || regexResult?.merchant || 'UNIDENTIFIED',
    bank_name: aiResult.bank_name || regexResult?.bank_name,
    account_number: aiResult.account_number || regexResult?.account_number,
    current_balance: regexResult?.current_balance,
    reference_id: aiResult.reference_number || regexResult?.reference_id,
    transaction_time: aiResult.transaction_time ? 
      new Date(`2026-01-01T${aiResult.transaction_time}`) : 
      regexResult?.transaction_time,
    is_card_payment: regexResult?.is_card_payment || false,
    is_mandate: regexResult?.is_mandate || false,
    parsing_confidence: 'high', // AI result is trusted
    source: 'ai_with_regex_fallback',
    category_hint: aiResult.category_hint,
    _raw_length: 0
  };

  console.log('[PARSER] Merged result:', {
    type: merged.type,
    amount: merged.amount,
    merchant: merged.merchant,
    bank: merged.bank_name,
    source: merged.source
  });
  console.log('[PARSER] ========== MERGE COMPLETE ==========\n');

  return merged;
}

module.exports = {
  parseMessage
};
