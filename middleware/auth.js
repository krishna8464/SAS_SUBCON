const jwt = require("jsonwebtoken");
const Token = require("../models/token");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

const sendAuthFailure = (req, res, statusCode, message) => {
  if (req.accepts("html") && req.path === "/portal" && req.baseUrl === "/mobilization") {
    res.clearCookie("token");
    res.clearCookie("role");
    return res.redirect("/user/login-page");
  }

  if (req.accepts("html")) {
    return res.status(statusCode).render("not_available", {
      message,
      redirectUrl: "/user/login-page"
    });
  }

  return res.status(statusCode).json({ message });
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;
    const queryToken = req.query?.token;
    const tokenFromHeader = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const token = tokenFromHeader || cookieToken || queryToken;

    if (!token) {
      return sendAuthFailure(req, res, 401, "This page is not available. Please log in again.");
    }

    const existingToken = await Token.findOne({ token, is_active: true });
    if (!existingToken) {
      return sendAuthFailure(req, res, 403, "Your session is no longer valid. Please log in again.");
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // 🌟 CRITICAL CORRECTION: MAP THE SUBCONTRACTOR SUPPLIER REFERENCING VALUES INTO CONTEXT
    req.user = {
      id: decoded.userid,
      userid: decoded.userid,
      name: decoded.name || "User",
      email: decoded.email || "",
      role: decoded.role,
      site_id: decoded.siteId,
      siteId: decoded.siteId,
      supplier_id: decoded.supplier_id || decoded.supplierId,
      supplierId: decoded.supplier_id || decoded.supplierId,
      cell_number: decoded.cell_number || ""
    };
    
    req.tokenInfo = existingToken;
    next();
  } catch (err) {
    return sendAuthFailure(req, res, 401, "This page is not available. Please log in again.");
  }
};

module.exports = { authMiddleware };
