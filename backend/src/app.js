const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/ingest", require("./routes/ingest.routes"));
app.use("/accounts", require("./routes/accounts.routes"));
app.use("/transactions", require("./routes/transactions.routes"));
app.use("/dashboard", require("./routes/dashboard.routes"));
app.use("/budgets", require("./routes/budgets.routes"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
