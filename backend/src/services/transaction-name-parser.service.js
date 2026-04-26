/**
 * Transaction Name Parser Service
 * Parses counterparty names from bank statement narrations
 * Uses rule-based parsing for common patterns, minimal AI usage
 * Supports: UPI, IMPS, NEFT, Salary, Investments, Self-transfers, Interest, etc.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Common generic terms to filter out
const GENERIC_PARTS = new Set([
  'UPI', 'IMPS', 'NEFT', 'RTGS', 'ACH', 'BIL', 'INFT', 'PAYMENT', 'FROM', 'PHONE',
  'DEBIT', 'CREDIT', 'FOR', 'TO', 'INT', 'PD', 'SELF', 'SAVINGS', 'BANK', 'TRANSFER',
  'REQUEST', 'MANDATE', 'STOCKS', 'STOCKSIP', 'BRK', 'VALIDICICI', 'VALIDHDFC',
  'LIMITED', 'PRIVATE', 'PVT', 'LTD', 'INC', 'CORP', 'CORPORATION'
]);

/**
 * Parse UPI transactions
 * Formats:
 * - SBIN0000579/KAVISHKARTHICK/XXXXX91509/sumanajay03@oksbi/UPI/609764590814/UPI
 * - UPI-INDSTOCKS-INDSTOCKS.BRK@VALIDICICI-ICIC0DC0099-490110656070-PAYMENT FROM PHONE
 * - UPI-GROWW INVEST TECH PR-GROWW.STOCKSIP.BRK@VALIDHDFC-HDFC0MERUPI-102931921952-DEBIT FOR STOCKS
 * - ELE-ranjanem18/UPI/q91601674@ybl/UPI/YES BANK LIMITE/AXI0dba82af2376430ebb0f9261bac3240c/DELE-ranjanem18
 */
const parseUPI = (narration) => {
  const upper = String(narration).toUpperCase().trim();
  const lower = String(narration).toLowerCase().trim();

  // Pattern: UPI-<name>-<email/handle>...
  // Captures company name like "GROWW INVEST TECH PR" or "INDSTOCKS"
  const directPattern = upper.match(/^UPI-([A-Z][A-Z0-9&\s\-\.]{2,}?)(?:-[A-Z0-9\.\@]+|-UPI)/i);
  if (directPattern && directPattern[1]) {
    return directPattern[1].trim();
  }

  // Pattern: <bank>/<name>/<phone>/<email>/UPI
  // Example: SBIN0000579/KAVISHKARTHICK/XXXXX91509/sumanajay03@oksbi/UPI
  const slashPattern = narration.split('/').filter(p => p.trim());
  if (slashPattern.length >= 2) {
    for (let i = 0; i < slashPattern.length; i++) {
      const part = slashPattern[i].toUpperCase().trim();
      
      // Skip if it's an email handle
      if (part.includes('@') || part.includes('.')) continue;
      // Skip if it's purely numeric (phone/id)
      if (/^\d+$/.test(part)) continue;
      // Skip if too short
      if (part.length < 3) continue;
      // Skip generic terms
      if (GENERIC_PARTS.has(part)) continue;
      // Skip long alphanumeric codes (like ICIC0DC0099)
      if (/^[A-Z0-9]{10,}$/.test(part)) continue;
      // Skip bank codes (like ICIC, HDFC)
      if (/^[A-Z]{4}$/.test(part)) continue;
      
      // This looks like a name
      return part;
    }
  }

  // Pattern: ELE-<handle>/UPI/... or DELE-<handle>/... (UPI Circle)
  // Extract the handle before /
  const circlePattern = narration.match(/(ELE|DELE)-([a-zA-Z0-9_\.]+)/i);
  if (circlePattern && circlePattern[2]) {
    return circlePattern[2];
  }

  return null;
};

/**
 * Parse IMPS transactions
 * Format: IMPS-<ref>-<name>-BANK-<account>
 * Example: IMPS-607033624384-B KARTHICK RAJA-ICIC-XXXXXXXX8257-SAVINGS
 */
