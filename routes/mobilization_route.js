const express = require("express");
const { 
    createMobilizationRequest, 
    getSupplierOwnMobilizations, 
    dropMobilizationRequest, 
    resubmitMobilizationDocuments 
} = require("../controllers/mobilization_controller");
const { authMiddleware } = require("../middleware/auth");

const Mobilizationroute = express.Router();

// 1. FRONTEND USER SUBCONTRACTOR VIEW ROUTE
Mobilizationroute.get("/portal", (req, res) => {
    res.render("supplier_portal"); // Renders your upcoming views/supplier_portal.ejs file
});

// 2. PROTECTED DATA API TRANSACTION PIPELINE ROUTING
Mobilizationroute.post("/submit-worker", authMiddleware, createMobilizationRequest);
Mobilizationroute.get("/my-submissions", authMiddleware, getSupplierOwnMobilizations);
Mobilizationroute.put("/drop-request/:id", authMiddleware, dropMobilizationRequest); // Supplier 'Drop / Cancel' Route hook
Mobilizationroute.put("/resubmit/:id", authMiddleware, resubmitMobilizationDocuments); // Dynamic document re-submission route

module.exports = { Mobilizationroute };
