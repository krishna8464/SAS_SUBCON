const express = require("express");
const { 
    getPendingMedicRequests,       // 🌟 INJECTED: Missing data stream lookup method
    evaluateMedicRequest,          // 🌟 INJECTED: Missing clinical review verdict method
    evaluateSiteComplianceDocs, 
    processHeadOfficeApproval, 
    allocateSiteAccommodation
} = require("../controllers/admin_review_controller");
const { pushToBlacklist } = require("../controllers/blacklist_controller");
const { authMiddleware } = require("../middleware/auth");

const AdminReviewRoute = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. FRONTEND WORKSPACE PAGE RENDERING VIEW ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 🩺 CLINICAL COMMAND DESK VIEW: Renders the views/medic_dashboard.ejs page template
AdminReviewRoute.get("/medic-deck", (req, res) => {
    res.render("medic_dashboard"); 
});

// 🛡️ SAFETY COMPLIANCE VIEW: Renders the upcoming views/hse_dashboard.ejs page template
AdminReviewRoute.get("/hse-deck", (req, res) => {
    res.render("hse_dashboard"); 
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. PROTECTED REST DATA API TRANSACTION ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET -> /admin-review/medic/pending (Streams active workforce data down to the clinic grid)
AdminReviewRoute.get("/medic/pending", authMiddleware, getPendingMedicRequests);

// POST -> /admin-review/medic/evaluate (Saves clinical assessment annotations and verdicts)
AdminReviewRoute.post("/medic/evaluate", authMiddleware, evaluateMedicRequest);

// TIER 2: Site HSE and WQT Team Clearance Decisions Pipeline (Changed to POST to safely match multi-part formats)
AdminReviewRoute.post("/review-docs", authMiddleware, evaluateSiteComplianceDocs);

// TIER 3: Head Office Final Authorization & Subcon ID Allocation 
AdminReviewRoute.put("/ho-clearance", authMiddleware, processHeadOfficeApproval);

// TIER 4: Site Admin Lodging Room Assignment & DOJ Schedule Sync
AdminReviewRoute.put("/site-allocation", authMiddleware, allocateSiteAccommodation);

// SECURITY CORE: Instantly Bar Workers & Auto-Cancel Queue Submissions
AdminReviewRoute.post("/blacklist-worker", authMiddleware, pushToBlacklist);


module.exports = { AdminReviewRoute };
