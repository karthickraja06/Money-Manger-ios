/**
 * statement-parser.service.js
 *
 * FINAL VERSION
 * - XLS / XLSX parser
 * - PDF parser (ICICI multiline supported)
 * - Dynamic merchant extraction
 * - No Gemini dependency
 *
 * Install:
 * npm install xlsx pdf-parse
 */

const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
const fs = require("fs");

/* =======================================================
   HELPERS
======================================================= */

function clean(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function amount(v) {
  if (v === null || v === undefined || v === "") return 0;

  if (typeof v === "number") return Math.abs(v);

  const n = parseFloat(
    String(v)
      .replace(/,/g, "")
      .replace(/[₹$]/g, "")
      .trim()
  );

  return isNaN(n) ? 0 : Math.abs(n);
}

function parseDate(v) {
  if (!v) return null;

  // Excel serial
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }

  const str = clean(v);

  let m =
    str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/) ||
    str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

  if (!m) return null;

  let y, mo, da;

  if (m[1].length === 4) {
    y = +m[1];
    mo = +m[2];
    da = +m[3];
  } else {
    da = +m[1];
    mo = +m[2];
    y = +m[3];
    if (y < 100) y += 2000;
  }

  const dt = new Date(y, mo - 1, da);
  if (isNaN(dt.getTime())) return null;

  return dt;
}

function toISO(d) {
  return d ? d.toISOString().split("T")[0] : null;
}