const parseIMPS = (narration) => {
  const upper = String(narration).toUpperCase();
  const match = upper.match(/IMPS-[^-]+-([A-Z\s\.]{3,}?)-[A-Z]{3,5}-/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
};

/**
 * Parse NEFT/RTGS/INFT transfers
 * Format: NEFT-<ref>/<name>/<bank> or similar variants
 */
const parseNEFT = (narration) => {
  const upper = String(narration).toUpperCase();
  
  // Pattern: NEFT-<ref>/<name>/
  const pattern1 = upper.match(/NEFT-[^/]+\/([A-Z\s\.]{3,})\//);
  if (pattern1 && pattern1[1]) {
    return pattern1[1].trim();
  }

  // Pattern: NEFT <name>
  const pattern2 = upper.match(/NEFT\s+([A-Z][A-Z\s\.]{2,}?)\s+(?:TO|FROM|FOR)/);
  if (pattern2 && pattern2[1]) {
    return pattern2[1].trim();
  }

  return null;
};

/**
 * Parse Salary/ACH transfers
 * Format: SAL-<company>-<employee>-<bank> or ACH C- SAL-<company>-...
 * Examples:
 * - SAL-AMAZONDEVELCENTI-SALARYAMAZON
 * - ACH C- SAL-AMAZONDEVELCENTI-SALARYAMAZON
 */
const parseACHSalary = (narration) => {
  const upper = String(narration).toUpperCase();

  // Pattern: SAL-<company>-
  const salPattern = upper.match(/SAL-([A-Z0-9&\s\.]{3,}?)(?:-|$)/);
  if (salPattern && salPattern[1]) {
    const company = salPattern[1].trim();
    // Prefer shorter meaningful names
    // If we have something like "AMAZONDEVELCENTI-SALARYAMAZON", prefer "SALARYAMAZON"
    const parts = company.split('-').filter(p => p.length > 0);
    if (parts.length > 1) {
      // Return the last meaningful part (usually shorter and clearer)
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].length >= 3 && !GENERIC_PARTS.has(parts[i])) {
          return parts[i];
        }
      }
    }
    return company;
  }

  // Pattern: ACH C- SAL-<company>
  const achPattern = upper.match(/ACH\s+C-\s+SAL-([A-Z0-9&\s\.]{3,}?)(?:-|$)/);
  if (achPattern && achPattern[1]) {
    return achPattern[1].trim();
  }

  return null;
};

/**
 * Parse Investment transactions
 * Format: UPI-<company>-<broker>@BANK-<ref>-<amount>-STOCKS/SIP
 * Examples:
 * - UPI-INDSTOCKS-INDSTOCKS.BRK@VALIDICICI-ICIC0DC0099-490110656070-PAYMENT FROM PHONE
 * - UPI-GROWW INVEST TECH PR-GROWW.STOCKSIP.BRK@VALIDHDFC-HDFC0MERUPI-102931921952-DEBIT FOR STOCKS S
 */
const parseInvestment = (narration) => {
  const upper = String(narration).toUpperCase();

  // Pattern: UPI-<company name with spaces>-<broker>@VALID...
  const investPattern = upper.match(/UPI-([A-Z][A-Z0-9&\s]{2,}?)-[A-Z0-9\.\s]+@VALID/);
  if (investPattern && investPattern[1]) {
    return investPattern[1].trim();
  }

  return null;
};

/**
 * Parse Interest Paid transactions
 * Format: 055201578257:Int.Pd:31-12-2025 to 29-03-2026
 */
const parseInterest = (narration) => {
  const upper = String(narration).toUpperCase();

  if (/(INT\.?PD|INTEREST\s+PAID|INTEREST\s+CREDIT)/i.test(upper)) {
    return 'Bank Interest';
  }

  return null;
};

/**
 * Parse Self-transfers
 * Detect if description contains account holder name or own account number
 */
