const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");
const syncService = require("./services/sync.service");
const { authenticateUser } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/ingest", require("./routes/ingest.routes"));
app.use("/accounts", require("./routes/accounts.routes"));
app.use("/transactions", require("./routes/transactions.routes"));
app.use("/dashboard", require("./routes/dashboard.routes"));
app.use("/budgets", require("./routes/budgets.routes"));
app.use("/reparse", require("./routes/reparse.routes"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    sync_service: {
      isRunning: true,
      queueStatus: syncService.getQueueStatus()
    }
  });
});

// Sync queue status endpoint (for debugging)
app.get("/sync/status", authenticateUser, (req, res) => {
  res.json({
    status: "ok",
    ...syncService.getQueueStatus()
  });
});

// Endpoint to manually clear queue (admin only)
app.post("/sync/clear-queue", authenticateUser, (req, res) => {
  const clearedCount = syncService.clearQueue();
  res.json({
    status: "ok",
    message: `Cleared ${clearedCount} items from sync queue`,
    clearedCount
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
