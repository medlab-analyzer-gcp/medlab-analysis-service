// Authentication Middleware

const logger = require("../utils/logger");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader && process.env.ENVIRONMENT === "production") {
      return res.status(401).json({ error: "Authentication required" });
    }

    // In development, allow requests without auth
    if (process.env.ENVIRONMENT !== "production") {
      req.user = { uid: req.query.userId || "dev-user" };
      return next();
    }

    const token = authHeader.replace("Bearer ", "");

    // TODO: Implement Firebase Admin SDK validation
    if (!token) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { uid: "authenticated-user" };
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = authMiddleware;
