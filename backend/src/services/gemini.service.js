// const path = require('path');
// console.log(path);
// require('dotenv').config({
//   path: path.resolve(__dirname, '/../../.env')
// });
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Debug: Log if API key is loaded
console.log('[GEMINI] Checking API key...');
console.log('[GEMINI] GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('[GEMINI] GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length || 0);
console.log('[GEMINI] First 10 chars:', process.env.GEMINI_API_KEY?.substring(0, 10) || 'NOT SET');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Parse transaction using Gemini AI
 * Returns structured transaction data with fallback to null on error
 */
async function parseTransactionWithAI(rawMessage) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[GEMINI] API key not configured, skipping AI parsing');
      return null;
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const prompt = `You are an expert financial transaction parser. Extract transaction details from SMS/bank messages.

CRITICAL RULES:
1. Return ONLY valid JSON (no markdown, no explanations, no extra text)
2. All fields must be lowercase strings (except amount which is number)
3. Date format: YYYY-MM-DD
4. Time format: HH:MM (24-hour)
5. Amount: number only, no currency symbols
6. type: MUST be 'debit' or 'credit' (not 'atm', 'transfer', etc.)
7. merchant: Extract business/person name
8. bank_name: UPPERCASE only (HDFC, ICICI, AXIS, SBI, etc.)
9. reference_number: Transaction reference/OTP/rrn (if available)
10. If field is unknown, use null
11. If amount is missing or unreadable, REJECT with {"valid": false}
12. Based on merchant name guess category_hint (e.g. if debit - "food_delivery", "grocery", "utilities", "entertainment", "travel", "healthcare", etc. if credit - "salary", "refund", "transfer", etc.) if possible, otherwise null

JSON Schema:
{
  "valid": boolean,
  "type": "debit" | "credit" | null,
  "amount": number | null,
  "currency": "INR" | null,
  "merchant": string | null,
  "bank_name": string | null,
  "account_number": string | null,
  "reference_number": string | null,
  "transaction_date": "YYYY-MM-DD" | null,
  "transaction_time": "HH:MM" | null,
  "category_hint": string | null
}

EXAMPLES:
Input: "HDFC: Your A/C xxxxxx8734 has been debited for Rs.5000.00 on 12-Mar-26 at 14:30. Ref 123456789"
Output: {"valid":true,"type":"debit","amount":5000,"currency":"INR","merchant":null,"bank_name":"HDFC","account_number":"8734","reference_number":"123456789","transaction_date":"2026-03-12","transaction_time":"14:30","category_hint":null}

Input: "SBI: Credited Rs.2500 to your A/C XXX1234 on 10/03/2026. TxnRef: 98765"
Output: {"valid":true,"type":"credit","amount":2500,"currency":"INR","merchant":null,"bank_name":"SBI","account_number":"1234","reference_number":"98765","transaction_date":"2026-03-10","transaction_time":null,"category_hint":null}

Input: "Swiggy: You paid Rs.450 for your order #12345. Ref: REF123"
Output: {"valid":true,"type":"debit","amount":450,"currency":"INR","merchant":"Swiggy","bank_name":null,"account_number":null,"reference_number":"REF123","transaction_date":null,"transaction_time":null,"category_hint":"food_delivery"}

Input: "Your account balance is low"
Output: {"valid":false}

MESSAGE:
"""
${rawMessage}
"""

Return ONLY the JSON object. Nothing else.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("[AI INPUT]", message); 
    console.log("[AI OUTPUT]", result);
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[GEMINI] No JSON found in response:', text.substring(0, 100));
      return null;
    }

    const cleanText = jsonMatch[0].trim();
    const parsed = JSON.parse(cleanText);

    // Validate response structure
    if (!parsed.valid) {
      console.log('[GEMINI] AI marked as invalid transaction');
      return null;
    }

    console.log('[GEMINI] Successfully parsed:', {
      type: parsed.type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      bank: parsed.bank_name,
    });

    return parsed;
  } catch (error) {
    console.error('[GEMINI] Parsing error (will fallback to regex):', error.message);
    return null; // Return null to trigger fallback
  }
}

/**
 * Compare AI result with regex fallback
 * Uses AI result if valid, otherwise uses regex result
 */
function compareResults(aiResult, regexResult) {
  if (!aiResult || !aiResult.valid) {
    console.log('[COMPARE] Using regex fallback (AI result invalid)');
    return regexResult;
  }

  // Merge: use AI values, fill gaps with regex values
  return {
    type: aiResult.type || regexResult.type,
    amount: aiResult.amount || regexResult.amount,
    currency: aiResult.currency || regexResult.currency || 'INR',
    merchant: aiResult.merchant || regexResult.merchant,
    bank_name: (aiResult.bank_name || regexResult.bank_name || '').toUpperCase(),
    account_number: aiResult.account_number || regexResult.account_number,
    reference_number: aiResult.reference_number || regexResult.reference_number,
    transaction_time: aiResult.transaction_time ? 
      new Date(`2026-01-01T${aiResult.transaction_time}`) : 
      regexResult.transaction_time,
    balance_from_sms: regexResult.balance_from_sms,
    original_amount: regexResult.original_amount,
    net_amount: aiResult.amount || regexResult.net_amount,
    category_hint: aiResult.category_hint || null
  };
}

/**
 * Estimate token count for a message (rough approximation)
 * Gemini 2.5 Flash: 250K input tokens, 20 RPM, unlimited TPM (per minute)
 * Rule of thumb: ~4 characters = 1 token
 */
function estimateTokenCount(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Parse multiple transaction messages in batches
 * Respects Gemini 2.5 Flash token limits:
 * - Input: 250,000 tokens max per request
 * - Output: 20 RPM (requests per minute)
 * 
 * @param {Array<{id, raw_message}>} transactions - Transactions to parse
 * @param {Object} options - { maxTokensPerBatch, maxBatchSize }
 * @returns {Promise<Array>} - Array of parsing results with status
 */
async function parseTransactionsInBatches(
  transactions,
  options = {}
) {
  const {
    maxTokensPerBatch = 200000, // Conservative: 250K limit - safety margin
    maxBatchSize = 50 // Max messages per batch
  } = options;

  console.log(`[BATCH] ===== BATCH PARSE START =====`);
  console.log(`[BATCH] Input: ${transactions.length} transactions`);

  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.log('[BATCH] ❌ No transactions to parse (empty or not array)');
    return [];
  }

  // Validate input transactions
  let validTransactions = [];
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!tx.id) {
      console.warn(`[BATCH] ⚠️  Transaction ${i} missing ID, skipping`);
      continue;
    }
    if (!tx.raw_message || tx.raw_message.trim().length === 0) {
      console.warn(`[BATCH] ⚠️  Transaction ${tx.id} has empty raw_message, skipping`);
      continue;
    }
    validTransactions.push(tx);
  }

  console.log(`[BATCH] Valid transactions: ${validTransactions.length} (skipped ${transactions.length - validTransactions.length})`);

  if (validTransactions.length === 0) {
    console.log('[BATCH] ❌ No valid transactions after validation');
    return [];
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const results = [];
  let currentBatch = [];
  let currentTokenCount = 0;

  // Base prompt tokens (reused for each batch)
  const basePromptTokens = estimateTokenCount(`You are a financial transaction parser. Parse these SMS messages and extract transaction details.

