const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
    return originalJson.call(this, data);
  };
  
  next();
});

// Routes (prefix with /api)
app.use("/api/ingest", require("./routes/ingest.routes"));
app.use("/api/accounts", require("./routes/accounts.routes"));
app.use("/api/transactions", require("./routes/transactions.routes"));
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/budgets", require("./routes/budgets.routes"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
