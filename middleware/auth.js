const jwt = require("jsonwebtoken");
const Token = require("../models/token");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing or invalid" });
    }

    const token = authHeader.split(" ")[1];

    const existingToken = await Token.findOne({ token, is_active: true });
    if (!existingToken) {
      return res.status(403).json({ message: "Token is inactive or has been logged out. Please login again." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // 🌟 CRITICAL CORRECTION: MAP THE SUBCONTRACTOR SUPPLIER REFERENCING VALUES INTO CONTEXT
    req.user = {
      id: decoded.userid,
      userid: decoded.userid,
      role: decoded.role,
      site_id: decoded.siteId,
      siteId: decoded.siteId,
      supplier_id: decoded.supplier_id || decoded.supplierId, // Injects your company link property cleanly!
      supplierId: decoded.supplier_id || decoded.supplierId   // Injects duplicate protection mapping handles
    };
    
    req.tokenInfo = existingToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token", error: err.message });
  }
};

module.exports = { authMiddleware };