Return a JSON array with this schema for EACH message:
{
  "message_index": number,
  "valid": boolean,
  "type": "debit" | "credit" | null,
  "amount": number | null,
  "currency": "INR" | null,
  "merchant": string | null,
  "bank_name": string | null,
  "account_number": string | null,
  "reference_number": string | null,
  "transaction_date": "YYYY-MM-DD" | null,
  "transaction_time": "HH:MM" | null,
  "balance_after": number | null,
  "category_hint": string | null
}

CRITICAL RULES:
1. Return ONLY a JSON array - no markdown, no explanations
2. Each message gets a message_index (0-based)
3. Lowercase strings except bank_name (UPPERCASE)
4. Date: YYYY-MM-DD, Time: HH:MM (24-hour)
5. type: ONLY 'debit' or 'credit', null if unclear
6. If no valid transaction data, return {"message_index": X, "valid": false}
7. balance_after: Only include if explicitly mentioned in message
8. For debit messages, suggest category_hint (food, travel, utilities, etc.)
9. For credit messages, suggest category_hint (salary, refund, etc.)

MESSAGES TO PARSE:`);

  let batchStartIndex = 0;

  // Function to process a batch
  const processBatch = async (batch) => {
    if (batch.length === 0) {
      console.log('[BATCH] Empty batch, skipping');
      return [];
    }

    try {
      console.log(`[BATCH] Starting batch processing: ${batch.length} messages, batch index ${batchStartIndex}`);

      // Build batch messages with indices
      const messagesText = batch
        .map((tx, idx) => `\n[${batchStartIndex + idx}] ${tx.raw_message}`)
        .join('');

      const fullPrompt = `You are a financial transaction parser. Parse these SMS messages and extract transaction details.