function detectBank(text) {
  const t = String(text).toUpperCase();

  if (t.includes("HDFC")) return "HDFC";
  if (t.includes("ICICI")) return "ICICI";
  if (t.includes("INDIAN BANK")) return "INDIAN BANK";
  if (t.includes("SBI")) return "SBI";
  if (t.includes("AXIS")) return "AXIS";
  if (t.includes("KOTAK")) return "KOTAK";

  return "Unknown";
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(
      (w) => w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

/* =======================================================
   MERCHANT EXTRACTION (DYNAMIC)
======================================================= */

function extractMerchant(desc) {
  const raw = clean(desc);
  const upper = raw.toUpperCase();

  // 1. UPI Circle
  let m = raw.match(/(?:DELE-|ELE-)([a-zA-Z0-9]+)/i);
  if (m && m[1]) {
    const name = m[1].replace(/\d+/g, "").trim();
    if (name) return titleCase(name);
  }

  // 2. Slash based bank UPI rows
  const parts = raw.split("/").map(clean).filter(Boolean);

  if (parts.length >= 2) {
    const second = parts[1];

    if (
      /^[A-Za-z\s\.]+$/.test(second) &&
      second.length >= 2 &&
      second.length <= 40
    ) {
      return titleCase(second);
    }
  }

  // 3. Search any clean human-looking token
  for (const p of parts) {
    if (
      /^[A-Za-z\s\.]+$/.test(p) &&
      p.length >= 3 &&
      !/UPI|PAYMENT|PHONEPE|BANK/i.test(p)
    ) {
      return titleCase(p);
    }
  }

  // 4. UPI-Name-
  m = raw.match(/^UPI-([A-Za-z\s\.]+?)-/i);
  if (m && m[1]) {
    return titleCase(clean(m[1]));
  }

  // 5. Fallback
  return titleCase(raw.split(" ").slice(0, 3).join(" "));
}

/* =======================================================
   TRANSACTION KIND
======================================================= */

function detectTransactionKind(desc) {
  const t = clean(desc).toUpperCase();

  if (/DELE-|ELE-|CIRCLE/.test(t))
    return "upi_circle";

  if (
    /GROWW|ZERODHA|STOCK|SIP|BROKER|MUTUAL/.test(
      t
    )
  )
    return "investment";

  if (/GOLD/.test(t)) return "gold";

  if (/SALARY|SAL-/.test(t))
    return "salary";

  if (/INT\.?PD|INTEREST/.test(t))
    return "interest";

  if (/ACH|MANDATE|NACH|ECS/.test(t))
    return "mandate";

  if (/IMPS|NEFT|RTGS|INFT/.test(t))
    return "bank_transfer";

  if (/UPI/.test(t)) return "upi";

  return "general";
}

/* =======================================================
   EXCEL PARSER
======================================================= */

function findHeaderRow(rows) {
  const keys = [
    "date",
    "narration",
    "description",
    "remarks",
    "withdrawal",
    "deposit",
    "debit",
    "credit",
    "balance",
  ];

  for (
    let i = 0;
    i < Math.min(rows.length, 80);
    i++
  ) {
    const row = rows[i]
      .map(clean)
      .join(" ")
      .toLowerCase();

    let score = 0;

    for (const k of keys) {
      if (row.includes(k)) score++;
    }

    if (score >= 3) return i;
  }

  return -1;
}

function colIndex(headers, arr) {
  if (!headers || headers.length === 0) return -1;
  
  for (let i = 0; i < headers.length; i++) {
    const h = clean(headers[i]).toLowerCase();
    
    for (const x of arr) {
      if (h.includes(x.toLowerCase())) {
        return i;
      }
    }
  }

  return -1;
}

async function parseExcel(filePath) {
  console.log(`[EXCEL-PARSER] Starting Excel parse for: ${filePath}`);
  
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    });

    console.log(`[EXCEL-PARSER] Loaded ${rows.length} rows, ${rows[0] ? rows[0].length : 0} columns`);

    const bank = detectBank(
      JSON.stringify(rows.slice(0, 10))
    );

    console.log(`[EXCEL-PARSER] Detected bank: ${bank}`);

    const headerRow = findHeaderRow(rows);

    if (headerRow === -1) {
      console.error(`[EXCEL-PARSER] ❌ Header row not found in ${rows.length} rows`);
      console.error(`[EXCEL-PARSER] First 5 rows:`, rows.slice(0, 5));
      throw new Error(
        `Header row not found in Excel file. Expected columns: date, narration/description, debit/withdrawal, credit/deposit`
      );
    }

    console.log(`[EXCEL-PARSER] Header found at row ${headerRow}`);

    const headers = rows[headerRow];
    console.log(`[EXCEL-PARSER] Header row: ${headers.map(clean).join(", ")}`);

    const dateIdx = colIndex(headers, ["date"]);
    const narrIdx = colIndex(headers, [
      "narration",
      "description",
      "remarks",
      "particular",
      "transaction remarks",
      "narr",
    ]);
    const debitIdx = colIndex(headers, [
      "withdrawal",
      "debit",
      "withdrawal amt",
    ]);
    const creditIdx = colIndex(headers, [
      "deposit",
      "credit",
      "deposit amt",
    ]);
    const balIdx = colIndex(headers, ["balance", "closing balance"]);

    console.log(`[EXCEL-PARSER] Column indices - Date: ${dateIdx}, Narration: ${narrIdx}, Debit: ${debitIdx}, Credit: ${creditIdx}, Balance: ${balIdx}`);

    if (dateIdx === -1 || narrIdx === -1) {
      throw new Error(
        `Critical columns missing: ${dateIdx === -1 ? "Date" : ""} ${narrIdx === -1 ? "Description/Narration" : ""}`
      );
    }

    if (debitIdx === -1 && creditIdx === -1) {
      throw new Error(
        "Neither Debit nor Credit column found. Expected columns with names containing: withdrawal/debit/deposit/credit"
      );
    }

    const txns = [];
    let skipped = 0;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row || row.every((v) => !v)) {
        skipped++;
        continue;
      }

      const dt = parseDate(row[dateIdx]);

      if (!dt) {
        skipped++;
        continue;
      }

      const desc = clean(row[narrIdx]);

      if (!desc) {
        skipped++;
        continue;
      }

      const debit = debitIdx !== -1 ? amount(row[debitIdx]) : 0;
      const credit = creditIdx !== -1 ? amount(row[creditIdx]) : 0;

      if (debit === 0 && credit === 0) {
        skipped++;
        continue;
      }

      const txnType = debit > 0 ? "debit" : "credit";
      const txnAmount = debit > 0 ? debit : credit;

      txns.push({
        date: toISO(dt),
        description: desc,
        amount: txnAmount,
        transactionType: txnType,
        balance: balIdx !== -1 ? amount(row[balIdx]) : null,
        merchant: extractMerchant(desc),
        kind: detectTransactionKind(desc),
      });
    }

    console.log(`[EXCEL-PARSER] ✅ Parsed ${txns.length} transactions (${skipped} skipped)`);

    if (txns.length === 0) {
      throw new Error("No valid transactions found in Excel file");
    }

    return finalize(txns, bank, "excel_local");
  } catch (err) {
    console.error(`[EXCEL-PARSER] ❌ Error: ${err.message}`);
    throw err;
  }
}

/* =======================================================
   PDF PARSER (ICICI MULTILINE)
======================================================= */