const parseSelfTransfer = (narration, accountInfo = {}) => {
  const upper = String(narration).toUpperCase();
  const accountHolder = String(accountInfo.accountHolder || '').toUpperCase().trim();
  const accountNumber = String(accountInfo.accountNumber || '').replace(/\D/g, '');

  // Check if account holder name appears in narration
  if (accountHolder && accountHolder.length > 2 && upper.includes(accountHolder)) {
    return 'Self Transfer';
  }

  // Check if last 4 digits of account appear
  if (accountNumber && accountNumber.length >= 4) {
    const lastFour = accountNumber.slice(-4);
    if (upper.includes(lastFour)) {
      return 'Self Transfer';
    }
  }

  return null;
};

/**
 * Parse generic transfers (fallback for unrecognized patterns)
 * Tries to extract name from hyphen or slash separated values
 */
const parseGenericTransfer = (narration) => {
  const upper = String(narration).toUpperCase();

  // Try hyphen-separated extraction
  const parts = upper.split('-').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    // Skip if too short
    if (part.length < 3) continue;
    // Skip generic terms
    if (GENERIC_PARTS.has(part)) continue;
    // Skip long alphanumeric codes
    if (/^[A-Z0-9]{10,}$/.test(part)) continue;
    // Skip codes like ICIC0, HDFC0
    if (/^[A-Z]{2,5}\d+/.test(part)) continue;
    // Skip email handles
    if (part.includes('@')) continue;
    
    return part;
  }

  // Try slash-separated extraction
  const slashParts = upper.split('/').map(p => p.trim()).filter(Boolean);
  for (const part of slashParts) {
    // Skip if too short
    if (part.length < 3) continue;
    // Skip generic terms
    if (GENERIC_PARTS.has(part)) continue;
    // Skip long alphanumeric codes
    if (/^[A-Z0-9]{10,}$/.test(part)) continue;
    // Skip email handles
    if (part.includes('@')) continue;
    
    return part;
  }

  return null;
};

/**
 * Try to use Gemini AI for ambiguous transactions
 * Only called when rule-based parsing fails
 */
const parseWithAI = async (narration, transactionType) => {
  try {
    const prompt = `Extract the counterparty name or entity from this bank transaction narration. 
Be concise, return only the entity name (1-3 words), no explanation.
If you can't determine, respond with "Unknown".

Transaction type: ${transactionType}
Narration: "${narration}"

Examples:
- "SBIN0000579/JOHN SMITH/..." → "JOHN SMITH"
- "UPI-NETFLIX-netflix.com@..." → "NETFLIX"
- "SAL-GOOGLE-GOOGLE INDIA" → "GOOGLE INDIA"
- "Int.Pd 1-4-2026" → "Bank Interest"

Response:`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    if (text && text.toLowerCase() !== 'unknown' && text.length < 100) {
      console.log(`[NAME-PARSER] AI parsed: "${narration}" → "${text}"`);
      return text;
    }
  } catch (error) {
    console.error('[NAME-PARSER] AI parsing error:', error.message);
  }

  return null;
};

/**
 * Main function: Parse transaction counterparty name
 * Returns: { name, source, needsReview }
 * source: 'rule-upi', 'rule-imps', 'rule-neft', 'rule-salary', 'rule-investment', 'rule-interest', 'rule-self', 'rule-generic', 'ai', 'unknown'
 */
