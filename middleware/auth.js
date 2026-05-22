const jwt = require("jsonwebtoken");
const Token = require("../models/token"); // Imports your updated Token model
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract the token from the Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    // 2. Validate the session status against your active token whitelist in MongoDB
    const existingToken = await Token.findOne({ token, is_active: true });
    if (!existingToken) {
      return res.status(403).json({ message: "Token is inactive or has been logged out. Please login again." });
    }

    // 3. Cryptographically decode and verify the JWT signature integrity
    const decoded = jwt.verify(token, JWT_SECRET);

    // 4. Attach session identity fields directly to the request object for downstream routes
    req.user = {
      id: decoded.userid,
      role: decoded.role,
      site_id: decoded.siteId // Automatically attaches their assigned physical site ID string context
    };
    req.tokenInfo = existingToken;

    // 5. Pass execution seamlessly over to the target endpoint controller
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token", error: err.message });
  }
};

module.exports = { authMiddleware };