async function parsePDF(filePath) {
  console.log(`[PDF-PARSER] Starting PDF parse for: ${filePath}`);
  
  try {
    const buffer = fs.readFileSync(filePath);
    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    console.log(`[PDF-PARSER] Extracted ${text.length} characters from PDF`);

    const bank = detectBank(text);
    console.log(`[PDF-PARSER] Detected bank: ${bank}`);

    const lines = text
      .split("\n")
      .map(clean)
      .filter(Boolean);

    console.log(`[PDF-PARSER] Found ${lines.length} lines in PDF`);

    // Strategy 1: ICICI Multiline Format (strict)
    if (bank === "ICICI") {
      console.log(`[PDF-PARSER] Attempting ICICI multiline format parsing...`);
      const result = parseICICIMultiline(lines);
      if (result && result.length > 0) {
        console.log(`[PDF-PARSER] ✅ ICICI multiline: Parsed ${result.length} transactions`);
        return finalize(result, bank, "pdf_icici_multiline");
      }
      console.log(`[PDF-PARSER] ICICI multiline failed, trying single-line format...`);
    }

    // Strategy 2: HDFC/Generic Single-Line Format
    console.log(`[PDF-PARSER] Attempting single-line format parsing...`);
    const result = parsePDFSingleLine(lines);
    if (result && result.length > 0) {
      console.log(`[PDF-PARSER] ✅ Single-line: Parsed ${result.length} transactions`);
      return finalize(result, bank, `pdf_${bank.toLowerCase()}_single`);
    }

    // Strategy 3: Generic multiline (last resort)
    console.log(`[PDF-PARSER] Attempting generic multiline parsing...`);
    const multilineResult = parsePDFMultiline(lines);
    if (multilineResult && multilineResult.length > 0) {
      console.log(`[PDF-PARSER] ✅ Generic multiline: Parsed ${multilineResult.length} transactions`);
      return finalize(multilineResult, bank, "pdf_generic_multiline");
    }

    console.error(`[PDF-PARSER] ❌ All parsing strategies failed`);
    throw new Error(
      `Could not parse PDF for ${bank}. No transactions found with any parsing strategy.`
    );
  } catch (err) {
    console.error(`[PDF-PARSER] ❌ Error: ${err.message}`);
    throw err;
  }
}

// ICICI Multiline Parser
function parseICICIMultiline(lines) {
  const txns = [];
  const blocks = [];
  let current = [];

  // ICICI format: Date | Transaction Remarks(multiline) | Withdrawal | Deposit | Balance
  const datePattern = /^\d{2}[.-\/]\d{2}[.-\/]\d{2,4}/;

  for (const line of lines) {
    if (datePattern.test(line.trim())) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length) blocks.push(current);

  console.log(`[PDF-ICICI] Found ${blocks.length} transaction blocks`);

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const joined = block.join(" ");

    // Try multiple patterns to handle ICICI variations
    // Pattern 1: DATE DESCRIPTION(multi) DEBIT CREDIT BALANCE
    let m = joined.match(
      /^(\d{2}[.-\/]\d{2}[.-\/]\d{2,4})\s+(.*?)\s+(\d+(?:[.,]\d{2})?)\s+(\d+(?:[.,]\d{2})?)\s+(\d+(?:[.,]\d{2})?)$/
    );

    // Pattern 2: DATE DESCRIPTION(multi) DEBIT CREDIT (no balance)
    if (!m) {
      m = joined.match(
        /^(\d{2}[.-\/]\d{2}[.-\/]\d{2,4})\s+(.*?)\s+(\d+(?:[.,]\d{2})?)\s+(\d+(?:[.,]\d{2})?)$/
      );
    }

    if (!m) {
      console.log(`[PDF-ICICI] Block ${idx}: No pattern match`);
      continue;
    }

    const dt = parseDate(m[1]);
    if (!dt) {
      console.log(`[PDF-ICICI] Block ${idx}: Invalid date ${m[1]}`);
      continue;
    }

    const desc = clean(m[2]);
    const debit = amount(m[3]);
    const credit = amount(m[4]);
    const bal = m[5] ? amount(m[5]) : null;

    if (debit === 0 && credit === 0) {
      console.log(`[PDF-ICICI] Block ${idx}: Zero amount`);
      continue;
    }

    const kind = detectTransactionKind(desc);
    const txnType = debit > 0 ? "debit" : "credit";
    const txnAmount = debit > 0 ? debit : credit;

    txns.push({
      date: toISO(dt),
      description: desc,
      amount: txnAmount,
      transactionType: txnType,
      balance: bal,
      merchant: extractMerchant(desc),
      kind,
    });

    console.log(`[PDF-ICICI] Block ${idx}: ✅ Date=${toISO(dt)}, Desc=${desc.substring(0, 30)}..., Amount=${txnAmount}`);
  }

  return txns;
}

