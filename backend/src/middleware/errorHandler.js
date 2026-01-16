/**
 * Global error handling middleware
 */
module.exports = (err, req, res, next) => {
  console.error("🔴 Error:", err.message);

  // Validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.message
    });
  }

  // Cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
      code: "CAST_ERROR"
    });
  }

  // Duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      error: "Resource already exists",
      code: "DUPLICATE_KEY"
    });
  }

  // Default error
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
};