const parseTransactionName = async (narration, accountInfo = {}, options = {}) => {
  if (!narration || typeof narration !== 'string') {
    return { name: null, source: 'unknown', needsReview: false };
  }

  const narrationUpper = String(narration).toUpperCase();
  const useAI = options.useAI !== false; // Default to true
  const debugLog = options.debug === true;

  if (debugLog) {
    console.log(`[NAME-PARSER] Parsing: "${narration}"`);
  }

  // 1. Check for Interest
  const interestName = parseInterest(narration);
  if (interestName) {
    if (debugLog) console.log(`[NAME-PARSER] → Interest: "${interestName}"`);
    return { name: interestName, source: 'rule-interest', needsReview: false };
  }

  // 2. Check for Self-Transfer
  const selfTransferName = parseSelfTransfer(narration, accountInfo);
  if (selfTransferName) {
    if (debugLog) console.log(`[NAME-PARSER] → Self Transfer: "${selfTransferName}"`);
    return { name: selfTransferName, source: 'rule-self', needsReview: false };
  }

  // 3. Check for Investment (Stocks/SIP)
  if (narrationUpper.includes('STOCKS') || narrationUpper.includes('SIP')) {
    const investmentName = parseInvestment(narration);
    if (investmentName) {
      if (debugLog) console.log(`[NAME-PARSER] → Investment: "${investmentName}"`);
      return { name: investmentName, source: 'rule-investment', needsReview: false };
    }
  }

  // 4. Check for Salary/ACH
  if (narrationUpper.includes('SAL-') || narrationUpper.includes('ACH')) {
    const salaryName = parseACHSalary(narration);
    if (salaryName) {
      if (debugLog) console.log(`[NAME-PARSER] → Salary: "${salaryName}"`);
      return { name: salaryName, source: 'rule-salary', needsReview: false };
    }
  }

  // 5. Check for IMPS
  if (narrationUpper.includes('IMPS')) {
    const impsName = parseIMPS(narration);
    if (impsName) {
      if (debugLog) console.log(`[NAME-PARSER] → IMPS: "${impsName}"`);
      return { name: impsName, source: 'rule-imps', needsReview: false };
    }
  }

  // 6. Check for NEFT/RTGS
  if (narrationUpper.includes('NEFT') || narrationUpper.includes('RTGS')) {
    const neftName = parseNEFT(narration);
    if (neftName) {
      if (debugLog) console.log(`[NAME-PARSER] → NEFT: "${neftName}"`);
      return { name: neftName, source: 'rule-neft', needsReview: false };
    }
  }

  // 7. Check for UPI (most common)
  if (narrationUpper.includes('UPI') || narrationUpper.includes('/')) {
    const upiName = parseUPI(narration);
    if (upiName) {
      if (debugLog) console.log(`[NAME-PARSER] → UPI: "${upiName}"`);
      return { name: upiName, source: 'rule-upi', needsReview: false };
    }
  }

  // 8. Try generic parsing
  const genericName = parseGenericTransfer(narration);
  if (genericName) {
    if (debugLog) console.log(`[NAME-PARSER] → Generic: "${genericName}"`);
    return { name: genericName, source: 'rule-generic', needsReview: false };
  }

  // 9. If all else fails and AI is enabled, try AI parsing
  if (useAI) {
    const aiName = await parseWithAI(narration);
    if (aiName) {
      if (debugLog) console.log(`[NAME-PARSER] → AI: "${aiName}"`);
      return { name: aiName, source: 'ai', needsReview: true };
    }
  }

  // 10. Unable to parse
  if (debugLog) console.log(`[NAME-PARSER] → Unable to parse`);
  return { name: null, source: 'unknown', needsReview: true };
};

/**
 * Batch parse multiple transactions (useful for statement import)
 */
const parseTransactionNames = async (transactions, accountInfo = {}, options = {}) => {
  const results = [];
  
  for (const transaction of transactions) {
    const parsed = await parseTransactionName(
      transaction.description || transaction.narration,
      accountInfo,
      options
    );
    results.push({
      ...transaction,
      counterpartyName: parsed.name,
      nameParseSource: parsed.source,
      nameNeedsReview: parsed.needsReview
    });
  }

  const stats = {
    total: results.length,
    parsed: results.filter(r => r.counterpartyName).length,
    unparsed: results.filter(r => !r.counterpartyName).length,
    bySource: {}
  };

  results.forEach(r => {
    if (!stats.bySource[r.nameParseSource]) {
      stats.bySource[r.nameParseSource] = 0;
    }
    stats.bySource[r.nameParseSource]++;
  });

  return { results, stats };
};

module.exports = {
  parseTransactionName,
  parseTransactionNames,
  parseUPI,
  parseIMPS,
  parseNEFT,
  parseACHSalary,
  parseInvestment,
  parseInterest,
  parseSelfTransfer,
  parseGenericTransfer
};
