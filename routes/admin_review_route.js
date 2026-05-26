const express = require("express");
const { 
    evaluateSiteComplianceDocs, 
    processHeadOfficeApproval, 
    allocateSiteAccommodation 
} = require("../controllers/admin_review_controller");
const { pushToBlacklist } = require("../controllers/blacklist_controller");
const { authMiddleware } = require("../middleware/auth");

const AdminReviewRoute = express.Router();

// TIER 2: Site Medic, HSE, and WQT Team Clearance Decisions Pipeline
AdminReviewRoute.put("/review-docs", authMiddleware, evaluateSiteComplianceDocs);

// TIER 3: Head Office Final Authorization & Subcon ID Allocation 
AdminReviewRoute.put("/ho-clearance", authMiddleware, processHeadOfficeApproval);

// TIER 4: Site Admin Lodging Room Assignment & DOJ Schedule Sync
AdminReviewRoute.put("/site-allocation", authMiddleware, allocateSiteAccommodation);

// SECURITY CORE: Instantly Bar Workers & Auto-Cancel Queue Submissions
AdminReviewRoute.post("/blacklist-worker", authMiddleware, pushToBlacklist);

module.exports = { AdminReviewRoute };