Return a JSON array with this schema for EACH message:
{
  "message_index": number,
  "valid": boolean,
  "type": "debit" | "credit" | null,
  "amount": number | null,
  "currency": "INR" | null,
  "merchant": string | null,
  "bank_name": string | null,
  "account_number": string | null,
  "reference_number": string | null,
  "transaction_date": "YYYY-MM-DD" | null,
  "transaction_time": "HH:MM" | null,
  "balance_after": number | null,
  "category_hint": string | null
}

CRITICAL RULES:
1. Return ONLY a JSON array - no markdown, no explanations
2. Each message gets a message_index (0-based)
3. Lowercase strings except bank_name (UPPERCASE)
4. Date: YYYY-MM-DD, Time: HH:MM (24-hour)
5. type: ONLY 'debit' or 'credit', null if unclear
6. If no valid transaction data, return {"message_index": X, "valid": false}
7. balance_after: Only include if explicitly mentioned in message
8. For debit messages, suggest category_hint (food, travel, utilities, etc.)
9. For credit messages, suggest category_hint (salary, refund, etc.)

MESSAGES TO PARSE:${messagesText}

Return ONLY the JSON array. Nothing else.`;

      const promptTokens = estimateTokenCount(fullPrompt);
      console.log(`[BATCH] Prompt size: ${promptTokens} tokens, messages: ${batch.length}`);

      if (!process.env.GEMINI_API_KEY) {
        console.error('[BATCH] GEMINI_API_KEY not configured!');
        return batch.map((tx, idx) => ({
          transaction_id: tx.id,
          message_index: batchStartIndex + idx,
          valid: false,
          error: 'Gemini API key not configured'
        }));
      }

      console.log('[BATCH] Sending request to Gemini API...');
      const startTime = Date.now();

      const result = await model.generateContent(fullPrompt);
      const responseTime = Date.now() - startTime;
      console.log(`[BATCH] Received response from Gemini in ${responseTime}ms`);

      const response = await result.response;
      const text = response.text();

      console.log(`[BATCH] Response text length: ${text.length} chars, first 200: ${text.substring(0, 200)}`);

      // Extract JSON array
      const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!arrayMatch) {
        console.warn('[BATCH] No JSON array found in response!');
        console.warn('[BATCH] Full response:', text.substring(0, 500));
        return batch.map((tx, idx) => ({
          transaction_id: tx.id,
          message_index: batchStartIndex + idx,
          valid: false,
          error: 'Failed to parse JSON array from response'
        }));
      }

      console.log('[BATCH] JSON array found, parsing...');
      const parsed = JSON.parse(arrayMatch[0]);

      if (!Array.isArray(parsed)) {
        console.warn('[BATCH] Parsed result is not an array!');
        return batch.map((tx, idx) => ({
          transaction_id: tx.id,
          message_index: batchStartIndex + idx,
          valid: false,
          error: 'Response was not a valid array'
        }));
      }

      console.log(`[BATCH] Successfully parsed ${parsed.length} results from Gemini`);

      // Map results back to transactions
      const mappedResults = parsed.map((item, idx) => {
        const result = {
          transaction_id: batch[idx].id,
          message_index: item.message_index || batchStartIndex + idx,
          valid: item.valid,
          data: item.valid ? item : null,
          missing_fields: !item.valid ? ['all'] : 
            Object.keys(item).filter(k => item[k] === null && k !== 'message_index' && k !== 'valid'),
          error: item.error || null
        };
        
        if (item.valid) {
          console.log(`  [BATCH] Message ${result.message_index}: ✅ VALID - ${item.type} ${item.amount} INR`);
        } else {
          console.log(`  [BATCH] Message ${result.message_index}: ❌ INVALID`);
        }
        
        return result;
      });

      console.log(`[BATCH] Batch complete: ${batch.length} messages processed`);
      return mappedResults;

    } catch (error) {
      console.error('[BATCH] Error processing batch:', error.message);
      console.error('[BATCH] Stack:', error.stack);
      return batch.map((tx, idx) => ({
        transaction_id: tx.id,
        message_index: batchStartIndex + idx,
        valid: false,
        error: error.message
      }));
    }
  };

  // Build and process batches
  console.log(`[BATCH] Starting batch processing for ${validTransactions.length} transactions`);
  console.log(`[BATCH] Config: maxTokens=${maxTokensPerBatch}, maxBatchSize=${maxBatchSize}`);

  let batchNumber = 0;
  for (let i = 0; i < validTransactions.length; i++) {
    const tx = validTransactions[i];
    const messageTokens = estimateTokenCount(tx.raw_message);
    const nextBatchTokens = currentTokenCount + messageTokens;

    // Check if adding this message would exceed limits
    const exceedsTokenLimit = nextBatchTokens + basePromptTokens > maxTokensPerBatch;
    const exceedsBatchSize = currentBatch.length >= maxBatchSize;

    if ((exceedsTokenLimit || exceedsBatchSize) && currentBatch.length > 0) {
      // Process current batch
      console.log(`[BATCH] Batch ${batchNumber} ready to process (reason: ${exceedsTokenLimit ? 'tokens' : 'size'})`);
      batchStartIndex = i - currentBatch.length;
      const batchResults = await processBatch(currentBatch);
      results.push(...batchResults);

      // Reset for next batch
      currentBatch = [tx];
      currentTokenCount = messageTokens;
      batchNumber++;

      // Small delay to respect RPM limit
      console.log(`[BATCH] Waiting 100ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      currentBatch.push(tx);
      currentTokenCount = nextBatchTokens;
      console.log(`[BATCH] Added message ${i} to batch ${batchNumber} (${currentBatch.length} msgs, ${currentTokenCount} tokens)`);
    }
  }

  // Process final batch
  if (currentBatch.length > 0) {
    console.log(`[BATCH] Processing final batch ${batchNumber} with ${currentBatch.length} messages`);
    batchStartIndex = validTransactions.length - currentBatch.length;
    const batchResults = await processBatch(currentBatch);
    results.push(...batchResults);
  }

  console.log(`[BATCH] ✅ Completed! Processed ${validTransactions.length} transactions in ${batchNumber + 1} batches, got ${results.length} results`);
  return results;
}

module.exports = {
  parseTransactionWithAI,
  compareResults,
  parseTransactionsInBatches,
  estimateTokenCount
};
