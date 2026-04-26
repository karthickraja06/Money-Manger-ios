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

  // UPI Circle / delegated payments
  let m = raw.match(
    /(?:DELE-|ELE-)([a-zA-Z0-9]+)/i
  );

  if (m && m[1]) {
    const name = m[1]
      .replace(/\d+/g, "")
      .trim();

    if (name) return titleCase(name);
  }

  // Extract first meaningful token after UPI-
  m = raw.match(/^UPI-([A-Za-z\s\.]+?)-/i);
  if (m && m[1]) {
    return titleCase(clean(m[1]));
  }

  // Slash separated UPI
  if (upper.includes("UPI/")) {
    const parts = raw
      .split("/")
      .map(clean)
      .filter(Boolean);

    for (const p of parts) {
      const pu = p.toUpperCase();

      if (p.includes("@")) continue;
      if (/^\d+$/.test(p)) continue;
      if (p.length < 3) continue;
      if (
        /UPI|BANK|AXI|HDFC|ICICI|SBI|KOTAK|VALID/.test(
          pu
        )
      )
        continue;

      if (/^[A-Z0-9]{8,}$/i.test(p)) continue;

      return titleCase(p);
    }
  }

  // Generic cleanup
  let text = upper
    .replace(
      /UPI|IMPS|NEFT|RTGS|INFT|ACH|NACH|ECS/g,
      " "
    )
    .replace(
      /BANK|HDFC|ICICI|SBI|AXIS|KOTAK/g,
      " "
    )
    .replace(/[@\/:_\-]/g, " ")
    .replace(/\b[A-Z0-9]{8,}\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text
    .split(" ")
    .filter((w) => w.length > 2);

  if (!words.length) return "Unknown";

  return titleCase(words.slice(0, 4).join(" "));
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
  for (let i = 0; i < headers.length; i++) {
    const h = clean(headers[i]).toLowerCase();

    for (const x of arr) {
      if (h.includes(x)) return i;
    }
  }

  return -1;
}

async function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws =
    wb.Sheets[wb.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(
    ws,
    {
      header: 1,
      defval: "",
    }
  );

  const bank = detectBank(
    JSON.stringify(rows.slice(0, 10))
  );

  const headerRow = findHeaderRow(rows);

  if (headerRow === -1) {
    throw new Error(
      "Header row not found"
    );
  }

  const headers = rows[headerRow];

  const dateIdx = colIndex(headers, [
    "date",
  ]);

  const narrIdx = colIndex(headers, [
    "narration",
    "description",
    "remarks",
    "particular",
  ]);

  const debitIdx = colIndex(headers, [
    "withdrawal",
    "debit",
  ]);

  const creditIdx = colIndex(headers, [
    "deposit",
    "credit",
  ]);

  const balIdx = colIndex(headers, [
    "balance",
  ]);

  const txns = [];

  for (
    let i = headerRow + 1;
    i < rows.length;
    i++
  ) {
    const row = rows[i];

    const dt = parseDate(
      row[dateIdx]
    );

    if (!dt) continue;

    const desc = clean(
      row[narrIdx]
    );

    const debit = amount(
      row[debitIdx]
    );

    const credit = amount(
      row[creditIdx]
    );

    if (
      debit === 0 &&
      credit === 0
    )
      continue;

    const txnType =
      debit > 0
        ? "debit"
        : "credit";

    const txnAmount =
      debit > 0
        ? debit
        : credit;

    txns.push({
      date: toISO(dt),
      description: desc,
      amount: txnAmount,
      transactionType: txnType,
      balance: amount(
        row[balIdx]
      ),
      merchant:
        extractMerchant(desc),
      kind:
        detectTransactionKind(
          desc
        ),
    });
  }

  return finalize(
    txns,
    bank,
    "excel_local"
  );
}

/* =======================================================
   PDF PARSER (ICICI MULTILINE)
======================================================= */

async function parsePDF(filePath) {
  const buffer =
    fs.readFileSync(filePath);

  const pdf = await pdfParse(
    buffer
  );

  const text = pdf.text;

  const bank = detectBank(text);

  const lines = text
    .split("\n")
    .map(clean)
    .filter(Boolean);

  const blocks = [];
  let current = [];

  const startRegex =
    /^\d+\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;

  for (const line of lines) {
    if (startRegex.test(line)) {
      if (current.length)
        blocks.push(current);

      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }

  if (current.length)
    blocks.push(current);

  const txns = [];

  for (const block of blocks) {
    const joined =
      block.join(" ");

    const m = joined.match(
      /^\d+\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(.*?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/
    );

    if (!m) continue;

    const dt = parseDate(
      m[1]
    );

    if (!dt) continue;

    const desc = clean(
      m[2]
    );

    const txnAmount =
      amount(m[3]);

    const bal =
      amount(m[4]);

    const kind =
      detectTransactionKind(
        desc
      );

    txns.push({
      date: toISO(dt),
      description: desc,
      amount: txnAmount,
      transactionType:
        kind ===
          "interest"
          ? "credit"
          : "debit",
      balance: bal,
      merchant:
        extractMerchant(desc),
      kind,
    });
  }

  return finalize(
    txns,
    bank,
    "pdf_local"
  );
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

      throw new Error(
        "Unsupported file type"
      );
    } catch (err) {
      console.error(
        "[STATEMENT PARSER ERROR]",
        err
      );
      throw err;
    }
  };