// Single-line PDF Parser (HDFC, SBI, etc.)
function parsePDFSingleLine(lines) {
  const txns = [];
  const datePattern = /^\d{2}[.-\/]\d{2}[.-\/]\d{2,4}\s+/;

  console.log(`[PDF-SINGLE] Processing ${lines.length} lines...`);

  for (const line of lines) {
    if (!datePattern.test(line.trim())) continue;

    // Pattern: DATE DESC DEBIT CREDIT BALANCE
    const m = line.match(
      /^(\d{2}[.-\/]\d{2}[.-\/]\d{2,4})\s+(.*?)\s+(\d+(?:[.,]\d{2})?)\s+(\d+(?:[.,]\d{2})?)\s+(\d+(?:[.,]\d{2})?)$/
    );

    if (!m) continue;

    const dt = parseDate(m[1]);
    if (!dt) continue;

    const desc = clean(m[2]);
    const debit = amount(m[3]);
    const credit = amount(m[4]);
    const bal = amount(m[5]);

    if (debit === 0 && credit === 0) continue;

    const kind = detectTransactionKind(desc);
    const txnType = debit > 0 ? "debit" : "credit";
    const txnAmount = debit > 0 ? debit : credit;

    txns.push({
      date: toISO(dt),
      description: desc,
      amount: txnAmount,
      transactionType: txnType,
      balance: bal,
      merchant: extractMerchant(desc),
      kind,
    });
  }

  console.log(`[PDF-SINGLE] ✅ Parsed ${txns.length} transactions`);
  return txns;
}

