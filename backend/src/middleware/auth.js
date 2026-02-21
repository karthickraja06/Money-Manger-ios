/**
 * Authentication middleware
 * Extracts user_id from API key or JWT token (Phase 5)
 */

/**
 * Authenticate user via API key (Phase 1) or JWT (Phase 5)
 */
module.exports.authenticateUser = (req, res, next) => {
  // Phase 1: API key authentication
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "MISSING_API_KEY",
      message: "x-api-key header required"
    });
  }

  // For Phase 1, we use a simple mapping: user_id from a mapping
  // In Phase 5, this will be replaced with JWT validation
  const user_id = mapApiKeyToUserId(apiKey);

  if (!user_id) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "INVALID_API_KEY",
      message: "Invalid API key"
    });
  }

  // Attach user info to request
  req.user = {
    user_id,
    api_key: apiKey
  };

  next();
};

/**
 * Map API key to user_id
 * Phase 1: Simple environment variable check
 * Phase 5: Replace with database lookup or JWT decoding
 */
function mapApiKeyToUserId(apiKey) {
  // For Phase 1, API key format: "user:{user_id}:{key}"
  // Or use environment variable to store mapping

  // Example: if API_KEY=abc123xyz, map to "my_iphone"
  // In production, maintain a mapping table or use JWT

  if (apiKey === process.env.API_KEY) {
    // Use a default user_id for single-user setup
    return process.env.DEFAULT_USER_ID || "my_iphone";
  }

  // For multi-user Phase 5, lookup in database
  // return await ApiKey.findOne({ key: apiKey }).select("user_id");

  return null;
}

/**
 * Optional: Role-based access control (Phase 5)
 */
module.exports.authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Phase 5: Check user role against allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions"
      });
    }

    next();
  };
};

module.exports.mapApiKeyToUserId = mapApiKeyToUserId;
