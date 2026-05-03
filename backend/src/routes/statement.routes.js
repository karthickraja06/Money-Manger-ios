const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticateUser } = require('../middleware/auth');
const { parseStatementFile } = require('../services/statement-parser.service');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

const toValidDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Prefer deterministic DMY/YMD parsing over JS-native parser.
  let match = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    let [, dd, mm, yy] = match;
    if (yy.length === 2) yy = `20${yy}`;
    const d = new Date(`${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  match = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) {
    const [, yy, mm, dd] = match;
    const d = new Date(`${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Setup multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.pdf', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only XLS, XLSX, CSV and PDF files are supported'));
    }
  }
});

/**
 * POST /statement/import
 * Upload and import bank statement
 * Body: { account_id, file }
 */
router.post('/import', authenticateUser, upload.single('file'), async (req, res, next) => {

  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔥 STATEMENT IMPORT ROUTE HIT\n`);
  let tempFilePath = null;

  try {
    const userId = req.user.user_id;
    const accountId = req.body.account_id || req.body.accountId;

    console.log(`[${timestamp}] User: ${userId}`);
    console.log(`[${timestamp}] Account ID: ${accountId}`);
    console.log(`[${timestamp}] File present: ${!!req.file}`);
    if (req.file) {
      console.log(`[${timestamp}] File name: ${req.file.originalname}`);
      console.log(`[${timestamp}] File size: ${req.file.size} bytes`);
      console.log(`[${timestamp}] File path: ${req.file.path}`);
    }

    if (!req.file) {
      console.log(`[${timestamp}] ❌ ERROR: No file uploaded`);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;

    // Determine file type
    const fileName = req.file.originalname;
    const fileExt = path.extname(fileName).toLowerCase().slice(1);

    console.log(`[${timestamp}] File extension: ${fileExt}`);
    console.log(`[${timestamp}] File name: ${fileName}`);

    if (!['xlsx', 'xls', 'pdf', 'csv'].includes(fileExt)) {
      console.log(`[${timestamp}] ❌ ERROR: Unsupported file type: ${fileExt}`);
      return res.status(400).json({ error: 'Unsupported file type. Use XLS, XLSX, CSV or PDF.' });
    }

    console.log(`[${timestamp}] ✅ File type accepted: ${fileExt}`);
    console.log(`[${timestamp}] Starting parse with parseStatementFile(${tempFilePath}, ${fileExt})`);

    // Parse the statement
    let parsed;
    try {
      parsed = await parseStatementFile(tempFilePath, fileExt);
      console.log(`[${timestamp}] ✅ Parsing successful`);
    } catch (parseErr) {
      console.error(`[${timestamp}] ❌ PARSE ERROR: ${parseErr.message}`);
      console.error(`[${timestamp}] Parse error stack: ${parseErr.stack}`);
      throw parseErr;
    }

    console.log(`[${timestamp}] Parsed ${parsed.count || parsed.transactions.length} transactions`);
    console.log(`[${timestamp}] Parse engine: ${parsed.parseEngine || 'unknown'}`);
    console.log(`[${timestamp}] Opening: ₹${parsed.openingBalance}, Closing: ₹${parsed.closingBalance}`);
    console.log(`[STATEMENT-ROUTE] Account Info:`, parsed.accountInfo);

    // If account_id not provided, try to auto-detect from statement
    let account = null;
    
    if (accountId) {
      // Use provided account ID
      account = await Account.findById(accountId);
      if (!account || account.user_id !== userId) {
        return res.status(404).json({ error: 'Account not found' });
      }
      console.log(`[STATEMENT-ROUTE] Using provided account: ${account.account_number}`);
    } else if (parsed.accountInfo && parsed.accountInfo.accountNumber) {
      // Try to find account by bank + account number
      console.log(`[STATEMENT-ROUTE] Auto-detecting account: ${parsed.accountInfo.bank} ${parsed.accountInfo.accountNumber}`);
      account = await Account.findOne({
        user_id: userId,
        account_number: parsed.accountInfo.accountNumber
      });

      if (!account) {
        // Try with partial match (last 4 digits)
        const lastFour = parsed.accountInfo.accountNumber.slice(-4);
        account = await Account.findOne({
          user_id: userId,
          account_number: new RegExp(lastFour + '$')
        });
      }

      if (!account) {
        return res.status(400).json({
          error: 'Could not auto-detect account. Please provide account_id.',
          detectedAccount: parsed.accountInfo.accountNumber
        });
      }

      console.log(`[STATEMENT-ROUTE] Auto-detected account: ${account.nickname || account.account_number}`);
    } else {
      return res.status(400).json({
        error: 'No account specified and could not detect from statement. Provide account_id.'
      });
    }

    // Verify opening balance
    const dbBalance = account.current_balance || 0;
    const openingMismatch =
      parsed.openingBalance != null && Math.abs(parsed.openingBalance - dbBalance) > 1;

    if (openingMismatch) {
      console.warn(
        `[STATEMENT-ROUTE] ⚠️  Opening balance mismatch: DB=₹${dbBalance}, Statement=₹${parsed.openingBalance}`
      );
    }

    // Determine date range
    let startDate = toValidDate(parsed.startDate);
    let endDate = toValidDate(parsed.endDate);

    // Fallback to transaction dates if parser-level date range is missing/invalid.
    if ((!startDate || !endDate) && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
      const validTxnDates = parsed.transactions
        .map((txn) => toValidDate(txn.date))
        .filter(Boolean)
        .sort((a, b) => a - b);

      if (validTxnDates.length > 0) {
        startDate = startDate || validTxnDates[0];
        endDate = endDate || validTxnDates[validTxnDates.length - 1];
      }
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Could not extract date range from statement. Please ensure statement has clear date columns.'
      });
    }

    // Set end date to end of day
    const endDateEOD = new Date(endDate);
    endDateEOD.setHours(23, 59, 59, 999);

    console.log(`[STATEMENT-ROUTE] Date range: ${startDate.toISOString()} to ${endDateEOD.toISOString()}`);

    // Delete existing transactions in this range (as per requirement)
    console.log(`[STATEMENT-ROUTE] Deleting existing transactions in range...`);
    console.log(`[STATEMENT-ROUTE] Query params - userId: ${userId}, accountId: ${account._id}`);
    console.log(`[STATEMENT-ROUTE] Date range - Start: ${startDate.toISOString()}, End: ${endDateEOD.toISOString()}`);
    
    // ✅ FIRST: Check ALL transactions for this account (any date)
    const totalTxnsForAccount = await Transaction.countDocuments({
      user_id: userId,
      account_id: account._id
    });
    console.log(`[STATEMENT-ROUTE] Total transactions for this account: ${totalTxnsForAccount}`);
    
    // ✅ SECOND: Check transactions without date filter
    const txnsWithoutDateFilter = await Transaction.find({
      user_id: userId,
      account_id: account._id
    }).select('date description amount').limit(5);
    console.log(`[STATEMENT-ROUTE] Sample txns (any transaction_time):`, txnsWithoutDateFilter.map(t => ({
      transaction_time: t.transaction_time,
      desc: t.description,
      amount: t.amount
    })));
    
    // ✅ THIRD: Now check with transaction_time filter
    const existingCount = await Transaction.countDocuments({
      user_id: userId,
      account_id: account._id,
      transaction_time: { $gte: startDate, $lte: endDateEOD }
    });
    
    console.log(`[STATEMENT-ROUTE] Found ${existingCount} transactions in date range`);
    
    if (existingCount > 0) {
      const sample = await Transaction.find({
        user_id: userId,
        account_id: account._id,
        transaction_time: { $gte: startDate, $lte: endDateEOD }
      }).select('transaction_time description amount').limit(3);
      console.log(`[STATEMENT-ROUTE] Sample existing transactions:`, sample.map(t => ({
        transaction_time: t.transaction_time,
        desc: t.description,
        amount: t.amount
      })));
    }
    
    const deleteResult = await Transaction.deleteMany({
      user_id: userId,
      account_id: account._id,
      transaction_time: { $gte: startDate, $lte: endDateEOD }
    });

    console.log(`[STATEMENT-ROUTE] Deleted ${deleteResult.deletedCount} existing transactions`);

    // Insert new transactions
    const newTransactions = [];
    for (const txn of parsed.transactions) {
      if (!txn.date) continue; // Skip if no date

      const txnDate = toValidDate(txn.date);
      if (!txnDate) continue;
      const txnType = txn.transactionType === 'credit' ? 'credit' : 'debit';
      const derivedTags = [];
      if (txn.kind) derivedTags.push(txn.kind);
      if (txn.isSelfTransfer) derivedTags.push('self_transfer');
      
      // Map transaction kind to proper category
      const mapTransactionKindToCategory = (kind, type) => {
        const categoryMap = {
          'upi': 'digital_transfer',
          'salary': 'income',
          'investment': 'investment',
          'interest': 'income',
          'self_transfer': 'transfer',
          'bank_transfer': 'transfer',
          'upi_circle': 'digital_transfer',
          'general': type === 'credit' ? 'income' : 'expense'
        };
        return categoryMap[kind] || (type === 'credit' ? 'income' : 'expense');
      };
      
      const category = mapTransactionKindToCategory(txn.kind, txnType);
      
      // For file-based imports, mark as NOT needing AI review
      // The source document (bank statement) is the authority
      const rawMsg = txn.description && txn.description.trim() ? txn.description : 
                     `${txn.transactionType === 'debit' ? 'Debit' : 'Credit'} - Statement Import`;
      
      const newTxn = new Transaction({
        user_id: userId,
        account_id: account._id,
        transaction_time: txnDate,
        merchant: txn.merchant || txn.counterpartyName || txn.description || 'Unknown',
        receiver_name: txnType === 'debit' ? (txn.merchant || txn.counterpartyName || null) : null,
        sender_name: txnType === 'credit' ? (txn.merchant || txn.counterpartyName || null) : null,
        amount: txn.amount,
        original_amount: txn.amount,
        net_amount: txn.amount,
        type: txnType,
        category: category,
        bank_name: account.bank_name,
        account_number: account.account_number,
        raw_message: rawMsg,
        reference_number: txn.reference,
        source: 'statement_import',
        tags: derivedTags,
        balance_after: txn.balance,
        ai_parsed: false,  // ✅ NOT AI parsed - from official statement file
        ai_parse_confidence: null,  // ✅ No confidence score needed
        created_at: new Date()
      });

      newTransactions.push(newTxn);
    }

    // Bulk insert
    const inserted = await Transaction.insertMany(newTransactions);
    console.log(`[STATEMENT-ROUTE] Inserted ${inserted.length} new transactions`);

    // Update account balance to closing balance
    if (parsed.closingBalance != null) {
      const oldBalance = account.current_balance;
      account.current_balance = parsed.closingBalance;
      await account.save();
      console.log(`[STATEMENT-ROUTE] Updated account balance: ₹${oldBalance} → ₹${parsed.closingBalance}`);
    }

    // Clean up uploaded file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      status: 'success',
      message: 'Statement imported successfully',
      summary: {
        deleted: deleteResult.deletedCount,
        imported: inserted.length,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        balanceMismatch: openingMismatch,
        parseEngine: parsed.parseEngine || 'unknown',
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDateEOD.toISOString().split('T')[0]
        }
      }
    });
  } catch (err) {
    const timestamp = new Date().toISOString();
    console.error(`\n[${timestamp}] ❌❌❌ STATEMENT IMPORT ERROR ❌❌❌`);
    console.error(`[${timestamp}] Error message: ${err.message}`);
    console.error(`[${timestamp}] Error name: ${err.name}`);
    console.error(`[${timestamp}] Error stack:\n${err.stack}\n`);

    // Clean up file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // Determine error response based on error type
    let statusCode = 500;
    let errorResponse = {
      error: 'Statement import failed',
      message: err.message
    };

    if (err.message.includes('Unsupported file type')) {
      statusCode = 400;
      errorResponse.error = 'Unsupported file type';
    } else if (err.message.includes('Critical columns missing') || err.message.includes('Neither Debit nor Credit')) {
      statusCode = 400;
      errorResponse.error = 'Invalid statement format';
      errorResponse.hint = 'The file format is not recognized. Check your bank statement layout.';
    } else if (err.message.includes('No transactions found') || err.message.includes('Could not parse')) {
      statusCode = 400;
      errorResponse.error = 'Could not parse transactions';
      errorResponse.hint = 'The file contains no valid transactions. Check the file format.';
    } else if (err.message.includes('No file uploaded')) {
      statusCode = 400;
      errorResponse.error = 'No file uploaded';
    } else if (err.message.includes('Account not found')) {
      statusCode = 404;
      errorResponse.error = 'Account not found';
    }

    // Add debugging info for development
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.debug = {
        timestamp: new Date().toISOString(),
        file: req.file ? req.file.originalname : 'none',
        userId: req.user ? req.user.user_id : 'anonymous'
      };
    }

    console.error(`[${timestamp}] Responding with status ${statusCode}: ${JSON.stringify(errorResponse)}\n`);
    return res.status(statusCode).json(errorResponse);
  }
});

module.exports = router;