// Generic Multiline Parser (fallback)
function parsePDFMultiline(lines) {
  const txns = [];
  const blocks = [];
  let current = [];

  const startRegex = /^\d+\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;

  for (const line of lines) {
    if (startRegex.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }

  if (current.length) blocks.push(current);

  console.log(`[PDF-MULTI] Found ${blocks.length} blocks...`);

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const joined = block.join(" ");

    const m = joined.match(
      /^\d+\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(.*?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/
    );

    if (!m) continue;

    const dt = parseDate(m[1]);
    if (!dt) continue;

    const desc = clean(m[2]);
    const txnAmount = amount(m[3]);
    const bal = amount(m[4]);

    const kind = detectTransactionKind(desc);

    txns.push({
      date: toISO(dt),
      description: desc,
      amount: txnAmount,
      transactionType: kind === "interest" ? "credit" : "debit",
      balance: bal,
      merchant: extractMerchant(desc),
      kind,
    });
  }

  console.log(`[PDF-MULTI] ✅ Parsed ${txns.length} transactions`);
  return txns;
}

/* =======================================================
   CSV PARSER (ICICI CSV FORMAT)
======================================================= */

async function parseCSV(filePath) {
  console.log(`[CSV-PARSER] Starting CSV parse for: ${filePath}`);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);

    console.log(`[CSV-PARSER] Loaded ${lines.length} lines from CSV`);

    const bank = detectBank(fileContent);
    console.log(`[CSV-PARSER] Detected bank: ${bank}`);

    // Find header row by looking for DATE column
    let headerIdx = -1;
    const headerKeywords = ['date', 'mode', 'particulars', 'deposits', 'withdrawals', 'balance'];
    
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      const line = lines[i].toLowerCase();
      let matches = 0;
      for (const keyword of headerKeywords) {
        if (line.includes(keyword)) matches++;
      }
      if (matches >= 3) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      console.error(`[CSV-PARSER] ❌ Header row not found in ${lines.length} lines`);
      console.error(`[CSV-PARSER] First 5 lines:`, lines.slice(0, 5));
      throw new Error('Header row not found in CSV file. Expected columns: DATE, MODE, PARTICULARS, DEPOSITS, WITHDRAWALS, BALANCE');
    }

    console.log(`[CSV-PARSER] Header found at line ${headerIdx}`);

    // Parse header to find column indices
    const headerLine = lines[headerIdx];
    const headers = headerLine.split(',').map(h => clean(h));
    
    console.log(`[CSV-PARSER] Headers: ${headers.join(', ')}`);

    const dateIdx = colIndex(headers, ['date']);
    const modeIdx = colIndex(headers, ['mode']);
    const particularIdx = colIndex(headers, ['particulars', 'narration', 'description']);
    const depositIdx = colIndex(headers, ['deposits', 'credit', 'deposit amt']);
    const withdrawalIdx = colIndex(headers, ['withdrawals', 'debit', 'withdrawal amt']);
    const balIdx = colIndex(headers, ['balance', 'closing balance']);

    console.log(`[CSV-PARSER] Column indices - Date: ${dateIdx}, Particulars: ${particularIdx}, Deposit: ${depositIdx}, Withdrawal: ${withdrawalIdx}, Balance: ${balIdx}`);

    if (dateIdx === -1 || particularIdx === -1) {
      throw new Error(
        `Critical columns missing: ${dateIdx === -1 ? 'Date' : ''} ${particularIdx === -1 ? 'Particulars/Description' : ''}`
      );
    }

    if (depositIdx === -1 && withdrawalIdx === -1) {
      throw new Error('Neither Deposits nor Withdrawals column found');
    }

    const txns = [];
    let skipped = 0;

    // Parse data rows (skip header and empty rows)
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        skipped++;
        continue;
      }

      const cols = line.split(',').map(c => clean(c));

      // Skip if not enough columns
      if (cols.length < Math.max(dateIdx, particularIdx, depositIdx, withdrawalIdx) + 1) {
        skipped++;
        continue;
      }

      const dateStr = cols[dateIdx];
      const dt = parseDate(dateStr);

      if (!dt) {
        console.log(`[CSV-PARSER] Row ${i}: Invalid date ${dateStr}`);
        skipped++;
        continue;
      }

      const particular = cols[particularIdx];
      if (!particular) {
        skipped++;
        continue;
      }

      const deposit = depositIdx !== -1 ? amount(cols[depositIdx]) : 0;
      const withdrawal = withdrawalIdx !== -1 ? amount(cols[withdrawalIdx]) : 0;

      if (deposit === 0 && withdrawal === 0) {
        skipped++;
        continue;
      }

      const txnType = withdrawal > 0 ? 'debit' : 'credit';
      const txnAmount = withdrawal > 0 ? withdrawal : deposit;

      txns.push({
        date: toISO(dt),
        description: particular,
        amount: txnAmount,
        transactionType: txnType,
        balance: balIdx !== -1 ? amount(cols[balIdx]) : null,
        merchant: extractMerchant(particular),
        kind: detectTransactionKind(particular),
      });

      console.log(`[CSV-PARSER] Row ${i}: ✅ Date=${toISO(dt)}, Particular=${particular.substring(0, 40)}..., Amount=${txnAmount}`);
    }

    console.log(`[CSV-PARSER] ✅ Parsed ${txns.length} transactions (${skipped} skipped)`);

    if (txns.length === 0) {
      throw new Error('No valid transactions found in CSV file');
    }

    return finalize(txns, bank, 'csv_icici');
  } catch (err) {
    console.error(`[CSV-PARSER] ❌ Error: ${err.message}`);
    throw err;
  }
}

/* =======================================================
   FINALIZE
======================================================= */

function finalize(
  transactions,
  bank,
  engine
) {
  if (
    !transactions.length
  ) {
    throw new Error(
      "No transactions found"
    );
  }

  transactions.sort(
    (a, b) =>
      new Date(a.date) -
      new Date(b.date)
  );

  return {
    format:
      engine.includes(
        "pdf"
      )
        ? "pdf"
        : "xlsx",

    transactions,

    openingBalance:
      transactions[0]
        .balance || null,

    closingBalance:
      transactions[
        transactions.length -
          1
      ].balance || null,

    startDate:
      transactions[0].date,

    endDate:
      transactions[
        transactions.length -
          1
      ].date,

    count:
      transactions.length,

    accountInfo: {
      bank,
      accountNumber:
        null,
      accountHolder:
        null,
    },

    parseEngine:
      engine,
  };
}

/* =======================================================
   EXPORT
======================================================= */

module.exports.parseStatementFile =
  async (
    filePath,
    fileType
  ) => {
    try {
      if (
        fileType ===
          "xls" ||
        fileType ===
          "xlsx"
      ) {
        return await parseExcel(
          filePath
        );
      }

      if (
        fileType === "pdf"
      ) {
        return await parsePDF(
          filePath
        );
      }

      if (
        fileType === "csv"
      ) {
        return await parseCSV(
          filePath
        );
      }

      throw new Error(
        "Unsupported file type. Supported: XLS, XLSX, CSV, PDF"
      );
    } catch (err) {
      console.error(
        "[STATEMENT PARSER ERROR]",
        err
      );
      throw err;
    }
  };