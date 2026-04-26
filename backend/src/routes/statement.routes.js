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
    if (['.xlsx', '.xls', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only XLS and PDF files are supported'));
    }
  }
});

/**
 * POST /statement/import
 * Upload and import bank statement
 * Body: { account_id, file }
 */
router.post('/import', authenticateUser, upload.single('file'), async (req, res, next) => {
  let tempFilePath = null;

  try {
    const userId = req.user.user_id;
    const accountId = req.body.account_id || req.body.accountId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;

    console.log(`[STATEMENT-ROUTE] User ${userId} importing statement for account ${accountId}`);
    console.log(`[STATEMENT-ROUTE] File: ${req.file.originalname} (${req.file.size} bytes)`);

    // Determine file type
    const fileName = req.file.originalname;
    const fileExt = path.extname(fileName).toLowerCase().slice(1);

    if (!['xlsx', 'xls', 'pdf'].includes(fileExt)) {
      return res.status(400).json({ error: 'Unsupported file type. Use XLS or PDF.' });
    }

    // Parse the statement
    const parsed = await parseStatementFile(tempFilePath, fileExt);

    console.log(`[STATEMENT-ROUTE] Parsed ${parsed.count} transactions`);
    console.log(`[STATEMENT-ROUTE] Parse engine: ${parsed.parseEngine || 'unknown'}`);
    console.log(`[STATEMENT-ROUTE] Opening: ₹${parsed.openingBalance}, Closing: ₹${parsed.closingBalance}`);
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
    const deleteResult = await Transaction.deleteMany({
      user_id: userId,
      account_id: account._id,
      date: { $gte: startDate, $lte: endDateEOD }
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
      if (txn.transactionKind) derivedTags.push(txn.transactionKind);
      if (txn.isSelfTransfer) derivedTags.push('self_transfer');
      // For file-based imports, mark as NOT needing AI review
      // The source document (bank statement) is the authority
      const newTxn = new Transaction({
        user_id: userId,
        account_id: account._id,
        date: txnDate,
        transaction_time: txnDate,
        merchant: txn.counterpartyName || txn.description || 'Statement Import',
        receiver_name: txnType === 'debit' ? (txn.counterpartyName || null) : null,
        sender_name: txnType === 'credit' ? (txn.counterpartyName || null) : null,
        amount: txn.amount,
        original_amount: txn.amount,
        net_amount: txn.amount,
        type: txnType,
        bank_name: account.bank_name,
        account_number: account.account_number,
        raw_message: txn.description || 'Statement Import',
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
    console.error('[STATEMENT-ROUTE] Error:', err.message);

    // Clean up file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    next(err);
  }
});

module.exports = router;
