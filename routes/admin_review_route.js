const express = require("express");
const { 
    getPendingMedicRequests,
    getPendingHseRequests,
    getHeadOfficeQueue,
    evaluateMedicRequest,
    evaluateSiteComplianceDocs, 
    processHeadOfficeApproval, 
    allocateSiteAccommodation
} = require("../controllers/admin_review_controller");
const { pushToBlacklist } = require("../controllers/blacklist_controller");
const { authMiddleware } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/role_access");

const AdminReviewRoute = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. FRONTEND WORKSPACE PAGE RENDERING VIEW ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 🩺 CLINICAL COMMAND DESK VIEW: Renders the views/medic_dashboard.ejs page template
AdminReviewRoute.get("/medic-deck", authMiddleware, authorizeRoles('SITE_MEDIC', 'SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), (req, res) => {
    res.render("medic_dashboard"); 
});

// 🛡️ SAFETY COMPLIANCE VIEW: Renders the upcoming views/hse_dashboard.ejs page template
AdminReviewRoute.get("/hse-deck", authMiddleware, authorizeRoles('SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), (req, res) => {
    res.render("medic_dashboard"); 
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. PROTECTED REST DATA API TRANSACTION ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET -> /admin-review/medic/pending (Streams active workforce data down to the clinic grid)
AdminReviewRoute.get("/medic/pending", authMiddleware, authorizeRoles('SITE_MEDIC', 'SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), getPendingMedicRequests);

// GET -> /admin-review/hse/pending (Streams HSE review queue separately so both teams can check in parallel)
AdminReviewRoute.get("/hse/pending", authMiddleware, authorizeRoles('SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), getPendingHseRequests);

// GET -> /admin-review/ho/queue (Shows all pending and completed applications for final HO approval)
AdminReviewRoute.get("/ho/queue", authMiddleware, authorizeRoles('HO', 'ERP_TEAM', 'DEVELOPER'), getHeadOfficeQueue);

// POST -> /admin-review/medic/evaluate (Saves clinical assessment annotations and verdicts)
AdminReviewRoute.post("/medic/evaluate", authMiddleware, authorizeRoles('SITE_MEDIC', 'HO', 'ERP_TEAM', 'DEVELOPER'), evaluateMedicRequest);

// POST -> /admin-review/hse/evaluate (Saves HSE review notes and approval/resubmit actions)
AdminReviewRoute.post("/hse/evaluate", authMiddleware, authorizeRoles('SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), evaluateSiteComplianceDocs);

// TIER 2: Site HSE and WQT Team Clearance Decisions Pipeline (Changed to POST to safely match multi-part formats)
AdminReviewRoute.post("/review-docs", authMiddleware, authorizeRoles('SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), evaluateSiteComplianceDocs);

// TIER 3: Head Office Final Authorization & Subcon ID Allocation 
AdminReviewRoute.put("/ho-clearance", authMiddleware, authorizeRoles('HO', 'ERP_TEAM', 'DEVELOPER'), processHeadOfficeApproval);

// TIER 4: Site Admin Lodging Room Assignment & DOJ Schedule Sync
AdminReviewRoute.put("/site-allocation", authMiddleware, authorizeRoles('SITE_MANAGER', 'HO', 'ERP_TEAM', 'DEVELOPER'), allocateSiteAccommodation);

// SECURITY CORE: Instantly Bar Workers & Auto-Cancel Queue Submissions
AdminReviewRoute.post("/blacklist-worker", authMiddleware, authorizeRoles('HO', 'ERP_TEAM', 'DEVELOPER'), pushToBlacklist);


module.exports = { AdminReviewRoute };
