

==================================================
FILE: .\index.js
==================================================

const express = require("express");
const { connection } = require("./config/db");
const { Userroute } = require("./routes/user_route");
const { Siteroute } = require("./routes/sites_route");
const { Supplierroute } = require("./routes/suppliers_route");
const { Designationroute } = require("./routes/designation_route");
const { Mobilizationroute } = require("./routes/mobilization_route");
const { AdminReviewRoute } = require("./routes/admin_review_route");

require("dotenv").config();
const cors = require("cors");
const path = require("path");
const { logger } = require("./middleware/logger");
const { errorHandler } = require("./middleware/errorhandler"); // Keep import here

const app = express();
app.use(express.json());
// 🌟 FIXED: Removed errorHandler from this line slot right here!

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors({ origin : "*" }));

// Base Route Root
app.get("/", async(req, res) => {
    try { res.send("Welcome to the SAS Management"); } 
    catch (error) { res.send("something went wrong"); }
});

// Mounted Application Gateways API Modules
app.use("/user", Userroute);
app.use("/site", Siteroute);
app.use("/supplier", Supplierroute);
app.use("/designation", Designationroute);
app.use("/mobilization", Mobilizationroute);
app.use("/admin-review", AdminReviewRoute);

// Handle invalid routes
app.use(logger, (req, res) => {
    res.status(404).send({ error: 'Not found' });
});

// 🌟 FIXED: MOUNTED ERROR HANDLER HERE AT THE ABSOLUTE BOTTOM TO WORK CORRECTLY
app.use(errorHandler);

app.listen(process.env.port, async () => {
    try {
        await connection;
        console.log("server is connect to DB");
        console.log(`server is connected to ${process.env.port}`);
    } catch (error) {
        console.log(error);
        console.log("Not able to connect to DB");
    }
});


==================================================
FILE: .\package.json
==================================================

{
  "name": "sas_subcon",
  "version": "1.0.0",
  "description": "This application manages the document and dehire process init",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "nodemon index.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/krishna8464/SAS_SUBCON.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "bugs": {
    "url": "https://github.com/krishna8464/SAS_SUBCON/issues"
  },
  "homepage": "https://github.com/krishna8464/SAS_SUBCON#readme",
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "ejs": "^5.0.2",
    "exceljs": "^4.4.0",
    "express": "^5.2.1",
    "express-validator": "^7.3.2",
    "fs": "^0.0.1-security",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.6.2",
    "morgan": "^1.10.1",
    "multer": "^1.4.4",
    "multer-gridfs-storage": "^5.0.2",
    "nodemon": "^3.1.14",
    "path": "^0.12.7",
    "regex": "^6.1.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.3.0"
  }
}


==================================================
FILE: .\README.md
==================================================

# SAS_SUBCON
This application manages the document and dehire process init


==================================================
FILE: .\tailwind.config.js
==================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./views/**/*.ejs"
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }

==================================================
FILE: .\config\db.js
==================================================

const mongoose = require("mongoose");
require("dotenv").config();

const connection = mongoose.connect(process.env.Mongo_url);

let gfsBucket;

mongoose.connection.once("open", () => {
    // 🌟 INJECTS NATIVE GRIDFS STREAMING STORAGE BUCKET CHANNELS
    gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "workforce_docs" // Automatically creates workforce_docs.files and workforce_docs.chunks collections
    });
    console.log("GridFS local binary document storage bucket initialized successfully.");
});

// Function to safely access the global bucket instance across other controller files
const getGfsBucket = () => {
    if (!gfsBucket) throw new Error("Database Bucket has not been fully established yet.");
    return gfsBucket;
};

module.exports = { connection, getGfsBucket };

==================================================
FILE: .\controllers\admin_review_controller.js
==================================================

const MobilizationRequest = require("../models/mobilization_request");
const SubcontractorEmployee = require("../models/subcontractor_employee");
const mongoose = require("mongoose");
const { purgeWorkforceBinaryFiles } = require("../utils/document_purger"); // 🌟 Import your purger utility

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🟢 TIER 2: SITE REVIEW GATE (MEDIC, HSE, & WQT TEAMS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const evaluateSiteComplianceDocs = async (req, res) => {
    try {
        const { requestId, department, action, comment } = req.body; // department: "Medic"/"HSE"/"WQT_Team", action: "Approved"/"Rejected"/"Resubmit"

        if (!requestId || !department || !action) {
            return res.status(400).json({ message: "Request ID, Evaluator Department, and Decision Action are mandatory fields." });
        }

        const request = await MobilizationRequest.findById(requestId).populate("designation_id", "title");
        if (!request) return res.status(404).json({ message: "Mobilization request record not found." });
        if (request.status !== "Under Review") return res.status(400).json({ message: "This application file has already moved past the initial site review phase." });

        let logNotes = `${department} Evaluation logged: [${action}]. Comments: ${comment || 'None'}`;

        // 1. Process evaluation remarks based on the reviewing department channels
        if (department === "Medic") {
            request.medical_comment = comment || "Approved by Site Medic";
            if (action === "Resubmit") request.status = "Resubmit for Medic";
        } else if (department === "HSE") {
            request.hse_comment = comment || "Approved by Site HSE Unit";
            if (action === "Resubmit") request.status = "Resubmit for HSE";
        } else if (department === "WQT_Team") {
            request.wqt_comment = comment || "Approved by Welder Review Team";
            if (action === "Resubmit") request.status = "Resubmit for WQT";
        }

        // 2. Direct Rejection drops application completely across the system immediately
        if (action === "Rejected") {
            request.status = "Rejected";
            request.rejection_remarks = comment || `Application rejected during ${department} verification stage evaluation.`;
            request.submission_history.push({ action, by_user: req.user.id, timestamp: new Date().toISOString(), notes: `Application rejected by ${department} department review lines.` });
            await request.save();
            return res.status(200).json({ message: "Application marked as Rejected successfully.", request });
        }

        // 3. Process Approvals and verify gate milestones
        if (action === "Approved") {
            const isMedicReady = request.medical_comment.toLowerCase().includes("approved");
            const isHseReady = request.hse_comment.toLowerCase().includes("approved");
            
            // Specialized compliance check rule for structural Welder classifications
            const isWelderTrade = request.designation_id && request.designation_id.title.toLowerCase().includes("welder");
            const isWqtReady = !isWelderTrade || request.wqt_comment.toLowerCase().includes("approved");

            // 3-WAY GATE CHECK CONDITION FOR MOVEMENT TO TIER 3
            if (isMedicReady && isHseReady && isWqtReady) {
                request.status = "Pending HO Approval"; // Pushes clean up to Tier 3 Head Office!
                logNotes += " -> 3-Way Site Review Sequence Cleared: Advanced to Head Office Dashboard.";
            } else {
                logNotes += ` -> Review captured. Clearance matrix state: [Medic: ${isMedicReady}] [HSE: ${isHseReady}] [WQT (Welder Only): ${isWqtReady}]`;
            }
        }

        request.submission_history.push({ action, by_user: req.user.id, timestamp: new Date().toISOString(), notes: logNotes });
        await request.save();
        res.status(200).json({ message: `Review logged successfully. Current request status: ${request.status}`, request });
    } catch (error) { 
        res.status(500).json({ message: "Error compiling admin gate checklist evaluations", error: error.message }); 
    }
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🟢 TIER 3: HEAD OFFICE APPROVAL GATE (ASSIGN SUB_ID & CREATE PROFILE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const processHeadOfficeApproval = async (req, res) => {
    try {
        const { requestId, action, subcon_id, comment } = req.body; // action: "Approved" / "Rejected"

        if (!requestId || !action) {
            return res.status(400).json({ message: "Request ID and Decision Action parameters are mandatory entries." });
        }

        const request = await MobilizationRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: "Mobilization application record not found." });
        if (request.status !== "Pending HO Approval") return res.status(400).json({ message: "This application is not pending Head Office authorization tracks." });

        // Handle structural drop cascade from HO level execution buttons
        if (action === "Rejected") {
            request.status = "Rejected";
            request.rejection_remarks = comment || "Application package rejected by Head Office administration.";
            request.submission_history.push({ action: "HO Rejected", by_user: req.user.id, timestamp: new Date().toISOString(), notes: "Rejected at Head Office level dashboard." });
            await request.save();
            return res.status(200).json({ message: "Application rejected by Head Office successfully.", request });
        }

        if (!subcon_id) {
            return res.status(400).json({ message: "Subcon ID assignment allocation is required to execute Head Office clearance approvals." });
        }

        const cleanSubconId = subcon_id.trim().toUpperCase();

        // Check for unique index collisions on the Subcon ID tracking field before creating documents
        const subconIdCollision = await SubcontractorEmployee.findOne({ subcon_id: cleanSubconId });
        if (subconIdCollision) return res.status(400).json({ message: `Authorization Blocked! Subcon ID '${cleanSubconId}' is already active on another worker record.` });

        // Advance mobilization file to Tier 4 Site Admin
        request.status = "Pending Site Admin";

        // Deactivate older deployments mapping to this worker's Civil ID to keep location history clean
        await SubcontractorEmployee.updateMany(
            { civil_id: request.civil_id },
            { $set: { employment_status: "Inactive" } }
        );

        // AUTOMATION PIPELINE TRIGGER: Compile and create the live active profile document in subcontractor_employees
        const activeEmployeeProfile = new SubcontractorEmployee({
            subcon_id: cleanSubconId,
            mobilization_request_id: request._id,
            civil_id: request.civil_id,
            employee_name: request.employee_name,
            nationality: request.nationality,
            dob: request.dob.toISOString().split('T')[0],
            mobile_number: request.mobile_number,
            designation_id: request.designation_id,
            civil_expire: request.civil_expire.toISOString().split('T')[0],
            accommodation_type: request.accommodation_type,
            current_site_id: request.target_site_id,
            supplier_id: request.sub_company_id, // Links subcon ID straight to the supplier
            sponsor_company: request.sponsor_company,
            employment_status: "Pending Allocation", // Stays locked until lodging check-in completes in Tier 4
            final_hse_doc_url: request.hse_file_url,
            final_medic_doc_url: request.medical_file_url,
            history: [{ event_type: "Profile Provisioned", from_state: "N/A", to_state: "Pending Allocation", authorized_by: req.user.id, date: new Date().toISOString(), notes: `Head Office issued validation clearance. Assigned Subcon ID token: ${cleanSubconId}.` }]
        });

        await activeEmployeeProfile.save();
        
        request.submission_history.push({ action: "HO Approved", by_user: req.user.id, timestamp: new Date().toISOString(), notes: `Head Office clearance validation success. Injected Subcon ID: ${cleanSubconId}. Advanced packet to Site Admin layout.` });
        await request.save();

        res.status(200).json({ message: "Head Office approval complete! Profile provisioned and dispatched to local camp admin grids.", request });
    } catch (error) {
        res.status(500).json({ message: "Error processing Head Office clearance gate execution", error: error.message });
    }
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🟢 TIER 4: SITE ADMIN WORKSPACE CLOSURE (ROOM CHANNELS & DATES CHECK-IN)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const allocateSiteAccommodation = async (req, res) => {
    try {
        const { requestId, room_number, joining_date } = req.body;
        // ... find your existing validation gate and query checks ...

        const request = await MobilizationRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: "Mobilization request records not found." });

        // Capture target file URL anchors prior to making state changes
        const temporaryFormFiles = [request.medical_file_url, request.hse_file_url, request.wqt_file_url];

        request.status = "Approved";
        request.room_number = room_number.trim();
        request.joining_date = new Date(joining_date);
        await request.save();

        const employee = await SubcontractorEmployee.findOne({ mobilization_request_id: request._id });
        if (employee) {
            employee.employment_status = "Active";
            employee.room_number = room_number.trim();
            employee.joining_date = new Date(joining_date);
            employee.mobilized_at = new Date();
            await employee.save();
        }

        // 🌟 AUTOMATED SYSTEM LIFECYCLE DISK PURGE: 
        // Bypasses active personnel files but completely drops evaluation form assets to optimize storage space!
        await purgeWorkforceBinaryFiles(temporaryFormFiles);

        res.status(200).json({ message: "Site workspace allocation success! Evaluation files purged from disk cleanly.", request });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const getPendingMedicRequests = async (req, res) => {
    try {
        const reviewerRole = req.user.role;
        const siteContextId = req.user.site_id || req.user.siteId;

        const queryFilter = {
            // 🌟 RE-ENGINEERED: Pulls every request active under review so the frontend tabs can sort history instantly!
            status: { $in: ["Under Review", "Resubmit Required", "Pending HO Approval", "Pending Site Admin", "Approved"] }
        };

        if (reviewerRole !== "HO" && reviewerRole !== "DEVELOPER" && reviewerRole !== "ERP_TEAM", reviewerRole !== "SUPPLIER") {
            if (!siteContextId) return res.status(400).json({ message: "Access Denied! Missing Site ID allocation link." });
            queryFilter.target_site_id = new mongoose.Types.ObjectId(siteContextId);
        }

        const pendingQueue = await MobilizationRequest.find(queryFilter)
            .populate("designation_id", "title risk_level")
            .populate("target_site_id", "site_name location site_code")
            .populate("sub_company_id", "supplier_name registration_number")
            .sort({ urgency: -1, createdAt: -1 });

        res.status(200).json({ count: pendingQueue.length, requests: pendingQueue });
    } catch (error) {
        res.status(500).json({ message: "Error reading clinical queue", error: error.message });
    }
};

// 2. PROCESS CLINICAL VERDICT: UPDATE EXPLICIT MOVEMENT GATE ATTRIBUTES
const evaluateMedicRequest = async (req, res) => {
    try {
        const { requestId, decision, comments } = req.body;

        if (!requestId || !decision || !comments) {
            return res.status(400).json({ message: "Target Request ID tracking index, evaluation decision, and clinical review notes are mandatory." });
        }

        const targetRequest = await MobilizationRequest.findById(requestId);
        if (!targetRequest) {
            return res.status(404).json({ message: "Workforce mobilization tracking packet not found in system databases." });
        }

        // Prevent structural modifications if it already reached a finalized terminal state
        if (targetRequest.status === "Approved" || targetRequest.status === "Cancelled") {
            return res.status(400).json({ message: `Transaction Blocked! Packet is already in a terminal state (${targetRequest.status}).` });
        }

        // 🌟 THE UPGRADE ARCHITECTURE: Update fields based on explicit decision inputs
        if (decision === "Approved") {
            // Medical gate locks to Approved! Universal status stays "Under Review" so it populates the HSE safety queue natively
            targetRequest.medical_status = "Approved";
            targetRequest.medical_comment = `MEDICAL PASSED: ${comments.trim()}`;
            
            // Check if all other gates are also approved before advancing global lifecycle
            if (targetRequest.hse_status === "Approved" && (targetRequest.wqt_status === "Approved" || targetRequest.wqt_status === "Not Required")) {
                targetRequest.status = "Pending HO Approval";
            } else {
                targetRequest.status = "Under Review";
            }
        } else if (decision === "Resubmit for Medic") {
            // 🌟 ARCHITECTURAL FIX ALIGNED WITH YOUR ENUM:
            // 1. Mark the individual Medical gate field as "Resubmit"
            targetRequest.medical_status = "Resubmit";
            
            // 2. Keep the global status as "Under Review" so it perfectly matches your active schema enum options arrays!
            targetRequest.status = "Under Review"; 
            
            targetRequest.medical_comment = `MEDICAL REJECTED: ${comments.trim()}`;
        }

        // Log transaction snapshot inside historical tracking history array maps
        targetRequest.submission_history.push({
            action: decision,
            by_user: req.user.id || req.user.userid || "Site Clinic Console",
            timestamp: new Date().toISOString(),
            notes: `Medical tier evaluation logged: ${decision}. Notes: ${comments.trim()}`
        });

        await targetRequest.save();
        res.status(200).json({ message: "Clinical evaluation review verdict saved and logged successfully!", request: targetRequest });

    } catch (error) {
        console.error("FATAL ERROR IN MEDIC EVALUATION CONTROLLER:", error);
        res.status(500).json({ message: "Error compiling clinical evaluation transaction overrides", error: error.message });
    }
};


module.exports = { evaluateSiteComplianceDocs, processHeadOfficeApproval, allocateSiteAccommodation, getPendingMedicRequests, evaluateMedicRequest };


==================================================
FILE: .\controllers\blacklist_controller.js
==================================================

const Blacklist = require("../models/blacklist");
const MobilizationRequest = require("../models/mobilization_request");

// 1. ADD WORKER TO CORPORATE DEPLOYMENT BLACKLIST
const pushToBlacklist = async (req, res) => {
    try {
        const { civil_id, reason_for_blacklisting } = req.body;

        if (!civil_id || !reason_for_blacklisting) {
            return res.status(400).json({ message: "Worker Civil ID and explicit Reason are required parameters." });
        }

        const cleanId = civil_id.trim();
        const alreadyFlagged = await Blacklist.findOne({ civil_id: cleanId });
        if (alreadyFlagged) return res.status(400).json({ message: "This Civil ID indicator is already cataloged on the blacklist registry database." });

        const blockRecord = new Blacklist({
            civil_id: cleanId,
            reason_for_blacklisting: reason_for_blacklisting.trim(),
            blacklisted_by: req.user.id // Captured from safe user payload session tokens
        });

        await blockRecord.save();

        // CANCELLATION CASCADE: Instantly force-drop any active under-review applications for this worker
        await MobilizationRequest.updateMany(
            { civil_id: cleanId, status: "Under Review" },
            { 
                $set: { status: "Rejected" },
                $push: { 
                    submission_history: {
                        action: "Rejected",
                        by_user: req.user.id,
                        timestamp: new Date().toISOString(),
                        notes: `Application dropped instantly. Employee Civil ID blacklisted. Reason: ${reason_for_blacklisting}`
                    }
                }
            }
        );

        res.status(201).json({ message: "Worker permanently barred. Ongoing deployment packets dropped cleanly.", blockRecord });
    } catch (error) {
        res.status(500).json({ message: "Error compiling blocklist records indices data", error: error.message });
    }
};

module.exports = { pushToBlacklist };


==================================================
FILE: .\controllers\designation_controller.js
==================================================

const Designation = require("../models/designation"); // Adjust case to match your Designation model file name

// 1. CREATE A NEW JOB DESIGNATION TITLE
const createDesignation = async (req, res) => {
    try {
        const { title, risk_level } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Designation title is required." });
        }

        const trimmedTitle = title.trim();

        // CASE-INSENSITIVE CHECK: Ensures "Welder" and "welder" do not duplicate
        const existingDesignation = await Designation.findOne({
            title: { $regex: new RegExp(`^${trimmedTitle}$`, "i") }
        });

        if (existingDesignation) {
            return res.status(400).json({ message: `The designation '${trimmedTitle}' already exists.` });
        }

        const newDesignation = new Designation({
        title: trimmedTitle,
        risk_level: risk_level || "Low",
        status: req.body.status || "Active" // 🌟 FIXED HERE: Guarantees status field is populated
        });

        await newDesignation.save();
        res.status(201).json({ message: "Designation added successfully", designation: newDesignation });

    } catch (error) {
        res.status(500).json({ message: "Error creating designation", error: error.message });
    }
};

// 2. GET ALL DESIGNATIONS (Sorted Alphabetically for Form Selection Lists)
const getAllDesignations = async (req, res) => {
    try {
        const designations = await Designation.find().sort({ title: 1 });
        res.status(200).json({ count: designations.length, designations });
    } catch (error) {
        res.status(500).json({ message: "Error fetching designations", error: error.message });
    }
};

// 3. GET SINGLE DESIGNATION BY UNIQUE OBJECT ID
const getDesignationById = async (req, res) => {
    try {
        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ message: "Designation role not found." });
        }
        res.status(200).json(designation);
    } catch (error) {
        res.status(500).json({ message: "Error fetching designation profile", error: error.message });
    }
};

// 4. UPDATE DESIGNATION DETAILS
const updateDesignation = async (req, res) => {
    try {
        const { title, risk_level } = req.body;
        const currentId = req.params.id;
        const updateFields = {};

        if (title) {
            const cleanTitle = title.trim();
            const titleCollision = await Designation.findOne({
                title: { $regex: new RegExp(`^${cleanTitle}$`, "i") },
                _id: { $ne: currentId }
            });
            if (titleCollision) {
                return res.status(400).json({ message: "This job title already matches an existing designation." });
            }
            updateFields.title = cleanTitle;
        }

        if (risk_level) updateFields.risk_level = risk_level;

        const updatedDesignation = await Designation.findByIdAndUpdate(
            currentId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedDesignation) {
            return res.status(404).json({ message: "Designation update failed or record not found." });
        }

        res.status(200).json({ message: "Designation updated cleanly", designation: updatedDesignation });

    } catch (error) {
        res.status(500).json({ message: "Error updating designation details", error: error.message });
    }
};

// 5. DELETE DESIGNATION
const deleteDesignation = async (req, res) => {
    try {
        // 1. Fetch the target job designation profile to check its current database state value
        const targetDesignation = await Designation.findById(req.params.id);
        if (!targetDesignation) {
            return res.status(404).json({ message: "Job designation records not found." });
        }

        // 2. Compute the exact opposite state value toggle parameter dynamically
        const nextStatusState = targetDesignation.status === "Active" ? "Inactive" : "Active";

        // 3. Execute the single-run modification swap block using the returnDocument 'after' standard
        const toggledDesignation = await Designation.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the fresh updated state values instantly
        );

        res.status(200).json({ 
            message: `Designation successfully toggled to ${nextStatusState} status.`, 
            designation: toggledDesignation 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing designation status parameter", error: error.message });
    }
};
module.exports = {
    createDesignation,
    getAllDesignations,
    getDesignationById,
    updateDesignation,
    deleteDesignation
};


==================================================
FILE: .\controllers\mobilization_controller.js
==================================================

const { purgeWorkforceBinaryFiles } = require("../utils/document_purger"); // 🌟 CRITICAL FIX: Links your background cleanup function!
const MobilizationRequest = require("../models/mobilization_request");
const Designation = require("../models/designation");
const Blacklist = require("../models/blacklist");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");


const createMobilizationRequest = async (req, res) => {
    const temporaryFilesToCleanup = [];

    try {
        const { 
            civil_id, employee_name, nationality, dob, mobile_number, 
            designation_id, civil_expire, accommodation_type, target_site_id, 
            sponsor_company, urgency 
        } = req.body;

        const sub_company_id = 
            req.user.supplier_id || 
            req.user.supplierId || 
            req.user.sub_company_id || 
            req.user.id || 
            req.user.userid; 

        if (!sub_company_id) {
            return res.status(401).json({ message: "Authorization Blocked! Session missing supplier link." });
        }

        if (!civil_id || !employee_name || !nationality || !dob || !mobile_number || !designation_id || !civil_expire || !accommodation_type || !target_site_id || !sponsor_company) {
            return res.status(400).json({ message: "All required fields are mandatory." });
        }

        // 🌟 SAFETY GUARD A: Ensure req.files handles are populated by Multer fields middleware
        if (!req.files || !req.files.medical_file || !req.files.hse_file) {
            return res.status(400).json({ message: "Upload Blocked! You must attach physical Medical and HSE PDF documents." });
        }

        // Initialize the native official GridFS Bucket instance seamlessly
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });

        // HELPER SUB-ENGINE: Extracts file path from first element of array before streaming data chunks
        const streamFileToGridFS = (fileArrayWrapper) => {
            return new Promise((resolve, reject) => {
                // 🌟 CRITICAL RE-ALIGNMENT: Extract the 1st individual file object from Multer's fields array!
                const fileObject = Array.isArray(fileArrayWrapper) ? fileArrayWrapper[0] : fileArrayWrapper;
                
                if (!fileObject || !fileObject.path) {
                    return reject(new Error("File structural extraction mismatch! Binary upload target is undefined."));
                }

                temporaryFilesToCleanup.push(fileObject.path);
                
                const uploadStream = bucket.openUploadStream(`${Date.now()}-${fileObject.filename}`, {
                    contentType: fileObject.mimetype
                });

                fs.createReadStream(fileObject.path)
                    .pipe(uploadStream)
                    .on("error", (err) => reject(err))
                    .on("finish", () => resolve(`/mobilization/file/${uploadStream.id}`));
            });
        };

        // 🌟 FIXED STREAM DISPATCH: Send the fields arrays directly to the revised destructuring handler
        const medical_file_url = await streamFileToGridFS(req.files.medical_file);
        const hse_file_url = await streamFileToGridFS(req.files.hse_file);

        // Fetch selected trade classification data to evaluate welder requirements
        const tradeProfile = await Designation.findById(designation_id);
        const isWelderTrade = tradeProfile && tradeProfile.title.toLowerCase().includes("welder");
        
        let assignedWqtComment = "Not Required for this Trade";
        let assignedWqtStatus = "Not Required";
        let verifiedWqtUrl = "";

        if (isWelderTrade) {
            if (!req.files.wqt_file) {
                throw new Error("Compliance Verification Blocked! Welder trade designations require a valid physical WQT card PDF upload.");
            }
            verifiedWqtUrl = await streamFileToGridFS(req.files.wqt_file);
            assignedWqtComment = "Pending Welder Review Team Evaluation";
            assignedWqtStatus = "Pending";
        }

        const cleanCivilId = civil_id.trim();
        const isBlacklisted = await Blacklist.findOne({ civil_id: cleanCivilId });
        if (isBlacklisted) {
            return res.status(403).json({ message: `Deployment Blocked! Employee is blacklisted.` });
        }

        const activeQueueCheck = await MobilizationRequest.findOne({ 
            civil_id: cleanCivilId, 
            status: { $in: ["Under Review", "Resubmit Required"] } 
        });
        
        if (activeQueueCheck) {
            return res.status(400).json({ message: "Duplicate registration! An active package for this worker already exists in queue." });
        }

        const initialLogEntry = {
            action: "Submitted",
            by_user: req.user.userid || req.user.id || "Supplier Portal",
            timestamp: new Date().toISOString(),
            notes: `Initial package cataloged with physical documents.`
        };

        const newRequest = new MobilizationRequest({
            civil_id: cleanCivilId,
            employee_name: employee_name.trim(),
            nationality: nationality.trim(),
            dob: new Date(dob),
            mobile_number: mobile_number.trim(),
            designation_id: new mongoose.Types.ObjectId(designation_id),
            target_site_id: new mongoose.Types.ObjectId(target_site_id),
            sub_company_id: new mongoose.Types.ObjectId(sub_company_id), 
            civil_expire: new Date(civil_expire),
            accommodation_type,
            sponsor_company: sponsor_company.trim(),
            medical_file_url, 
            hse_file_url,     
            wqt_file_url: verifiedWqtUrl, 
            wqt_comment: assignedWqtComment,
            medical_status: "Pending",
            hse_status: "Pending",
            wqt_status: assignedWqtStatus,
            status: "Under Review", 
            urgency: urgency || "Normal", 
            submission_history: [initialLogEntry]
        });

        await newRequest.save();

        temporaryFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        res.status(201).json({ message: "Workforce mobilization request registered successfully!", request: newRequest });

    } catch (error) {
        temporaryFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        console.error("CRITICAL PACKET DISPATCH FAILURE LOG:", error);
        res.status(500).json({ message: "Error compiling mobilization record", error: error.message });
    }
};

// 2. FETCH HISTORICAL MOBILIZATION LOGS FOR THE SPECIFIC LOGGED SUPPLIER ONLY
const getSupplierOwnMobilizations = async (req, res) => {
    try {
        console.log("Decoding authorization request token content details inside session tracking...", req.user);

        // 🌟 CRITICAL CORRECTION: Traps all possible casing variations sent by your authMiddleware
        const companyId = 
            req.user.supplier_id || 
            req.user.supplierId || 
            req.user.sub_company_id || 
            req.user.id || 
            req.user.userid;

        if (!companyId) {
            return res.status(400).json({ 
                message: "Access Denied! Subcontractor supplier context identification key missing from your authorization session payload parameters." 
            });
        }

        // Pull collection profiles and populate textual labels dynamically from database
        const history = await MobilizationRequest.find({ sub_company_id: companyId })
            .populate("designation_id", "title risk_level")
            .populate("target_site_id", "site_name location")
            .sort({ createdAt: -1 });

        res.status(200).json({ count: history.length, requests: history });
    } catch (error) {
        res.status(500).json({ message: "Error syncing workforce mobilization logs", error: error.message });
    }
};

// 3. SUBCONTRACTOR SUPPLIER SYSTEM DROP / WITHDRAW FUNCTIONALITY
const dropMobilizationRequest = async (req, res) => {
    try {
        const currentId = req.params.id;

        // Locates application data, verifying it explicitly belongs to the requesting logged supplier tenant bounds
        const request = await MobilizationRequest.findOne({ 
            _id: currentId, 
            sub_company_id: req.user.supplier_id || req.user.supplierId 
        });

        if (!request) {
            return res.status(404).json({ message: "Mobilization application profile tracking packet not found or access unauthorized." });
        }

        // Only allow withdrawing if the request is strictly in a review/correction state!
        const irreversibleStates = ["approved", "pending ho approval", "pending site admin", "rejected", "cancelled"];
        const normalizedStatus = (request.status || "").toLowerCase().trim();

        if (irreversibleStates.includes(normalizedStatus)) {
            return res.status(400).json({ 
                message: `Drop action rejected! This worker application packet has already advanced downstream (Current Status: ${request.status}) and can no longer be withdrawn.` 
            });
        }

        // 🌟 CRITICAL FIX: Bulletproof file string verification to handle any null/undefined fields safely!
        const filesToPurge = [];
        
        if (request.medical_file_url && typeof request.medical_file_url === 'string' && request.medical_file_url.includes("/")) {
            filesToPurge.push(request.medical_file_url);
        }
        if (request.hse_file_url && typeof request.hse_file_url === 'string' && request.hse_file_url.includes("/")) {
            filesToPurge.push(request.hse_file_url);
        }
        if (request.wqt_file_url && typeof request.wqt_file_url === 'string' && request.wqt_file_url.includes("/")) {
            filesToPurge.push(request.wqt_file_url);
        }

        request.status = "Cancelled";
        request.submission_history.push({
            action: "Cancelled",
            by_user: req.user.id || "Supplier Portal",
            timestamp: new Date().toISOString(),
            notes: "Subcontractor manager successfully withdrew application package files cleanly."
        });

        await request.save();

        // AUTOMATED CASCADE ACTION: Wipes files safely with zero unhandled crash variables
        await purgeWorkforceBinaryFiles(filesToPurge);

        res.status(200).json({ message: "Application package successfully withdrawn and cancelled.", request });

    } catch (error) {
        // 🌟 CRITICAL DEBUGGER OVERRIDE: 
        // This will print the exact operational crash logs natively inside your console terminal
        console.log("================== CRITICAL DROP CRASH ==================");
        console.error(error);
        console.log("=======================================================");

        // This transmits the real inner stack trace code directly to your browser popup alert box
        res.status(500).json({ 
            message: `Backend Crash Diagnostic: ${error.message}`, 
            stack: error.stack 
        });
    }
};
// 4. UNIFIED COMPLIANCE RE-SUBMISSION ENGINE (Handles Both, Medic only, HSE only, or WQT changes dynamically)
const resubmitMobilizationDocuments = async (req, res) => {
    try {
        const { medical_file_url, hse_file_url, wqt_file_url } = req.body;
        const currentId = req.params.id;

        const request = await MobilizationRequest.findOne({ _id: currentId, sub_company_id: req.user.supplier_id });
        if (!request) return res.status(404).json({ message: "Mobilization worker file parameters not found or access unauthorized." });

        const updateFields = { status: "Under Review" }; // Re-inject document straight back into initial site reviewers queue
        let notesText = "Amended compliance documentation package uploaded by subcontractor: ";

        // SCENARIO WORKFLOW PATH A: Re-submit corrections for BOTH Medic and HSE issues
        if (request.status === "Resubmit for Both") {
            if (!medical_file_url || !hse_file_url) {
                return res.status(400).json({ message: "Both updated Medical certificate and HSE compliance document files are required to complete re-submission." });
            }
            updateFields.medical_file_url = medical_file_url;
            updateFields.medical_comment = "Amended File Uploaded - Pending Re-evaluation";
            updateFields.hse_file_url = hse_file_url;
            updateFields.hse_comment = "Amended File Uploaded - Pending Re-evaluation";
            notesText += "[Both Medical & HSE Files Re-uploaded]";
        }
        // SCENARIO WORKFLOW PATH B: Re-submit corrections for Medical certificates issues only
        else if (request.status === "Resubmit for Medic") {
            if (!medical_file_url) return res.status(400).json({ message: "Updated Medical certificate file attachment is mandatory to execute re-submission parameters." });
            updateFields.medical_file_url = medical_file_url;
            updateFields.medical_comment = "Amended File Uploaded - Pending Re-evaluation";
            notesText += "[Medical Certificate File Re-uploaded]";
        }
        // SCENARIO WORKFLOW PATH C: Re-submit corrections for Safety HSE certificates issues only
        else if (request.status === "Resubmit for HSE") {
            if (!hse_file_url) return res.status(400).json({ message: "Updated HSE safety compliance file attachment is mandatory to execute re-submission parameters." });
            updateFields.hse_file_url = hse_file_url;
            updateFields.hse_comment = "Amended File Uploaded - Pending Re-evaluation";
            notesText += "[HSE Safety Document File Re-uploaded]";
        }
        // SCENARIO WORKFLOW PATH D: Re-submit corrections for Welder specialized WQT card issues only
        else if (request.status === "Resubmit for WQT") {
            if (!wqt_file_url) return res.status(400).json({ message: "Updated Welder Qualification Test (WQT) card file attachment is mandatory to execute welder re-submission parameters." });
            updateFields.wqt_file_url = wqt_file_url;
            updateFields.wqt_comment = "Amended WQT Card Uploaded - Pending Re-evaluation";
            notesText += "[Welder WQT Certification Card Re-uploaded]";
        }

        const updatedHistory = [...request.submission_history, {
            action: "Resubmitted",
            by_user: req.user.id || "Supplier Portal",
            timestamp: new Date().toISOString(),
            notes: notesText
        }];
        updateFields.submission_history = updatedHistory;

        const updatedRequest = await MobilizationRequest.findByIdAndUpdate(
            currentId,
            { $set: updateFields },
            { new: true }
        );

        res.status(200).json({ message: "Application package successfully returned to evaluation review queue tracks!", request: updatedRequest });
    } catch (error) {
        res.status(500).json({ message: "Error processing document amendment re-submission loop actions", error: error.message });
    }
};

const getRequestDetailedContext = async (req, res) => {
    try {
        const targetId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: "Invalid request tracking reference key format." });
        }

        const requestDoc = await MobilizationRequest.findById(targetId)
            .populate("designation_id", "title risk_level description")
            .populate("target_site_id", "site_name location site_code manager_name contact_number")
            .populate("sub_company_id", "supplier_name registration_number contact_person cell_number");
            
        // 🌟 ARCHITECTURAL UPGRADE: If by_user matches an ID string format, 
        // manually query the User collection right here to fetch their real profile name string cleanly!
        if (requestDoc && requestDoc.submission_history) {
            const User = require("../models/user"); // Local model context binding
            
            for (let log of requestDoc.submission_history) {
                // If by_user is a valid 24-character hex ObjectId layout handle string
                if (log.by_user && mongoose.Types.ObjectId.isValid(log.by_user.toString())) {
                    const userProfileRow = await User.findById(log.by_user).select("name role");
                    if (userProfileRow) {
                        // Hydrate the string parameter into a rich metadata object template array structure
                        log.by_user = {
                            name: userProfileRow.name,
                            role: userProfileRow.role
                        };
                    }
                }
            }
        }

        if (!requestDoc) {
            return res.status(404).json({ message: "Requested worker deployment profile pack not found." });
        }

        res.status(200).json({ request: requestDoc });
    } catch (error) {
        res.status(500).json({ message: "Error compiling expanded record parameters", error: error.message });
    }
};

// 🌟 BACKEND CONTROLLER: OVERWRITES THE STALE FILE CHUNKS AND RESETS TARGET GATE PRIVILEGES TO PENDING
const resubmitWorkerDocumentCorrection = async (req, res) => {
    try {
        const targetId = req.params.id;
        const { targetField } = req.body; // Tells us whether it's 'medical_file', 'hse_file', or 'wqt_file'

        const targetRequest = await MobilizationRequest.findById(targetId);
        if (!targetRequest) return res.status(404).json({ message: "Record index target not found." });

        // Handle file mapping from Multer fields parsing middleware layout layers
        let uploadedFileObject = null;
        if (req.files && req.files.correction_file) uploadedFileObject = req.files.correction_file[0];
        else if (req.files && req.files.medical_file) uploadedFileObject = req.files.medical_file[0];
        else if (req.files && req.files.hse_file) uploadedFileObject = req.files.hse_file[0];
        else if (req.files && req.files.wqt_file) uploadedFileObject = req.files.wqt_file[0];

        if (!uploadedFileObject) return res.status(400).json({ message: "Resubmission blocked! No valid physical PDF attachment received." });

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "workforce_docs" });

        const uploadStream = bucket.openUploadStream(`${Date.now()}-CORRECTION-${uploadedFileObject.filename}`, {
            contentType: uploadedFileObject.mimetype
        });

        fs.createReadStream(uploadedFileObject.path)
            .pipe(uploadStream)
            .on("finish", async () => {
                const freshHostedUrl = `/mobilization/file/${uploadStream.id}`;

                // Clean up temporary disk buffers artifact
                if (fs.existsSync(uploadedFileObject.path)) fs.unlinkSync(uploadedFileObject.path);

                // 🌟 UPGRADE SYNC: Update file URL paths strings and flip respective statuses back to Pending!
                if (targetField === 'medical_file') {
                    targetRequest.medical_file_url = freshHostedUrl;
                    targetRequest.medical_status = "Pending";
                    targetRequest.medical_comment = "Fresh correction document uploaded by contractor.";
                } else if (targetField === 'hse_file') {
                    targetRequest.hse_file_url = freshHostedUrl;
                    targetRequest.hse_status = "Pending";
                    targetRequest.hse_comment = "Fresh correction document uploaded by contractor.";
                } else if (targetField === 'wqt_file') {
                    targetRequest.wqt_file_url = freshHostedUrl;
                    targetRequest.wqt_status = "Pending";
                    targetRequest.wqt_comment = "Fresh correction document uploaded by contractor.";
                }

                targetRequest.status = "Under Review"; // Return back into evaluation queues lines
                targetRequest.submission_history.push({
                    action: "Resubmitted",
                    by_user: req.user.id || "Supplier Portal",
                    timestamp: new Date().toISOString(),
                    notes: `Resubmitted fresh correction document file for gate path channel: ${targetField.toUpperCase()}`
                });

                await targetRequest.save();
                return res.status(200).json({ message: "Success!", request: targetRequest });
            });

    } catch (error) {
        res.status(500).json({ message: "Error running correction transmittals", error: error.message });
    }
};


module.exports = { 
    createMobilizationRequest, 
    getSupplierOwnMobilizations, 
    dropMobilizationRequest, 
    resubmitMobilizationDocuments,
    getRequestDetailedContext,
    resubmitWorkerDocumentCorrection
};


==================================================
FILE: .\controllers\sites_controller.js
==================================================

const Site = require("../models/sites"); // Ensure this path matches your file structure exactly

// 1. CREATE A NEW PHYSICAL OPERATIONAL SITE (With Site Code & Case-Insensitive Checks)
const createSite = async (req, res) => {
    try {
        const { site_code, site_name, location, status } = req.body;

        // Basic validation check
        if (!site_code || !site_name || !location) {
            return res.status(400).json({ message: "Site Code, Site Name, and Location are all required." });
        }

        const trimmedCode = site_code.trim().toUpperCase();
        const trimmedName = site_name.trim();

        // Check A: Verify if the short Site Code already exists
        const existingCode = await Site.findOne({ site_code: trimmedCode });
        if (existingCode) {
            return res.status(400).json({ message: `Site Code '${trimmedCode}' is already taken.` });
        }

        // Check B: Case-insensitive verify for the full descriptive Site Name
        const existingName = await Site.findOne({ 
            site_name: { $regex: new RegExp(`^${trimmedName}$`, "i") } 
        });
        if (existingName) {
            return res.status(400).json({ message: `A site with the name '${trimmedName}' already exists.` });
        }

        // Build and save the clean record
        const newSite = new Site({
            site_code: trimmedCode,
            site_name: trimmedName,
            location: location.trim(),
            status: status || "Active"
        });

        await newSite.save();
        res.status(201).json({ message: "Site registered successfully", site: newSite });

    } catch (error) {
        res.status(500).json({ message: "Error creating site", error: error.message });
    }
};

// 2. GET ALL SITES (Sorted Alphabetically by Site Code)
const getAllSites = async (req, res) => {
    try {
        const sites = await Site.find().sort({ site_code: 1 });
        res.status(200).json({ count: sites.length, sites });
    } catch (error) {
        res.status(500).json({ message: "Error fetching sites", error: error.message });
    }
};

// 3. GET A SINGLE SITE BY ID
const getSiteById = async (req, res) => {
    try {
        const site = await Site.findById(req.params.id);
        if (!site) {
            return res.status(404).json({ message: "Site not found" });
        }
        res.status(200).json(site);
    } catch (error) {
        res.status(500).json({ message: "Error fetching site details", error: error.message });
    }
};

// 4. UPDATE SITE DETAILS (With Code and Name Collision Check Protection)
const updateSite = async (req, res) => {
    try {
        const { site_code, site_name, location, status } = req.body;
        const currentSiteId = req.params.id;

        // Object to hold fields that need to be updated
        const updateFields = {};

        // If site code is being updated, verify it is unique across other entries
        if (site_code) {
            const cleanCode = site_code.trim().toUpperCase();
            const codeCollision = await Site.findOne({ site_code: cleanCode, _id: { $ne: currentSiteId } });
            if (codeCollision) {
                return res.status(400).json({ message: `Site Code '${cleanCode}' is already used by another site.` });
            }
            updateFields.site_code = cleanCode;
        }

        // If site name is being updated, run case-insensitive collision checks
        if (site_name) {
            const cleanName = site_name.trim();
            const nameCollision = await Site.findOne({ 
                site_name: { $regex: new RegExp(`^${cleanName}$`, "i") }, 
                _id: { $ne: currentSiteId } 
            });
            if (nameCollision) {
                return res.status(400).json({ message: `Site name '${cleanName}' is already used by another site.` });
            }
            updateFields.site_name = cleanName;
        }

        if (location) updateFields.location = location.trim();
        if (status) updateFields.status = status;

        const updatedSite = await Site.findByIdAndUpdate(
            currentSiteId,
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true } // Modified here
        );

        if (!updatedSite) {
            return res.status(404).json({ message: "Site not found or update failed" });
        }

        res.status(200).json({ message: "Site updated successfully", site: updatedSite });

    } catch (error) {
        res.status(500).json({ message: "Error updating site details", error: error.message });
    }
};

// 5. SOFT-DELETE SITE (Toggles status to Inactive to preserve audit integrity)
// 5. INTELLIGENT TOGGLE SITE STATUS (Fixed Double-Click Toggle Bug)
const deleteSite = async (req, res) => {
    try {
        // 1. Fetch the target site profile first to assess its current state value
        const targetSite = await Site.findById(req.params.id);
        if (!targetSite) {
            return res.status(404).json({ message: "Operational site profile not found." });
        }

        // 2. Compute the exact opposite binary state value toggle parameter
        const nextStatusState = targetSite.status === "Active" ? "Inactive" : "Active";

        // 3. Execute the single-run modification swap block using the new returnDocument standard
        const toggledSite = await Site.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the brand new updated document state variables instantly
        );

        res.status(200).json({ 
            message: `Site successfully flipped to ${nextStatusState} status.`, 
            site: toggledSite 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing site operational indicator state", error: error.message });
    }
};


module.exports = {
    createSite,
    getAllSites,
    getSiteById,
    updateSite,
    deleteSite
};


==================================================
FILE: .\controllers\suppliers_controller.js
==================================================

const Supplier = require("../models/supplier"); // Ensure this matches your file casing exactly

// 1. REGISTER A NEW SUBCONTRACTOR COMPANY
const createSupplier = async (req, res) => {
    try {
        const { supplier_name, cr_number, contact_email, contact_phone, status } = req.body;

        // Validation: Verify all required data fields are supplied
        if (!supplier_name || !cr_number || !contact_email || !contact_phone) {
            return res.status(400).json({ message: "Supplier Name, CR Number, Email, and Phone number are all required." });
        }

        const trimmedCR = cr_number.trim();
        const trimmedName = supplier_name.trim();

        // Check A: Verify Oman Commercial Registration (CR) Number is absolutely unique
        const existingCR = await Supplier.findOne({ cr_number: trimmedCR });
        if (existingCR) {
            return res.status(400).json({ message: `A company with CR Number '${trimmedCR}' is already registered.` });
        }

        // Check B: Case-insensitive check to prevent duplicate Company Name strings
        const existingName = await Supplier.findOne({
            supplier_name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
        });
        if (existingName) {
            return res.status(400).json({ message: `A supplier named '${trimmedName}' already exists in the system.` });
        }

        // Build and save the clean record
        const newSupplier = new Supplier({
            supplier_name: trimmedName,
            cr_number: trimmedCR,
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone: contact_phone.trim(), 
            status: status || "Active"
        });

        await newSupplier.save();
        res.status(201).json({ message: "Supplier registered successfully", supplier: newSupplier });

    } catch (error) {
        res.status(500).json({ message: "Error registering supplier", error: error.message });
    }
};

// 2. FETCH ALL REGISTERED SUPPLIERS (Sorted Alphabetically by Company Name)
const getAllSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ supplier_name: 1 });
        res.status(200).json({ count: suppliers.length, suppliers });
    } catch (error) {
        res.status(500).json({ message: "Error fetching suppliers", error: error.message });
    }
};

// 3. GET A SINGLE SUPPLIER BY UNIQUE OBJECT ID
const getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: "Supplier company records not found." });
        }
        res.status(200).json(supplier);
    } catch (error) {
        res.status(500).json({ message: "Error fetching supplier profile", error: error.message });
    }
};

// 4. UPDATE SUPPLIER PROFILES (With Safety Collision Checks)
const updateSupplier = async (req, res) => {
    try {
        const { supplier_name, cr_number, contact_email, contact_phone, status } = req.body;
        const currentId = req.params.id;
        const updateFields = {};

        // If CR number is being modified, ensure it doesn't collide with another company record
        if (cr_number) {
            const cleanCR = cr_number.trim();
            const crCollision = await Supplier.findOne({ cr_number: cleanCR, _id: { $ne: currentId } });
            if (crCollision) {
                return res.status(400).json({ message: "This CR number is already registered to another subcontractor." });
            }
            updateFields.cr_number = cleanCR;
        }

        // If Company Name is modified, perform a case-insensitive validation guard check
        if (supplier_name) {
            const cleanName = supplier_name.trim();
            const nameCollision = await Supplier.findOne({
                supplier_name: { $regex: new RegExp(`^${cleanName}$`, "i") },
                _id: { $ne: currentId }
            });
            if (nameCollision) {
                return res.status(400).json({ message: "This subcontractor company name already exists under another profile." });
            }
            updateFields.supplier_name = cleanName;
        }

        // Process other simple properties safely
        if (contact_email) updateFields.contact_email = contact_email.trim().toLowerCase();
        if (contact_phone) updateFields.contact_phone = contact_phone.trim();
        if (status) updateFields.status = status;

        const updatedSupplier = await Supplier.findByIdAndUpdate(
            currentId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedSupplier) {
            return res.status(404).json({ message: "Supplier profile update failed or record not found." });
        }

        res.status(200).json({ message: "Supplier details updated cleanly", supplier: updatedSupplier });

    } catch (error) {
        res.status(500).json({ message: "Error updating supplier profile", error: error.message });
    }
};

// 5. SUSPEND / DEACTIVATE SUPPLIER (Soft Delete)
// 5. INTELLIGENT BINARY STATUS TOGGLE ENGINE (Fixed Activation Loop Bug)
const deleteSupplier = async (req, res) => {
    try {
        // 1. Fetch the target subcontractor profile to check its current database state
        const targetSupplier = await Supplier.findById(req.params.id);
        if (!targetSupplier) {
            return res.status(404).json({ message: "Supplier company records not found." });
        }

        // 2. Compute the exact opposite state dynamically
        const nextStatusState = targetSupplier.status === "Active" ? "Inactive" : "Active";

        // 3. Update the record with the dynamic value using returnDocument: 'after'
        const toggledSupplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the fresh updated values instantly
        );

        res.status(200).json({ 
            message: `Supplier successfully set to ${nextStatusState} status.`, 
            supplier: toggledSupplier 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing supplier status parameter", error: error.message });
    }
};


module.exports = {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
};


==================================================
FILE: .\controllers\user_controller.js
==================================================

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Token = require("../models/token");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

// 1. WELCOME BASE ROUTE
const welcometouser = async (req, res) => {
    try {
        res.status(200).json({ message: "Welcome to user routes" });
    } catch (error) {
        res.status(500).json({ message: "Welcome route not working", error: error.message });
    }
};

// 2. CREATE OPERATION: DISPATCH NEW USER PROFILE PACKET
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, site_id, supplier_id, cell_number } = req.body;

        if (!name || !email || !password || !role || !cell_number) {
            return res.status(400).json({ message: "All profile metadata attributes fields are mandatory." });
        }

        const emailClean = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: emailClean });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        // Handle structural payload parameters conversions cleanly based on selected job roles
        let cleanSiteId = (site_id === "" || !site_id) ? null : new mongoose.Types.ObjectId(site_id.trim());
        let cleanSupplierId = (supplier_id === "" || !supplier_id) ? null : new mongoose.Types.ObjectId(supplier_id.trim());

        if (['HO', 'ERP_TEAM', 'DEVELOPER'].includes(role)) {
            cleanSiteId = null;
            cleanSupplierId = null;
        } else if (role === 'SUPPLIER') {
            if (!cleanSupplierId) return res.status(400).json({ message: "Validation Blocked! SUPPLIER roles require linking a Supplier Company ID." });
            cleanSiteId = null;
        } else {
            if (!cleanSiteId) return res.status(400).json({ message: `Validation Blocked! ${role} role requires allocating a physical site location link.` });
            cleanSupplierId = null;
        }

        const newUser = new User({
            name: name.trim(),
            email: emailClean,
            password, // Plain text string passes cleanly; your pre-save schema hook handles hashing automatically
            role,
            site_id: cleanSiteId,
            supplier_id: cleanSupplierId,
            cell_number: cell_number.trim(),
            status: "Active" // 🌟 Forces status default value mapping to Active status
        });

        await newUser.save();
        res.status(201).json({ message: "User created successfully", userId: newUser._id });

    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};

// 3. READ OPERATION: FETCH ALL ACCOUNTS WITH MULTI-COLLECTION POPULATE JOINS
const getAllUserProfiles = async (req, res) => {
    try {
        // Hydrates MongoDB ObjectIds into clear textual reference records models
        const directory = await User.find()
            .populate("site_id", "site_name location site_code")
            .populate("supplier_id", "supplier_name registration_number")
            .sort({ createdAt: -1 });

        res.status(200).json({ count: directory.length, users: directory });
    } catch (error) {
        res.status(500).json({ message: "Error reading master credentials user directory stream", error: error.message });
    }
};
// 4. UPDATE OPERATION: STATE SWITCH TOGGLE OVERRIDE & INSTANT DISCONNECT
const toggleUserAccountStatus = async (req, res) => {
    try {
        const targetId = req.params.id;
        const targetAccount = await User.findById(targetId);

        if (!targetAccount) {
            return res.status(404).json({ message: "Target personnel security profile row not found." });
        }

        const nextState = targetAccount.status === "Active" ? "Inactive" : "Active";
        targetAccount.status = nextState;
        await targetAccount.save();

        // 🌟 SECURITY SHUTDOWN CASCADE: If an account is deactivated, instantly drop their active session tokens!
        if (nextState === "Inactive") {
            await Token.updateMany({ user_id: targetAccount._id }, { $set: { is_active: false } });
            console.log(`Security Notice: User session revoked for deactivated account ID: ${targetAccount._id}`);
        }

        res.status(200).json({ message: `User identity profile status successfully mapped to [${nextState}] status state.`, user: targetAccount });
    } catch (error) {
        res.status(500).json({ message: "Error compiling status state modifications loops", error: error.message });
    }
};

// 5. SESSION PIPELINE: VERIFY IDENTITY & PACK UNIFORM JWT PAYLOAD
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🌟 SAFETY BLOCK: Instantly deny entry transactions if the user document is flagged Inactive!
        if (user.status === "Inactive") {
            return res.status(403).json({ message: "Access Suspended! Your corporate identity profile has been deactivated. Contact an ERP System Admin." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Enforce single-device validation locks by wiping older session tokens
        await Token.updateMany({ user_id: user._id, is_active: true }, { $set: { is_active: false } });

        // Pack payload attributes into a clean, uniform lowercase structure matching your auth middleware
        const token = jwt.sign(
            { 
                userid: user._id, 
                role: user.role, 
                siteId: user.site_id,
                supplier_id: user.supplier_id 
            }, 
            JWT_SECRET, 
            { expiresIn: "1d" }
        );

        await Token.create({ token, is_active: true, user_id: user._id });

        res.status(200).json({ 
            message: "Login successful", 
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                site_id: user.site_id,
                supplierId: user.supplier_id // Synchronizes cleanly with your frontend caching storage engine
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// 6. TERMINATE OPERATION: SECURE LOGOUT TERMINATION RUN
const logoutUser = async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1]; 
    if (!token) return res.status(400).json({ message: "Token missing in Authorization header" });

    try {
        const tokenDoc = await Token.findOne({ token, is_active: true });
        if (!tokenDoc) return res.status(404).json({ message: "Token not found or already logged out" });

        tokenDoc.is_active = false;
        await tokenDoc.save();
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ message: "Logout failed", error: err.message });
    }
};

// 7. MAINTENANCE OPTION: UPDATE USER SUPPLIER LINK (POSTMAN BACKWARD RECOMPILING TOOL)
const updateSupplierId = async (req, res) => {
    try {
        const { userId, supplierId } = req.body;
        if (!userId || !supplierId) return res.status(400).json({ message: "Both unique Target User ID and Supplier Company ID must be supplied." });

        const updatedUser = await User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId.trim()),
            { $set: { supplier_id: new mongoose.Types.ObjectId(supplierId.trim()) } },
            { new: true }
        );
        if (!updatedUser) return res.status(404).json({ message: "Target user account not found in system directories." });

        res.status(200).json({ message: "User supplier association updated successfully inside database layers!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: "Error compiling account parameter modification overrides", error: error.message });
    }
};

module.exports = { 
    welcometouser, 
    createUser, 
    getAllUserProfiles, 
    toggleUserAccountStatus, 
    loginUser, 
    logoutUser, 
    updateSupplierId 
};


==================================================
FILE: .\middleware\auth.js
==================================================

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


==================================================
FILE: .\middleware\errorhandler.js
==================================================

function errorHandler(err, req, res, next) {
    console.error(err); // log full error
    res.status(500).json({
        errorMessage: "Server error",
    });
};

module.exports = {
    errorHandler
};

==================================================
FILE: .\middleware\logger.js
==================================================

const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

const loggFile = fs.createWriteStream(path.join(__dirname, 'logBook.log'), { flags: 'a' })

const logger = morgan('combined', { stream: loggFile })

module.exports = {
    logger
}

==================================================
FILE: .\middleware\upload.js
==================================================

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the local temporary upload directory paths exist cleanly inside workspace disks
const tempDir = path.join(__dirname, "../public/uploads/tmp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure robust local disk buffering configuration parameters
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure the multer execution limit engine parameters
const upload = multer({
    storage: diskStorage,
    fileFilter: (req, file, cb) => {
        // Enforce file validation check: Allow PDF files only
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Invalid file type! Only official PDF documents are authorized for upload."), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5 Megabytes maximum threshold limit per document
});

// Intercept up to 3 files concurrently matching your frontend naming markers
const uploadMobilizationFiles = upload.fields([
    { name: "medical_file", maxCount: 1 },
    { name: "hse_file", maxCount: 1 },
    { name: "wqt_file", maxCount: 1 }
]);

module.exports = { uploadMobilizationFiles };


==================================================
FILE: .\models\blacklist.js
==================================================

const mongoose = require("mongoose");

const BlacklistSchema = new mongoose.Schema({
    civil_id: {
        type: String,
        required: true,
        trim: true,
        unique: true // Guarantees a barred ID cannot have duplicate blocks
    },
    reason_for_blacklisting: {
        type: String,
        required: true,
        trim: true
    },
    blacklisted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // References the user table collection identifier who issued the drop
        required: true
    },
    date_blacklisted: {
        type: Date,
        default: Date.now
    }
}, {
    versionKey: false
});

module.exports = mongoose.model("Blacklist", BlacklistSchema);


==================================================
FILE: .\models\designation.js
==================================================

const mongoose = require("mongoose");

const DesignationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    risk_level: {
        type: String,
        required: true,
        enum: ["Low", "Medium", "High"],
        default: "Low"
    },
    // 🌟 ADD THIS MISSING STATUS FIELD TO UNLOCK THE TABLE DATA LIST
    status: {
        type: String,
        required: true,
        enum: ["Active", "Inactive"],
        default: "Active" // Automatically defaults new titles to Active status!
    }
}, {
    versionKey: false
});

module.exports = mongoose.model("Designation", DesignationSchema);


==================================================
FILE: .\models\mobilization_request.js
==================================================

const mongoose = require("mongoose");

const MobilizationRequestSchema = new mongoose.Schema({
    civil_id: {
        type: String,
        required: true,
        trim: true
        // 🌟 CORRECTION FIXED: Removed 'unique: true' to allow repeat historic deployments over time!
    },
    employee_name: {
        type: String,
        required: true,
        trim: true
    },
    nationality: {
        type: String,
        required: true,
        trim: true
    },
    dob: {
        type: Date,
        required: true
    },
    mobile_number: {
        type: String,
        required: true,
        trim: true
    },
    designation_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Designation",
        required: true
    },
    civil_expire: {
        type: Date,
        required: true
    },
    accommodation_type: {
    type: String,
    required: true,
    enum: ["1SS", "2SS", "3SS", "1JS", "2JS", "3JS"], // 🌟 FIXED: Restricts inputs to your required lodging classifications
    trim: true
    },
    target_site_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
        required: true
    },
    sub_company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
        required: true
    },
    sponsor_company: {
        type: String,
        required: true,
        trim: true
    },
    medical_file_url: {
        type: String,
        required: true
    },
    medical_comment: {
        type: String,
        default: "Pending Review"
    },
    hse_file_url: {
        type: String,
        required: true
    },
    hse_comment: {
        type: String,
        default: "Pending Review"
    },
    wqt_file_url: { type: String, default: "" }, // Required only if designation is a Welder title
    wqt_comment: { type: String, default: "Not Required for this Trade" }, // Changes to pending for welders

        medical_status: { 
        type: String, 
        required: true, 
        enum: ['Pending', 'Approved', 'Resubmit'], 
        default: 'Pending' 
    },
    hse_status: { 
        type: String, 
        required: true, 
        enum: ['Pending', 'Approved', 'Resubmit'], 
        default: 'Pending' 
    },
    wqt_status: { 
        type: String, 
        required: true, 
        enum: ['Pending', 'Approved', 'Resubmit', 'Not Required'], 
        default: 'Pending' 
    },
    
    status: {
        type: String,
        required: true,
        enum: [
            "Under Review",        // Tier 2: Pending Site Reviewers (Medic, HSE, and optionally WQT)
            "Pending HO Approval", // Tier 3: Approved by reviewers, pending HO Subcon ID allocation
            "Pending Site Admin",  // Tier 4: Approved by HO, pending room checking configurations
            "Approved", "Cancelled", "Rejected"
        ],
        default: "Under Review"
    },
    urgency: {
        type: String,
        required: true,
        enum: ["Normal", "Urgent", "Critical Emergency"], // 🌟 CORRECTION FIXED: Escalates priority worker applications
        default: "Normal"
    },
    joining_date: { 
        type: Date, 
        default: null 
    },
    // 🌟 ADD THIS MISSING KEY IN YOUR MOBILIZATION REQ MODEL
    room_number: { 
        type: String, 
        default: "" 
    },
    submission_history: {
        type: Array,
        default: []
    }
}, {
    timestamps: true, // Automatically registers and manages createdAt and updatedAt values
    versionKey: false
});

module.exports = mongoose.model("MobilizationRequest", MobilizationRequestSchema);


==================================================
FILE: .\models\sites.js
==================================================

const mongoose = require("mongoose");

const SiteSchema = new mongoose.Schema({
    site_code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true, // Forces "fhd" -> "FHD" automatically
        trim: true
    },
    site_name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        enum: ["Active", "Inactive"],
        default: "Active"
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Site", SiteSchema);

==================================================
FILE: .\models\subcontractor_employee.js
==================================================

const mongoose = require("mongoose");

const SubcontractorEmployeeSchema = new mongoose.Schema({
    civil_id: {
        type: String,
        required: true,
        trim: true
    },
    employee_name: {
        type: String,
        required: true,
        trim: true
    },
    nationality: {
        type: String,
        required: true,
        trim: true
    },
    dob: {
        type: String, // Kept as String to perfectly match your target layout architecture text rules
        required: true
    },
    mobile_number: {
        type: String,
        required: true,
        trim: true
    },
    designation_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Designation",
        required: true
    },
    civil_expire: {
        type: String,
        required: true
    },
    accommodation_type: {
        type: String,
        required: true,
        enum: ["1SS", "2SS", "3SS", "1JS", "2JS", "3JS"]
    },
    current_site_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
        required: true
    },
    supplier_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
        required: true
    },
    sponsor_company: {
        type: String,
        required: true,
        trim: true
    },
    employment_status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    },
    final_hse_doc_url: {
        type: String,
        required: true
    },
    final_medic_doc_url: {
        type: String,
        required: true
    },
    mobilized_at: {
        type: Date,
        default: Date.now
    },
    joining_date: { 
        type: Date, 
        default: null 
    },
    // 🌟 ADD THIS MISSING KEY IN YOUR ACTIVE EMPLOYEE MODEL
    room_number: { 
        type: String, 
        default: "" 
    },
    history: {
        type: Array,
        default: [] // Array holds any operation: { event_type, from_state, to_state, authorized_by, date, notes }
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("SubcontractorEmployee", SubcontractorEmployeeSchema);


==================================================
FILE: .\models\supplier.js
==================================================

const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema({
    supplier_name: {
        type: String,
        required: true,
        trim: true
    },
    cr_number: {
        type: String,
        required: true,
        trim: true,
        unique: true 
    },
    contact_email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    contact_phone: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        enum: ["Active", "Inactive"],
        default: "Active"
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Supplier", SupplierSchema);


==================================================
FILE: .\models\token.js
==================================================

const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema({
  token: { 
    type: String, 
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  },
  // Linked directly to your Subcontractor 'User' model (HO, SITE_HSE, SUPPLIER, etc.)
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  // Automatically self-deletes from MongoDB after 7 days to keep data clean
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: "7d" 
  }
}, {
  versionKey: false
});

const Token = mongoose.model("Token", TokenSchema);

// Exporting directly as the model itself for standard Mongoose usage
module.exports = Token;

==================================================
FILE: .\models\user.js
==================================================

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['HO', 'SITE_HSE', 'SITE_MEDIC', 'SITE_MANAGER', 'SUPPLIER', 'ERP_TEAM', 'DEVELOPER']
    },
    site_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
        default: null
    },
    supplier_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
        default: null // Only populated if role === 'SUPPLIER'
    },
    cell_number: {
        type: String,
        required: true,
        trim: true
    },
    // 🌟 ADDED: Status structural state tracking configuration field
    status: {
        type: String,
        required: true,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true,
    versionKey: false
});

// --- Pre-Save Hook: Automatically hash password before saving to database ---
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    try {
        const saltRounds = 10; 
        const salt = await bcrypt.genSalt(saltRounds);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// --- Method: Helper function to compare passwords during login ---
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);


==================================================
FILE: .\routes\admin_review_route.js
==================================================

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


==================================================
FILE: .\routes\designation_route.js
==================================================

const express = require("express");
const { createDesignation, getAllDesignations, getDesignationById, updateDesignation, deleteDesignation } = require("../controllers/designation_controller");
const { authMiddleware } = require("../middleware/auth");

const Designationroute = express.Router();

Designationroute.get("/manage-designations", (req, res) => res.render("manage_designations"));
Designationroute.post("/create", authMiddleware, createDesignation);
Designationroute.get("/all", authMiddleware, getAllDesignations);
Designationroute.get("/:id", authMiddleware, getDesignationById);
Designationroute.put("/update/:id", authMiddleware, updateDesignation);
Designationroute.delete("/delete/:id", authMiddleware, deleteDesignation);




module.exports = { Designationroute };


==================================================
FILE: .\routes\mobilization_route.js
==================================================

const express = require("express");
const mongoose = require("mongoose");
const { getGfsBucket } = require("../config/db");
const { 
    createMobilizationRequest, 
    getSupplierOwnMobilizations, 
    dropMobilizationRequest, 
    resubmitMobilizationDocuments,
    getRequestDetailedContext,
    resubmitWorkerDocumentCorrection
} = require("../controllers/mobilization_controller");
const { authMiddleware } = require("../middleware/auth");
const { uploadMobilizationFiles } = require("../middleware/upload"); // 🌟 IMPORT UPLOAD MIDDLEWARE

const Mobilizationroute = express.Router();

// 1. FRONTEND USER SUBCONTRACTOR VIEW ROUTE
Mobilizationroute.get("/portal", (req, res) => {
    res.render("supplier_portal"); // Renders your upcoming views/supplier_portal.ejs file
});

Mobilizationroute.get("/request-details/:id", (req, res) => {
    res.render("request_details", { requestId: req.params.id }); 
});

// 2. PROTECTED DATA API TRANSACTION PIPELINE ROUTING
Mobilizationroute.get("/my-submissions", authMiddleware, getSupplierOwnMobilizations);
Mobilizationroute.put("/drop-request/:id", authMiddleware, dropMobilizationRequest); // Supplier 'Drop / Cancel' Route hook
Mobilizationroute.put("/resubmit/:id", authMiddleware, resubmitMobilizationDocuments); // Dynamic document re-submission route
// 🌟 UPDATED: Added uploadMobilizationFiles directly into your POST route pipeline!
Mobilizationroute.post("/submit-worker", authMiddleware, uploadMobilizationFiles, createMobilizationRequest);
Mobilizationroute.get("/request-context/:id", authMiddleware, getRequestDetailedContext);
Mobilizationroute.post("/resubmit-file/:id", authMiddleware, uploadMobilizationFiles, resubmitWorkerDocumentCorrection);

Mobilizationroute.get("/file/:id", async (req, res) => {
    try {
        const fileIdString = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(fileIdString)) {
            return res.status(400).json({ message: "Invalid binary file tracking ID parameter format." });
        }

        const fileObjectId = new mongoose.Types.ObjectId(fileIdString);

        // 🌟 CRITICAL FIX: Direct native bucket instance binding matching your controller setup exactly
        const structuralBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });

        // Open a continuous data read stream from your workforce_docs collections chunks
        const downloadStream = structuralBucket.openDownloadStream(fileObjectId);

        // Intercept pipeline stream errors (like file missing) cleanly without crashing your node app
        downloadStream.on("error", (streamError) => {
            console.error("GridFS Stream Intercept Fault:", streamError.message);
            return res.status(404).json({ message: "Requested document profile attachment not found on database disks." });
        });

        // Set response headers to display the document cleanly in a tab view instead of downloading
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", "inline");

        // Pipe your data fragments straight to your browser display viewport
        downloadStream.pipe(res);

    } catch (err) {
        console.error("Exception triggered inside download stream router route:", err.message);
        res.status(500).json({ message: "Internal server error streaming binary data chunks from MongoDB disks.", error: err.message });
    }
});


module.exports = { Mobilizationroute };


==================================================
FILE: .\routes\sites_route.js
==================================================

const express = require("express");
const { createSite, getAllSites, getSiteById, updateSite, deleteSite } = require("../controllers/sites_controller");
const { authMiddleware } = require("../middleware/auth");

const Siteroute = express.Router();

Siteroute.get("/manage-sites", (req, res) => res.render("manage_sites"));
Siteroute.post("/create", authMiddleware, createSite);
Siteroute.get("/all", authMiddleware, getAllSites);
Siteroute.get("/:id", authMiddleware, getSiteById);
Siteroute.put("/update/:id", authMiddleware, updateSite);
Siteroute.delete("/delete/:id", authMiddleware, deleteSite);

module.exports = { Siteroute };


==================================================
FILE: .\routes\suppliers_route.js
==================================================

const express = require("express");
const { createSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier } = require("../controllers/suppliers_controller");
const { authMiddleware } = require("../middleware/auth");

const Supplierroute = express.Router();

Supplierroute.get("/manage-suppliers", (req, res) => res.render("manage_suppliers"));
Supplierroute.post("/create", authMiddleware, createSupplier);
Supplierroute.get("/all", authMiddleware, getAllSuppliers);
Supplierroute.get("/:id", authMiddleware, getSupplierById);
Supplierroute.put("/update/:id", authMiddleware, updateSupplier);
Supplierroute.delete("/delete/:id", authMiddleware, deleteSupplier);




module.exports = { Supplierroute };


==================================================
FILE: .\routes\user_route.js
==================================================

const express = require("express");
const { 
    welcometouser, 
    createUser, 
    getAllUserProfiles,       // 🌟 ADDED: Controller to fetch all system accounts
    toggleUserAccountStatus,  // 🌟 ADDED: Controller to toggle active state filters
    loginUser, 
    logoutUser, 
    updateSupplierId 
} = require("../controllers/user_controller");
const { authMiddleware } = require("../middleware/auth");

const Userroute = express.Router();

// 1. FRONTEND WORKSPACE PAGE RENDERING VIEWS REROUTES
Userroute.get("/login-page", (req, res) => {
    res.render("login"); // Renders your premium views/login.ejs authentication vault
});

Userroute.get("/manage-users", (req, res) => {
    res.render("manage_users"); // Renders your upcoming views/manage_users.ejs administrative deck
});

// 2. BACKEND REST DATA API TRANSACTION PIPELINE ENDPOINTS
Userroute.get("/", welcometouser);
Userroute.post("/register", createUser);
Userroute.post("/login", loginUser);
Userroute.put("/update", updateSupplierId);
Userroute.post("/logout", authMiddleware, logoutUser);

// New management route pipeline intersections mapping hooks
Userroute.get("/all", authMiddleware, getAllUserProfiles);                     // GET -> /user/all
Userroute.put("/toggle-status/:id", authMiddleware, toggleUserAccountStatus);  // PUT -> /user/toggle-status/:id

module.exports = { Userroute };


==================================================
FILE: .\utils\document_purger.js
==================================================

const mongoose = require("mongoose");

// 🌟 CRITICAL FIX: Define a clean, inline schema to track files safely without raw driver calls
const GridFSFileSchema = new mongoose.Schema({}, { strict: false, collection: "workforce_docs.files" });
const GridFSFileModel = mongoose.models.GridFSFile || mongoose.model("GridFSFile", GridFSFileSchema);

/**
 * UTILITY ENGINE: Automatically deletes binary file blobs from GridFS collections
 * @param {Array} fileUrls - Array of string URL file paths to extract IDs from and delete
 */
const purgeWorkforceBinaryFiles = async (fileUrls) => {
    try {
        // Validation check: Bypass if array is empty or connection dropped
        if (!fileUrls || fileUrls.length === 0 || !mongoose.connection || !mongoose.connection.db) {
            return;
        }

        const structuralBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });
        
        for (const url of fileUrls) {
            // Safety Check: Bypass blank rows, null indices, or invalid paths safely
            if (!url || typeof url !== 'string' || url.trim() === "" || !url.includes("/")) {
                continue;
            }

            // Extract the unique hex string ID from trailing segment of your route path
            const urlSegments = url.split("/");
            const fileIdString = urlSegments[urlSegments.length - 1];

            if (fileIdString && mongoose.Types.ObjectId.isValid(fileIdString)) {
                const objectId = new mongoose.Types.ObjectId(fileIdString);
                
                try {
                    // 🌟 MULTI-CASE CRASH SAFE LOCK: Query using official Mongoose compile tracks!
                    const fileExists = await GridFSFileModel.findById(objectId);
                    
                    if (fileExists) {
                        // Fire absolute disk cleanup cascade execution rule command
                        await structuralBucket.delete(objectId);
                        console.log(`GridFS Disk Clean Success: Erased file chunks reference -> ${fileIdString}`);
                    } else {
                        console.log(`GridFS Cleanup Notice: File reference ID ${fileIdString} already missing from disk storage.`);
                    }
                } catch (bucketError) {
                    console.warn(`GridFS Document Purge Warning for ID ${fileIdString}: ${bucketError.message}`);
                }
            }
        }
    } catch (error) {
        console.error("Non-fatal exception triggered inside background File Purge utility pipeline:", error.message);
    }
};

module.exports = { purgeWorkforceBinaryFiles };


==================================================
FILE: .\views\login.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Portal Authentication</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0 flex flex-col justify-center items-center relative overflow-hidden" style="background-color: #0f172a !important;">

    <!-- Decorative Subtle Background Glow Elements -->
    <div class="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-20%] right-[-10%] w-[45rem] h-[45rem] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>

    <!-- MAIN CENTRALIZED LOGIN ARCHITECTURE ENVELOPE -->
    <div class="w-full max-w-md p-4 z-10" style="display: block !important; box-sizing: border-box !important;">
        
        <section class="bg-slate-950 border border-slate-800/80 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-md" style="background-color: #020617 !important; border: 1px solid #1e293b !important; border-radius: 1.5rem !important;">
            
            <!-- Core Brand Indicia Header -->
            <div class="text-center space-y-2" style="display: block !important;">
                <h2 class="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
                    <span>SAS_SUBCON</span>
                    <span class="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded-md border border-emerald-500/20 tracking-wider uppercase">Secure</span>
                </h2>
                <p class="text-xs text-slate-400 font-medium tracking-wide">Workforce Verification & Mobilization Portal</p>
            </div>

            <!-- Dynamic Network Feedback Status Notice Container -->
            <div id="statusBox" class="hidden p-4 rounded-xl text-xs font-bold uppercase tracking-wider border text-center transition-all duration-300"></div>

            <!-- Input Processing Processing Form Array Data Target -->
            <form id="loginForm" class="space-y-4" style="display: flex !important; flex-direction: column !important; gap: 1rem !important;">
                
                <div style="display: block !important;">
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Corporate Identity Email</label>
                    <div class="relative">
                        <span class="absolute left-4 top-3 text-slate-500 text-sm">📧</span>
                        <input type="email" id="email" required 
                            class="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition placeholder-slate-600 shadow-inner"
                            placeholder="coordinator@company.com" style="box-sizing: border-box !important;">
                    </div>
                </div>

                <div style="display: block !important;">
                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Security Access Password</label>
                    <div class="relative">
                        <span class="absolute left-4 top-3 text-slate-500 text-sm">🔒</span>
                        <input type="password" id="password" required 
                            class="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition placeholder-slate-600 shadow-inner"
                            placeholder="••••••••" style="box-sizing: border-box !important;">
                    </div>
                </div>

                <div class="pt-2" style="display: block !important; width: 100% !important;">
                    <button type="submit" 
                        class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all duration-150 shadow-lg shadow-emerald-600/10 active:scale-[0.98]">
                        Log In Securely
                    </button>
                </div>
            </form>

        </section>

        <!-- Low-Profile System Footer Notice -->
        <p class="text-center text-[10px] text-slate-500 font-bold tracking-wider uppercase mt-6">
            SAS Corporate Logistics System Group &copy; 2026
        </p>

    </div>
    <!-- Frontend Script Logic: Orchestrates secure session authentications -->
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (event) => {
            event.preventDefault(); // Invalidate native standard webpage refresh loops

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const statusBox = document.getElementById('statusBox');

            try {
                // Clear previous network responses status indicators
                statusBox.className = "hidden";
                statusBox.innerText = "";

                // Transmit secure validation payloads directly to your active backend routes
                const apiCall = await fetch('/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await apiCall.json();

                // GATEWAY GUARD: Handle negative credential rejections cleanly
                if (!apiCall.ok) {
                    statusBox.innerText = data.message || "Authentication credentials verification failed.";
                    statusBox.className = "p-4 rounded-xl text-xs font-bold uppercase tracking-wider text-center block bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-6";
                    return;
                }

                // SECURE PAYLOAD STORAGE: Save token identities safely inside browser caching pools
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.user.role);
                localStorage.setItem('userId', data.user.id);       
                localStorage.setItem('email', data.user.email);     
                localStorage.setItem('siteId', data.user.site_id || 'HO'); 
                localStorage.setItem('supplierId', data.user.supplierId || 'NONE'); // Changed to supplierId with capital I

                // Present success confirmation notice status change elements
                statusBox.innerText = "Access Granted! Customizing Operational Desk...";
                statusBox.className = "p-4 rounded-xl text-xs font-bold uppercase tracking-wider text-center block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6 shadow";

                // DYNAMIC ROLE GATE ROUTER: Evaluates account credentials and splits travel endpoints
                setTimeout(() => {
                    if (data.user.role === 'SUPPLIER') {
                        // Subcontractor entry launch workflow page path
                        window.location.href = "/mobilization/portal"; 
                    } else {
                        // Internal back-office organizational operations deck cockpit
                        window.location.href = "/site/manage-sites";
                    }
                }, 1200);

            } catch (err) {
                statusBox.innerText = "Network pipeline connection exception: " + err.message;
                statusBox.className = "p-4 rounded-xl text-xs font-bold uppercase tracking-wider text-center block bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-6";
            }
        });
    </script>
</body>
</html>


==================================================
FILE: .\views\manage_designations.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Designation Management</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0">
    <!-- Status Notification Alert Banner -->
         <div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0 animate-fade-in" style="min-width: 20rem; pointer-events: none;"></div>
            
    <!-- Global Page Layout Stack Wrapper -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start bg-slate-900">

        <!-- Top Navigation Header component from your Site management layout page -->
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 shadow-lg w-full shrink-0">
            <div class="max-w-7xl mx-auto flex justify-between items-center w-full">
                <div>
                    <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>SAS_SUBCON</span>
                        <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Hub Portal</span>
                    </h1>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Standardized Trade Titles & Risk Classifications</p>
                </div>
                <a href="/user/dashboard-view" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700 shadow-md">
                    Back to Dashboard
                </a>
            </div>
        </header>

        <!-- Main Content Area: Side-by-Side arrangement matches Sites and Suppliers perfectly -->
        <main class="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start bg-slate-900">
            
            
            <!-- LEFT PANEL: Trade Designation Sidebar Form Card Component -->
            <div class="lg:col-span-1 w-full">
                <section class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
                    <div class="mb-5">
                        <h3 id="formTitle" class="text-lg font-black text-white flex items-center gap-2">📋 Catalog Trade Role</h3>
                        <p class="text-xs text-slate-400 mt-1">Define standardized contractor job profiles and safety indicators.</p>
                    </div>

                    <form id="designationForm" class="space-y-4">
                        <input type="hidden" id="designationId" value="">

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Official Designation Title</label>
                            <input type="text" id="title" required 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                placeholder="e.g., Scaffolder, Welder, Pipefitter">
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">HSE Compliance Risk Level</label>
                            <select id="riskLevel" required
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition">
                                <option value="" disabled selected class="text-slate-500">Select Risk Level...</option>
                                <option value="Low" class="bg-slate-900 text-emerald-400 font-bold">🟢 Low Risk</option>
                                <option value="Medium" class="bg-slate-900 text-amber-400 font-bold">🟡 Medium Risk</option>
                                <option value="High" class="bg-slate-900 text-rose-400 font-bold">🔴 High Risk</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Deployment Framework Status</label>
                            <select id="status" required
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition">
                                <option value="" disabled selected class="text-slate-500">Select Status...</option>
                                <option value="Active" class="bg-slate-900 text-emerald-400 font-bold">🟢 Active</option>
                                <option value="Inactive" class="bg-slate-900 text-rose-400 font-bold">🔴 Inactive</option>
                            </select>
                        </div>

                        <div class="flex flex-col gap-2 pt-2">
                            <button type="submit" id="submitBtn" 
                                class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-[0.99]">
                                Add Designation
                            </button>
                            <button type="button" id="cancelEditBtn" 
                                class="hidden w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition border border-slate-700">
                                Cancel Modification
                            </button>
                        </div>
                    </form>
                </section>
            </div>
            <!-- RIGHT PANEL: Live Trade Directory Table & Search Filter Bar Layout -->
            <div class="lg:col-span-2 w-full space-y-4">
                <section class="space-y-4 flex flex-col bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl w-full">
                     
                     <!-- HORIZONTAL FILTER TOOL DECK: Formatted inline to guarantee absolute horizontal row stability -->
                     <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 w-full" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important;">
                         
                         <!-- 1. Text Search Input Bar Layout Slot -->
                         <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important;">
                             <input type="text" id="searchInput" 
                                 class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                 placeholder="Search title or risk category...">
                             <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
                         </div>

                         <!-- 2. Segmented Horizontal Tab Sliders Deck -->
                         <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none gap-1" style="display: flex !important; flex-direction: row !important;">
                             <button type="button" id="filterActiveBtn" onclick="setStatusFilter('Active')"
                                 class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow">
                                 Active
                             </button>
                             <button type="button" id="filterInactiveBtn" onclick="setStatusFilter('Inactive')"
                                 class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200">
                                 Inactive
                             </button>
                         </div>

                         <!-- 3. Dynamic Filter CounterBadge Statistics Indicator -->
                         <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important;">
                             Filtered Roles: <span id="recordCount" class="text-emerald-400 font-black">0</span>
                         </div>
                     </div>

                     <!-- Structured Dark Table Grid Window Container -->
                     <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col w-full">
                         <div class="overflow-x-auto">
                             <table class="w-full text-left border-collapse min-w-[500px]">
                                 <thead>
                                     <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                         <th class="px-6 py-4">Designation Job Title</th>
                                         <th class="px-6 py-4">HSE Risk Classification</th>
                                         <th class="px-6 py-4 text-right">Actions Pipeline</th>
                                     </tr>
                                 </thead>
                                 <tbody id="designationTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                                     <!-- Script loop injects formatted row node parameters here -->
                                 </tbody>
                             </table>
                         </div>
                     </div>
                </section>
            </div>

        </main>
    </div> <!-- Closes full layout page wrapper block layout -->
    <!-- Script Engine Execution Matrix Pipeline -->
    <script>
        const token = localStorage.getItem('token');
        let allDesignations = [];
        let currentStatusFilter = 'Active';

        if (!token) { window.location.href = "/user/login-page"; }

        async function loadDesignations() {
            try {
                const res = await fetch('/designation/all', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                allDesignations = data.designations || [];
                applyGlobalFilters();
            } catch (err) { showAlert(err.message, 'error'); }
        }

        function applyGlobalFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            const filteredDataset = allDesignations.filter(des => {
                const calculatedStatus = des.status || 'Active';
                const matchesStatus = calculatedStatus === currentStatusFilter;
                const matchesSearch = 
                    des.title.toLowerCase().includes(searchVal) || 
                    des.risk_level.toLowerCase().includes(searchVal);
                return matchesStatus && matchesSearch;
            });
            renderTable(filteredDataset);
        }

        function setStatusFilter(statusType) {
            currentStatusFilter = statusType;
            const activeBtn = document.getElementById('filterActiveBtn');
            const inactiveBtn = document.getElementById('filterInactiveBtn');

            if (statusType === 'Active') {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
            } else {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-rose-600 text-white shadow";
            }
            applyGlobalFilters();
        }

        // FIXED ROW INJECTOR Engine Loop Matrix: Formats precise inline color button properties
        function renderTable(arr) {
            const tbody = document.getElementById('designationTableBody');
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-12 text-center text-slate-500 italic text-xs">No job designations found matching current filter metrics.</td></tr>`;
                return;
            }

            arr.forEach(des => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition";
                
                const resolvedStatus = des.status || 'Active';
                const isDesActive = resolvedStatus === 'Active';
                
                let riskBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (des.risk_level === 'Medium') riskBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                if (des.risk_level === 'High') riskBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                
                const actionButtonText = isDesActive ? 'Deactivate' : 'Activate';
                const actionBtnStyle = isDesActive 
                    ? "bg-rose-600/10 text-rose-400 border border-rose-500/10 hover:bg-rose-600 hover:text-white" 
                    : "bg-emerald-600/10 text-emerald-400 border border-emerald-500/10 hover:bg-emerald-600 hover:text-white";

                tr.innerHTML = `
                    <td class="px-6 py-4 font-black font-mono text-white tracking-wider text-xs uppercase">${des.title}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${riskBadge}">
                            ${des.risk_level} Risk
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="populateEdit('${des._id}')" class="bg-blue-600/10 text-blue-400 border border-blue-500/10 px-2.5 py-1 text-[11px] font-bold rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition">Edit</button>
                            <button onclick="deactivateDesignation('${des._id}')" class="${actionBtnStyle} px-2.5 py-1 text-[11px] font-bold rounded-lg shadow-sm transition">
                                ${actionButtonText}
                            </button>
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('designationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('designationId').value;
            const payload = {
                title: document.getElementById('title').value,
                risk_level: document.getElementById('riskLevel').value,
                status: document.getElementById('status').value
            };
            const isEdit = id.length > 0;
            try {
                const res = await fetch(isEdit ? `/designation/update/${id}` : '/designation/create', {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
                showAlert(isEdit ? "Designation modifications compiled successfully!" : "Trade role appended to master catalog records!", 'success');
                resetForm(); loadDesignations();
            } catch (err) { showAlert(err.message, 'error'); }
        });

        function populateEdit(id) {
            const des = allDesignations.find(d => d._id === id);
            if (!des) return;
            document.getElementById('designationId').value = des._id;
            document.getElementById('title').value = des.title;
            document.getElementById('riskLevel').value = des.risk_level;
            document.getElementById('status').value = des.status || 'Active';
            
            document.getElementById('formTitle').innerText = "✏️ Modify Role Classification";
            document.getElementById('submitBtn').innerText = "Update Classification";
            document.getElementById('submitBtn').className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
        }

        async function deactivateDesignation(id) {
            if (!confirm("Are you sure you want to alter this job role designation status configuration?")) return;
            try {
                const res = await fetch(`/designation/delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showAlert(data.message || "Status configuration updated successfully.", 'success'); 
                loadDesignations(); 
            } catch (err) { showAlert(err.message, 'error'); }
        }

        document.getElementById('searchInput').addEventListener('input', applyGlobalFilters);

        function resetForm() {
            document.getElementById('designationForm').reset();
            document.getElementById('designationId').value = "";
            document.getElementById('riskLevel').value = "";
            document.getElementById('status').value = "";
            document.getElementById('formTitle').innerText = "📋 Catalog Trade Role";
            document.getElementById('submitBtn').innerText = "Add Designation";
            document.getElementById('submitBtn').className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10";
            document.getElementById('cancelEditBtn').classList.add('hidden');
        }
        document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

        function showAlert(msg, type) {
    const sb = document.getElementById('statusBox');
    if (!sb) return;

    // 1. Inject server notification textual data strings
    sb.innerText = msg;

    // 2. Clear previous themes and apply matching background colors
    if (type === 'success') {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#34d399';
        sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    } else {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#f87171';
        sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    }

    // 3. Trigger css pop-up animations entry states
    sb.classList.remove('hidden', 'scale-95', 'opacity-0');
    sb.classList.add('scale-100', 'opacity-100');

    // 4. Close the popup cleanly after a 3-second cycle run duration interval
    setTimeout(() => {
        sb.classList.remove('scale-100', 'opacity-100');
        sb.classList.add('scale-95', 'opacity-0');
        
        // Wait for the exit animation transition to complete before hiding the container node completely
        setTimeout(() => {
            sb.classList.add('hidden');
        }, 300);
    }, 3000);
}

        loadDesignations();
    </script>
</body>
</html>


==================================================
FILE: .\views\manage_sites.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Site Management</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. CORRECTED Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased">

    <!-- Place this absolute block at the absolute top of your <body> tag wrapper in all 3 files -->
<div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0 duration-300" style="min-width: 22rem; pointer-events: none;"></div>


    <!-- OVER-RIDE WRAPPER: Forces everything to flow top-to-bottom, breaking the bad CSS rule -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">

        <!-- Top Navigation Header: Spans 100% of top screen width -->
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg w-full shrink-0">
            <div>
                <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>SAS_SUBCON</span>
                    <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Hub Portal</span>
                </h1>
                <p class="text-xs text-slate-400 font-medium mt-0.5">Physical Infrastructure & Project Locations</p>
            </div>
            <a href="/user/dashboard-view" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700">
                Back to Dashboard
            </a>
        </header>
        <!-- Main Content Area: Aligns Form and Table Side-by-Side underneath header -->
        <main class="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            
            
            <!-- LEFT PANEL: Operational Hub Configuration Input Form -->
            <section class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
                <div class="mb-5">
                    <h3 id="formTitle" class="text-lg font-black text-white flex items-center gap-2">🏗️ Provision Operational Site</h3>
                    <p class="text-xs text-slate-400 mt-1">Configure workspace parameters and master deployment locations.</p>
                </div>

                <form id="siteForm" class="space-y-4">
                    <input type="hidden" id="siteId" value="">

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Functional Site Code</label>
                        <input type="text" id="siteCode" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., FHD, YBL, FHD_PDO">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Descriptive Site Name</label>
                        <input type="text" id="siteName" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., Fahud Maintenance Camp">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Geographical Location (Oman Region)</label>
                        <input type="text" id="location" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., Fahud, Oman">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Deployment Framework Status</label>
                        <select id="status" 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition">
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="submit" id="submitBtn" 
                            class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10">
                            Register Site
                        </button>
                        <button type="button" id="cancelEditBtn" 
                            class="hidden bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition border border-slate-700">
                            Cancel
                        </button>
                    </div>
                </form>
            </section>

           <!-- RIGHT PANEL: Live Operational Hub Directory Table & Search Field Area -->
            <section class="lg:col-span-2 space-y-4 flex flex-col min-h-[500px] h-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
     
     <!-- Live Active Filter Search Bar -->
     <div class="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important;">
    
    <!-- 1. Left aligned search input field layout slot -->
    <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important; margin: 0 !important;">
        <input type="text" id="searchInput" 
            class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            placeholder="Search by code, descriptive name, or region...">
        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
    </div>

    <!-- 2. Centered alignment for row tab segment buttons sliders switches -->
    <div class="p-1 rounded-xl border border-slate-800 shrink-0 select-none bg-slate-900" style="display: flex !important; flex-direction: row !important; gap: 4px !important; margin: 0 !important;">
        <button type="button" id="filterActiveBtn" onclick="setStatusFilter('Active')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow">
            Active
        </button>
        <button type="button" id="filterInactiveBtn" onclick="setStatusFilter('Inactive')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200">
            Inactive
        </button>
    </div>

    <!-- 3. Right aligned active records counter badge statistics card -->
    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important; margin: 0 !important;">
        Filtered Locations: <span id="recordCount" class="text-emerald-400 font-black">0</span>
    </div>
</div>

     <!-- Dynamic Table Grid Output Content Layer Container -->
     <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl flex-1 overflow-hidden flex flex-col">
         <div class="overflow-x-auto flex-1">
             <table class="w-full text-left border-collapse min-w-[600px]">
                 <thead>
                     <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                         <th class="px-6 py-4">Site Code</th>
                         <th class="px-6 py-4">Descriptive Name</th>
                         <th class="px-6 py-4">Oman Region / Location</th>
                         <th class="px-6 py-4">Status</th>
                         <th class="px-6 py-4 text-right">Actions Pipeline</th>
                     </tr>
                 </thead>
                 <tbody id="siteTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                     <!-- Javascript data inject loop -->
                 </tbody>
             </table>
         </div>
     </div>
            </section>

        </main>
    </div> <!-- Closes global over-ride flex wrapper layout -->
    <!-- Script Pipeline: Fully handles data orchestration with your backend APIs -->
    <script>
        const token = localStorage.getItem('token');
        let allSites = [];
        
        // GLOBAL STATE TRACKER: Sets visibility defaults to Active rows upon load
        let currentStatusFilter = 'Active';

        if (!token) { 
            window.location.href = "/user/login-page"; 
        }

        // READ: Background data synchronization fetch query from your Express layer
        async function loadSites() {
            try {
                const res = await fetch('/site/all', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                allSites = data.sites || [];
                
                // Fire unified filter mapping routines
                applyGlobalFilters();
            } catch (err) { 
                showAlert(err.message, 'error'); 
            }
        }

        // UNIFIED FILTER DATA CORE: Cross-references search bars and tabs together cleanly
        function applyGlobalFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            
            const filteredDataset = allSites.filter(site => {
                // Parameter Check A: Evaluates matching tab state segments (Active vs Inactive)
                const matchesStatus = site.status === currentStatusFilter;
                
                // Parameter Check B: Evaluates matching search keywords inside strings
                const matchesSearch = 
                    site.site_code.toLowerCase().includes(searchVal) || 
                    site.site_name.toLowerCase().includes(searchVal) || 
                    site.location.toLowerCase().includes(searchVal);
                
                return matchesStatus && matchesSearch;
            });

            // Hand computed data array directly over to table renderer block
            renderTable(filteredDataset);
        }

        // TAB SLIDER SLOTS: Toggles visual background class properties across your tab deck
        function setStatusFilter(statusType) {
            currentStatusFilter = statusType;
            
            const activeBtn = document.getElementById('filterActiveBtn');
            const inactiveBtn = document.getElementById('filterInactiveBtn');

            if (statusType === 'Active') {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
            } else {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-rose-600 text-white shadow";
            }

            // Instantly repaint database rows to match selected tab
            applyGlobalFilters();
        }
         // HTML GRAPHIC DATA MATRIX: Paints arrays directly into table rows
        function renderTable(arr) {
            const tbody = document.getElementById('siteTableBody');
            
            // Updates counter total badge dynamically matching data constraints
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic">No operational hubs found inside the selected layout channel profile parameters.</td></tr>`;
                return;
            }

            arr.forEach(site => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition";
                
                const isSiteActive = site.status === 'Active';
                const badgeStyleClass = isSiteActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                
                // DYNAMIC TEXT LABELS SWAP: Configures text and styling dynamically based on model indexes
                const actionButtonText = isSiteActive ? 'Deactivate' : 'Activate';
                const actionButtonColorClass = isSiteActive 
                    ? 'bg-rose-600/10 text-rose-400 border border-rose-500/10 hover:bg-rose-600 hover:text-white' 
                    : 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/10 hover:bg-emerald-600 hover:text-white';

                tr.innerHTML = `
                    <td class="px-6 py-4 font-black font-mono text-white tracking-wider">${site.site_code}</td>
                    <td class="px-6 py-4 font-bold text-slate-200">${site.site_name}</td>
                    <td class="px-6 py-4 text-slate-400">${site.location}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-0.5 rounded border border-slate-800 text-[10px] font-bold uppercase ${badgeStyleClass}">
                            ${site.status}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="populateEdit('${site._id}')" class="bg-blue-600/10 text-blue-400 border border-blue-500/10 px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition">Edit</button>
                            <button onclick="deactivateSite('${site._id}')" class="${actionButtonColorClass} px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm transition">
                                ${actionButtonText}
                            </button>
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
        }

        // CREATE & UPDATE: Dispatches database form data payloads directly to Express endpoints
        document.getElementById('siteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('siteId').value;
            const payload = {
                site_code: document.getElementById('siteCode').value,
                site_name: document.getElementById('siteName').value,
                location: document.getElementById('location').value,
                status: document.getElementById('status').value
            };
            const isEdit = id.length > 0;
            try {
                const res = await fetch(isEdit ? `/site/update/${id}` : '/site/create', {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
                showAlert(isEdit ? "Site configuration parameters modified!" : "Operational site created successfully!", 'success');
                resetForm(); loadSites();
            } catch (err) { showAlert(err.message, 'error'); }
        });
         function populateEdit(id) {
            const site = allSites.find(s => s._id === id);
            if (!site) return;
            document.getElementById('siteId').value = site._id;
            document.getElementById('siteCode').value = site.site_code;
            document.getElementById('siteCode').disabled = true; 
            document.getElementById('siteName').value = site.site_name;
            document.getElementById('location').value = site.location;
            document.getElementById('status').value = site.status;
            document.getElementById('formTitle').innerText = "✏️ Modify Operational Parameters";
            document.getElementById('submitBtn').innerText = "Update Site Configuration";
            document.getElementById('submitBtn').className = "flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
        }

        // INTELLIGENT BINARY TOGGLE PIPELINE: Flips records between Active/Inactive states seamlessly
        async function deactivateSite(id) {
            if (!confirm("Are you sure you want to alter this operational hub deployment status indicator?")) return;
            try {
                const res = await fetch(`/site/delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showAlert(data.message || "Status execution successfully completed.", 'success'); 
                loadSites(); // Re-sync data entries
            } catch (err) { showAlert(err.message, 'error'); }
        }

        // Binds text inputs dynamically down to the master core pipeline calculations
        document.getElementById('searchInput').addEventListener('input', applyGlobalFilters);

        // FORM SANITIZER UTILITIES
        function resetForm() {
            document.getElementById('siteForm').reset();
            document.getElementById('siteId').value = "";
            document.getElementById('siteCode').disabled = false;
            document.getElementById('formTitle').innerText = "🏗️ Provision Operational Site";
            document.getElementById('submitBtn').innerText = "Register Site";
            document.getElementById('submitBtn').className = "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.add('hidden');
        }

        document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

        // UNIVERSAL OVERLAY TOAST POPUP DISPATCH PIPELINE
function showAlert(msg, type) {
    const sb = document.getElementById('statusBox');
    if (!sb) return;

    // 1. Inject server notification textual data strings
    sb.innerText = msg;

    // 2. Clear previous themes and apply matching background colors
    if (type === 'success' || type === 'status-success') {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#34d399';
        sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    } else {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#f87171';
        sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    }

    // 3. Trigger css pop-up animations entry states
    sb.classList.remove('hidden', 'scale-95', 'opacity-0');
    sb.classList.add('scale-100', 'opacity-100');

    // 4. Close the popup cleanly after a 3-second cycle run duration interval
    setTimeout(() => {
        sb.classList.remove('scale-100', 'opacity-100');
        sb.classList.add('scale-95', 'opacity-0');
        
        // Wait for the exit animation transition to complete before hiding the container node completely
        setTimeout(() => {
            sb.classList.add('hidden');
        }, 300);
    }, 3000);
}


        // Initialize script metrics on DOM construction initialization
        loadSites();
    </script>
</body>
</html>

==================================================
FILE: .\views\manage_suppliers.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Supplier Management</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. CORRECTED Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased">
    <!-- Place this absolute block at the absolute top of your <body> tag wrapper in all 3 files -->
<div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0 duration-300" style="min-width: 22rem; pointer-events: none;"></div>


    <!-- OVER-RIDE WRAPPER: Forces everything to flow top-to-bottom layout -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">

        <!-- Top Navigation Header: Spans 100% of top screen width -->
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg w-full shrink-0">
            <div>
                <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>SAS_SUBCON</span>
                    <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Hub Portal</span>
                </h1>
                <p class="text-xs text-slate-400 font-medium mt-0.5">Corporate Subcontractor Registry</p>
            </div>
            <a href="/user/dashboard-view" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700">
                Back to Dashboard
            </a>
        </header>

        <!-- Main Content Area: Aligns Form and Table Side-by-Side underneath header -->
        <main class="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 bg-slate-900">
            
            
            <!-- LEFT PANEL: Dynamic Subcontractor Input Form Card (1 Column Grid Span) -->
            <div class="lg:col-span-1">
                <section class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
                    <div class="mb-5">
                        <h3 id="formTitle" class="text-lg font-black text-white flex items-center gap-2">🤝 Register Subcontractor</h3>
                        <p class="text-xs text-slate-400 mt-1">Add or modify operational company registry indicators.</p>
                    </div>

                    <form id="supplierForm" class="space-y-4">
                        <input type="hidden" id="supplierId" value="">

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Company Profile Name</label>
                            <input type="text" id="supplierName" required 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                placeholder="e.g., Hima Services">
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Oman CR Number</label>
                            <input type="text" id="crNumber" required 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800"
                                placeholder="e.g., 1092834">
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Corporate Email Hub</label>
                            <input type="email" id="contactEmail" required 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                placeholder="coordinator@company.com">
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contact Phone Number</label>
                            <input type="text" id="contactPhone" required 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                placeholder="e.g., +96899334455">
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Framework Status</label>
                            <select id="status" 
                                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition">
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        <div class="flex flex-col gap-2 pt-2">
                            <button type="submit" id="submitBtn" 
                                class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-[0.99]">
                                Save Supplier
                            </button>
                            <button type="button" id="cancelEditBtn" 
                                class="hidden w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition border border-slate-700">
                                Cancel Modification
                            </button>
                        </div>
                    </form>
                </section>
            </div>
            <!-- RIGHT PANEL: Live Subcontractor Directory Table & Search Field Area (2 Columns Grid Span) -->
            <div class="lg:col-span-2 space-y-4">
                <section class="space-y-4 flex flex-col bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl w-full">
                     
                     <!-- Live Active Filter Search Bar Layout Wrapper -->
                     <div class="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-row items-center justify-between gap-4 flex-wrap" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important;">
    
    <!-- 1. Left aligned text field layout search input slot -->
    <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important;">
        <input type="text" id="searchInput" 
            class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            placeholder="Search by company name, CR, email...">
        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
    </div>

    <!-- 2. Centered alignment for row tab selector sliders switches -->
    <div class="flex p-1 rounded-xl border border-slate-800 shrink-0 select-none bg-slate-900" style="display: flex !important; flex-direction: row !important;">
        <button type="button" id="filterActiveBtn" onclick="setStatusFilter('Active')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow">
            Active
        </button>
        <button type="button" id="filterInactiveBtn" onclick="setStatusFilter('Inactive')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200">
            Inactive
        </button>
    </div>

    <!-- 3. Right aligned active records counter statistics card badge -->
    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important;">
        Filtered Suppliers: <span id="recordCount" class="text-emerald-400 font-black">0</span>
    </div>
</div>

                     <!-- Dynamic Table Container Layer -->
                     <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col w-full">
                         <div class="overflow-x-auto">
                             <table class="w-full text-left border-collapse min-w-[600px]">
                                 <thead>
                                     <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                         <th class="px-6 py-4">Company Profile</th>
                                         <th class="px-6 py-4">CR Number</th>
                                         <th class="px-6 py-4">Communications Hub</th>
                                         <th class="px-6 py-4">Status</th>
                                         <th class="px-6 py-4 text-right">Actions Pipeline</th>
                                     </tr>
                                 </thead>
                                 <tbody id="supplierTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                                     <!-- Dynamic JavaScript data entry rows target -->
                                 </tbody>
                             </table>
                         </div>
                     </div>
                </section>
            </div>

        </main>
    </div> <!-- Closes global flex wrapper layout -->
    <script>
        const token = localStorage.getItem('token');
        let allSuppliers = [];
        let currentStatusFilter = 'Active';

        if (!token) { window.location.href = "/user/login-page"; }

        async function loadSuppliers() {
            try {
                const res = await fetch('/supplier/all', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                allSuppliers = data.suppliers || [];
                applyGlobalFilters();
            } catch (err) { showAlert(err.message, 'error'); }
        }

        function applyGlobalFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            const filteredDataset = allSuppliers.filter(sup => {
                const matchesStatus = sup.status === currentStatusFilter;
                const matchesSearch = 
                    sup.supplier_name.toLowerCase().includes(searchVal) || 
                    sup.cr_number.includes(searchVal) || 
                    sup.contact_email.toLowerCase().includes(searchVal) ||
                    sup.contact_phone.includes(searchVal);
                return matchesStatus && matchesSearch;
            });
            renderTable(filteredDataset);
        }

        function setStatusFilter(statusType) {
            currentStatusFilter = statusType;
            const activeBtn = document.getElementById('filterActiveBtn');
            const inactiveBtn = document.getElementById('filterInactiveBtn');

            if (statusType === 'Active') {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
            } else {
                activeBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200";
                inactiveBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-rose-600 text-white shadow";
            }
            applyGlobalFilters();
        }

        // FIXED ROW RENDER MATRIX: Uses exact matching inline utility classes as your site page
        function renderTable(arr) {
            const tbody = document.getElementById('supplierTableBody');
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic">No subcontractor records found matching current filtering parameters.</td></tr>`;
                return;
            }

            arr.forEach(sup => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition";
                
                const isSupActive = sup.status === 'Active';
                const badgeStyleClass = isSupActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                
                const actionButtonText = isSupActive ? 'Deactivate' : 'Activate';
                const actionButtonColorClass = isSupActive 
                    ? 'bg-rose-600/10 text-rose-400 border border-rose-500/10 hover:bg-rose-600 hover:text-white' 
                    : 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/10 hover:bg-emerald-600 hover:text-white';

                // Explicit inline Tailwind classes applied to row nodes
                tr.innerHTML = `
                    <td class="px-6 py-4 font-bold text-white tracking-tight">${sup.supplier_name}</td>
                    <td class="px-6 py-4 font-mono text-slate-300">${sup.cr_number}</td>
                    <td class="px-6 py-4">
                        <div class="text-xs text-slate-200">${sup.contact_email}</div>
                        <div class="text-[11px] text-slate-500 font-bold mt-0.5">${sup.contact_phone}</div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-0.5 rounded border border-slate-800 text-[10px] font-bold uppercase ${badgeStyleClass}">
                            ${sup.status}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="populateEdit('${sup._id}')" class="bg-blue-600/10 text-blue-400 border border-blue-500/10 px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition">Edit</button>
                            <button onclick="deactivateSupplier('${sup._id}')" class="${actionButtonColorClass} px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm transition">
                                ${actionButtonText}
                            </button>
                        </div>
                    </td>`;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('supplierForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('supplierId').value;
            const payload = {
                supplier_name: document.getElementById('supplierName').value,
                cr_number: document.getElementById('crNumber').value,
                contact_email: document.getElementById('contactEmail').value,
                contact_phone: document.getElementById('contactPhone').value,
                status: document.getElementById('status').value
            };
            const isEdit = id.length > 0;
            try {
                const res = await fetch(isEdit ? `/supplier/update/${id}` : '/supplier/create', {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
                showAlert(isEdit ? "Profile updated successfully!" : "Supplier company registered successfully!", 'success');
                resetForm(); loadSuppliers();
            } catch (err) { showAlert(err.message, 'error'); }
        });

        function populateEdit(id) {
            const sup = allSuppliers.find(s => s._id === id);
            if (!sup) return;
            document.getElementById('supplierId').value = sup._id;
            document.getElementById('supplierName').value = sup.supplier_name;
            document.getElementById('crNumber').value = sup.cr_number;
            document.getElementById('crNumber').disabled = true;
            document.getElementById('contactEmail').value = sup.contact_email;
            document.getElementById('contactPhone').value = sup.contact_phone;
            document.getElementById('status').value = sup.status;
            
            document.getElementById('formTitle').innerText = "✏️ Modify Corporate Profile";
            document.getElementById('submitBtn').innerText = "Update Profile";
            document.getElementById('submitBtn').className = "flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
        }

        async function deactivateSupplier(id) {
            if (!confirm("Are you sure you want to alter this contractor operational profile status indicator?")) return;
            try {
                const res = await fetch(`/supplier/delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showAlert(data.message || "Status altered successfully.", 'success'); 
                loadSuppliers();
            } catch (err) { showAlert(err.message, 'error'); }
        }

        document.getElementById('searchInput').addEventListener('input', applyGlobalFilters);

        function resetForm() {
            document.getElementById('supplierForm').reset();
            document.getElementById('supplierId').value = "";
            document.getElementById('crNumber').disabled = false;
            document.getElementById('formTitle').innerText = "🤝 Register Subcontractor";
            document.getElementById('submitBtn').innerText = "Save Supplier";
            document.getElementById('submitBtn').className = "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10";
            document.getElementById('cancelEditBtn').classList.add('hidden');
        }
        document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

        // UNIVERSAL OVERLAY TOAST POPUP DISPATCH PIPELINE
function showAlert(msg, type) {
    const sb = document.getElementById('statusBox');
    if (!sb) return;

    // 1. Inject server notification textual data strings
    sb.innerText = msg;

    // 2. Clear previous themes and apply matching background colors
    if (type === 'success' || type === 'status-success') {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#34d399';
        sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    } else {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#f87171';
        sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    }

    // 3. Trigger css pop-up animations entry states
    sb.classList.remove('hidden', 'scale-95', 'opacity-0');
    sb.classList.add('scale-100', 'opacity-100');

    // 4. Close the popup cleanly after a 3-second cycle run duration interval
    setTimeout(() => {
        sb.classList.remove('scale-100', 'opacity-100');
        sb.classList.add('scale-95', 'opacity-0');
        
        // Wait for the exit animation transition to complete before hiding the container node completely
        setTimeout(() => {
            sb.classList.add('hidden');
        }, 300);
    }, 3000);
}


        loadSuppliers();
    </script>
</body>
</html>


==================================================
FILE: .\views\manage_users.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Identity Access Directory</title>
    <!-- Tailwind CSS Runtime CDN Engine Wrapper -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0">

    <!-- UNIFIED FLOATING OVERLAY TOAST NOTICE CONTAINER -->
    <div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0" style="min-width: 22rem; pointer-events: none;"></div>

    <!-- Master Application View Stack Header Layout Panel Row -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 shadow-lg w-full shrink-0">
            <div class="max-w-7xl mx-auto flex justify-between items-center w-full">
                <div>
                    <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>SAS_SUBCON</span>
                        <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">System Admin</span>
                    </h1>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Identity & Access Management (IAM) Identity Directory</p>
                </div>
                <button onclick="handleSystemLogout()" class="bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700 shadow-md active:scale-[0.98]">
                    Disconnect Session
                </button>
            </div>
        </header>

        <!-- MAIN LAYOUT MATRIX COMPONENT SECTION -->
        <main class="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT PANEL: REGISTER USER CONTEXT CARD COMPONENT -->
            <section class="lg:col-span-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div class="mb-4">
                    <h3 class="text-lg font-black text-white flex items-center gap-2">🔑 Provision Account</h3>
                    <p class="text-xs text-slate-400 mt-1">Register corporate credentials, authorize system privileges, and link operations scopes.</p>
                </div>

                <form id="userProvisionForm" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Personnel Name</label>
                        <input type="text" id="name" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="e.g. Salim Al Rahbi">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Corporate Email Address</label>
                        <input type="email" id="email" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="username@company.com">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Security Password</label>
                        <input type="password" id="password" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="••••••••">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">GSM Contact Cell Number</label>
                        <input type="text" id="cell_number" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="e.g. 99445566">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Privilege Operational Role</label>
                        <select id="role" required onchange="handleRoleContextShifting()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                            <option value="" disabled selected>Select Authorization Role...</option>
                            <option value="HO">🏢 HO (Head Office Operations)</option>
                            <option value="SITE_HSE">🛡️ SITE_HSE (Safety Clearance Team)</option>
                            <option value="SITE_MEDIC">🩺 SITE_MEDIC (Medical Clearance Team)</option>
                            <option value="SITE_MANAGER">🫅 SITE_MANAGER (Site Admin Checker)</option>
                            <option value="SUPPLIER">🏭 SUPPLIER (Subcontractor Coordinator)</option>
                            <option value="ERP_TEAM">💻 ERP_TEAM (Core Audit Administrator)</option>
                        </select>
                    </div>
                    <!-- DYNAMIC SITE ALLOCATION WRAPPER (Hidden by default) -->
                    <div id="site_allocation_wrapper" style="display: none;">
                        <label class="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">Assigned Target Camp Site</label>
                        <select id="site_id" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                            <option value="" disabled selected>Select Camp Location...</option>
                        </select>
                    </div>

                    <!-- DYNAMIC SUPPLIER ALLOCATION WRAPPER (Hidden by default) -->
                    <div id="supplier_allocation_wrapper" style="display: none;">
                        <label class="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">Linked Supplier Corporate Tenant</label>
                        <select id="supplier_id" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none transition">
                            <option value="" disabled selected>Select Supplier Firm...</option>
                        </select>
                    </div>

                    <div class="pt-2">
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-[0.99]">
                            Provision User Account
                        </button>
                    </div>
                </form>
            </section>

            <!-- RIGHT PANEL: HORIZONTAL SEARCH AND SYSTEM DATA GRIDS DIRECTORY -->
            <section class="lg:col-span-8 space-y-4 flex flex-col items-stretch w-full h-full">
                
                <!-- FIXED HORIZONTAL FILTER BAR DECK (CRASH INLINE OVERRIDES APPLIED) -->
                <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl w-full" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important;">
                    <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important; margin: 0 !important; max-width: 18rem !important; width: 100% !important;">
                        <input type="text" id="searchInput" oninput="applyDirectoryFilters()" class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="Search users by name, email, role...">
                        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
                    </div>

                    <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none" style="display: flex !important; flex-direction: row !important; gap: 4px !important; margin: 0 !important; align-items: center !important;">
                        <button type="button" id="tabAllBtn" onclick="setUserStatusTabFilter('ALL')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition bg-emerald-600 text-white shadow border-none">All Accounts</button>
                        <button type="button" id="tabActiveBtn" onclick="setUserStatusTabFilter('Active')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">Active</button>
                        <button type="button" id="tabInactiveBtn" onclick="setUserStatusTabFilter('Inactive')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">Suspended</button>
                    </div>

                    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important; margin: 0 !important;">
                        Users Count: <span id="recordCount" class="text-emerald-400 font-black">0</span>
                    </div>
                </div>

                <!-- MASTER DATA TABLE CONTAINER -->
                <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col w-full">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <th class="px-5 py-4">User Profile</th>
                                    <th class="px-5 py-4">Operational Privileges</th>
                                    <th class="px-5 py-4">Assigned Allocation</th>
                                    <th class="px-5 py-4">System Switch</th>
                                </tr>
                            </thead>
                            <tbody id="userTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                                <!-- JavaScript paint loop row target -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>
    </div>
    <!-- Master Execution Script: Orchestrates IAM data transaction pipelines -->
    <script>
        const token = localStorage.getItem('token');
        let masterUsersDataset = [];
        let currentStatusFilter = 'ALL';

        // Security session perimeter validation gate check
        if (!token) { window.location.href = "/user/login-page"; }

        // CONTEXT-SHIFTING CONTROLLER: Toggle layout visibility matching role selections
        function handleRoleContextShifting() {
            const role = document.getElementById('role').value;
            const siteWrapper = document.getElementById('site_allocation_wrapper');
            const subWrapper = document.getElementById('supplier_allocation_wrapper');
            const siteInput = document.getElementById('site_id');
            const subInput = document.getElementById('supplier_id');

            siteInput.required = false;
            subInput.required = false;

            if (role === 'SUPPLIER') {
                siteWrapper.style.display = 'none';
                subWrapper.style.display = 'block';
                subInput.required = true;
            } else if (['SITE_HSE', 'SITE_MEDIC', 'SITE_MANAGER'].includes(role)) {
                siteWrapper.style.display = 'block';
                subWrapper.style.display = 'none';
                siteInput.required = true;
            } else {
                siteWrapper.style.display = 'none';
                subWrapper.style.display = 'none';
            }
        }

        // DEPENDENCY INJECTORS: Fetches plural collections and populates select tags natively
        async function fetchSitesDropdownCatalog() {
            const selector = document.getElementById('site_id');
            if (!selector) return;
            try {
                const res = await fetch('/site/all', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                const arraySource = data.sites || [];
                selector.innerHTML = '<option value="" disabled selected>Select Camp Location...</option>';
                arraySource.forEach(site => {
                    if (site.status !== 'Inactive') {
                        const opt = document.createElement('option');
                        opt.value = site._id;
                        opt.innerText = `📍 ${site.site_name.toUpperCase()} [${site.location}]`;
                        selector.appendChild(opt);
                    }
                });
            } catch (err) { console.error("Error populating camp selectors:", err.message); }
        }

        async function fetchSuppliersDropdownCatalog() {
            const selector = document.getElementById('supplier_id');
            if (!selector) return;
            try {
                const res = await fetch('/supplier/all', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                const arraySource = data.suppliers || [];
                selector.innerHTML = '<option value="" disabled selected>Select Supplier Firm...</option>';
                arraySource.forEach(sup => {
                    if (sup.status !== 'Inactive') {
                        const opt = document.createElement('option');
                        opt.value = sup._id;
                        opt.innerText = `🏭 ${sup.supplier_name.toUpperCase()}`;
                        selector.appendChild(opt);
                    }
                });
            } catch (err) { console.error("Error populating supplier selectors:", err.message); }
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // READ/WRITE TRANSACTIONS DIRECTORY CHANNELS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        async function loadMasterUsersDirectory() {
            try {
                const res = await fetch('/user/all', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                masterUsersDataset = data.users || [];
                applyDirectoryFilters();
            } catch (err) { showAlert(err.message, "error"); }
        }

        document.getElementById('userProvisionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                role: document.getElementById('role').value,
                cell_number: document.getElementById('cell_number').value,
                site_id: document.getElementById('site_id').value || "",
                supplier_id: document.getElementById('supplier_id').value || ""
            };

            try {
                const res = await fetch('/user/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                showAlert("Personnel identity credentials provisioned successfully into core indexes!", "success");
                document.getElementById('userProvisionForm').reset();
                handleRoleContextShifting();
                loadMasterUsersDirectory();
            } catch (err) { showAlert(err.message, "error"); }
        });

        async function toggleAccountOperationalState(id) {
            try {
                const res = await fetch(`/user/toggle-status/${id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                showAlert("User system access rules updated successfully!", "success");
                loadMasterUsersDirectory();
            } catch (err) { showAlert(err.message, "error"); }
        }

        // FILTERING & TAB NAVIGATION BAR HANDLERS
        function applyDirectoryFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            const filtered = masterUsersDataset.filter(user => {
                const normalizedStatus = (user.status || 'Active').trim();
                const tabMatch = (currentStatusFilter === 'ALL') || (normalizedStatus === currentStatusFilter);
                
                const searchMatch = 
                    user.name.toLowerCase().includes(searchVal) ||
                    user.email.toLowerCase().includes(searchVal) ||
                    user.role.toLowerCase().includes(searchVal) ||
                    user.cell_number.includes(searchVal);

                return tabMatch && searchMatch;
            });

            renderUserGridTable(filtered);
        }

        function setUserStatusTabFilter(stateType) {
            currentStatusFilter = stateType;
            const tAll = document.getElementById('tabAllBtn');
            const tAct = document.getElementById('tabActiveBtn');
            const tIna = document.getElementById('tabInactiveBtn');

            if (tAll) tAll.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (stateType === 'ALL' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tAct) tAct.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (stateType === 'Active' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tIna) tIna.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (stateType === 'Inactive' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");

            applyDirectoryFilters();
        }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM RENDERING ENGINE: DRAW DATA TABLE ROW NODES WITH ACTIONABLE TRIGGERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function renderUserGridTable(arr) {
            const tbody = document.getElementById('userTableBody');
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-12 text-center text-slate-500 italic text-xs">No personnel identity profiles found matching active search properties.</td></tr>`;
                return;
            }

            arr.forEach(user => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition";

                // Resolve relational joins safely
                let allocationText = `<span class="text-slate-500 italic font-medium">Global Corporate Scope</span>`;
                if (user.role === 'SUPPLIER' && user.supplier_id) {
                    allocationText = `🏭 <span class="font-bold text-slate-300 capitalize">${user.supplier_id.supplier_name}</span>`;
                } else if (user.site_id) {
                    allocationText = `📍 <span class="font-bold text-slate-300 capitalize">${user.site_id.site_name}</span> <span class="text-slate-500">(${user.site_id.location})</span>`;
                }

                // 🌟 CORRECTION FIXED: Inverts the button markup to show actionable triggers instead of static status!
                let toggleBtnMarkup = '';
                if (user.status === 'Active') {
                    // Account is open -> show a red "SUSPEND" action layout option button trigger
                    toggleBtnMarkup = `<button onclick="toggleAccountOperationalState('${user._id}')" class="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[10px] transition border-none shadow-sm active:scale-95">Suspend</button>`;
                } else {
                    // Account is blocked -> show a green "ACTIVATE" action layout option button trigger
                    toggleBtnMarkup = `<button onclick="toggleAccountOperationalState('${user._id}')" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[10px] transition border-none shadow-sm active:scale-95">Activate</button>`;
                }

                // Generate clean visual badge markers for your information profile column status tracking card row
                const statusMarkerBadge = user.status === 'Active'
                    ? `<span class="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Online</span>`
                    : `<span class="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Suspended</span>`;

                tr.innerHTML = `
                    <td class="px-5 py-4">
                        <div class="flex items-center gap-2 flex-wrap">
                            <div class="font-black text-white text-xs uppercase tracking-wide">${user.name}</div>
                            ${statusMarkerBadge}
                        </div>
                        <div class="font-mono text-[10px] text-slate-500 font-medium mt-0.5">${user.email}</div>
                    </td>
                    <td class="px-5 py-4">
                        <span class="px-2 py-0.5 rounded border text-[10px] font-extrabold uppercase bg-slate-900 text-slate-300 border-slate-800 tracking-wider">${user.role}</span>
                        <div class="text-[10px] text-slate-500 font-mono mt-1 font-bold">📲 GSM: ${user.cell_number}</div>
                    </td>
                    <td class="px-5 py-4 text-xs font-semibold">${allocationText}</td>
                    <td class="px-5 py-4">${toggleBtnMarkup}</td>
                `;
                tbody.appendChild(tr);
            });
        }


        // UNIVERSAL POPUP TOAST SYSTEM & DEACTIVATION CONTROLS
        function showAlert(msg, type) {
            const sb = document.getElementById('statusBox'); if (!sb) return;
            sb.innerText = msg;
            if (type === 'success') {
                sb.style.backgroundColor = '#020617'; sb.style.color = '#34d399'; sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
            } else {
                sb.style.backgroundColor = '#020617'; sb.style.color = '#f87171'; sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
            }
            sb.classList.remove('hidden', 'scale-95', 'opacity-0'); sb.classList.add('scale-100', 'opacity-100');
            setTimeout(() => {
                sb.classList.remove('scale-100', 'opacity-100'); sb.classList.add('scale-95', 'opacity-0');
                setTimeout(() => { sb.classList.add('hidden'); }, 300);
            }, 3000);
        }

        async function handleSystemLogout() {
            if (!confirm("Safely terminate your identity access management session?")) return;
            try { await fetch('/user/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } 
            catch (err) { console.error(err.message); }
            finally { localStorage.clear(); window.location.href = "/user/login-page"; }
        }

        async function initializeManagementConsole() {
            await Promise.all([fetchSitesDropdownCatalog(), fetchSuppliersDropdownCatalog()]);
            loadMasterUsersDirectory();
        }

        initializeManagementConsole();
    </script>
</body>
</html>


==================================================
FILE: .\views\medic_dashboard.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Medical Evaluation Deck</title>
    <!-- Tailwind CSS Runtime CDN Engine Wrapper -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0">

    <!-- 🌟 UNIFIED FLOATING OVERLAY TOAST NOTICE CONTAINER -->
    <div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0" style="min-width: 22rem; pointer-events: none;"></div>
    <!-- MAIN EVALUATION PROCESSING MODAL DIALOG (Hidden by default) -->
    <div id="evaluationModal" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 transition-all duration-200">
        <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 transform scale-100 transition-all">
            <div class="flex justify-between items-center border-b border-slate-800/60 pb-3">
                <h3 class="text-md font-black text-white flex items-center gap-2">🩺 Process Health Clearance</h3>
                <button type="button" onclick="closeEvaluationModal()" class="text-slate-500 hover:text-slate-300 text-sm font-bold bg-slate-950 px-2 py-1 rounded-lg transition border border-slate-800">ESC</button>
            </div>
            
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/40 space-y-1">
                <div class="text-xs text-slate-400 font-medium">Evaluating Field Personnel:</div>
                <div id="modalWorkerName" class="text-sm font-black text-emerald-400 uppercase tracking-wide">--</div>
                <div id="modalCivilId" class="text-[10px] text-slate-500 font-mono font-bold">--</div>
            </div>

            <form id="medicReviewForm" class="space-y-4">
                <input type="hidden" id="targetRequestId">
                
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Evaluation Assessment Review Notes</label>
                    <textarea id="medic_notes" required rows="3" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none placeholder-slate-600" placeholder="Type internal clinical checking annotations or outline required corrections..."></textarea>
                </div>

                <div class="grid grid-cols-2 gap-4 pt-2">
                    <button type="button" onclick="submitMedicDecision('Approved')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-95 border-none">
                        Pass Medical
                    </button>
                    <button type="button" onclick="submitMedicDecision('Resubmit for Medic')" class="w-full bg-rose-600/20 hover:bg-rose-600 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition active:scale-95">
                        Order Resubmit
                    </button>
                </div>
            </form>
        </div>
    </div>
    <!-- Master Application View Stack Header Layout Panel Row -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 shadow-lg w-full shrink-0">
            <div class="max-w-7xl mx-auto flex justify-between items-center w-full">
                <div>
                    <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>SAS_SUBCON</span>
                        <span class="text-xs bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">Site Clinic</span>
                    </h1>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Medical Officer Verification Command Cockpit & Deployment Desk</p>
                </div>
                <button type="button" onclick="handleSystemLogout()" class="bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700 shadow-md active:scale-[0.98]">
                    Disconnect Session
                </button>
            </div>
        </header>

        <!-- MAIN LAYOUT SPACE -->
        <main class="flex-1 w-full max-w-7xl mx-auto p-6 space-y-4 flex flex-col items-stretch">
            
            <!-- HIGH-UTILITY SEARCH BAR AND DYNAMIC URGENCY SEGMENTATION DECK -->
            <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-4 w-full flex flex-col">
                <div style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important;">
                    
                    <!-- Keyword Text Input Selector -->
                    <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important; margin: 0 !important; max-width: 16rem !important; width: 100% !important;">
                        <input type="text" id="searchInput" oninput="applyMedicFilters()" class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Search by name, civil ID...">
                        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
                    </div>

                    <!-- STATUS ROUTING TABS: Displays verified documents history streams -->
                    <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none" style="display: flex !important; flex-direction: row !important; gap: 4px !important; margin: 0 !important; align-items: center !important;">
                        <button type="button" id="tabPendingBtn" onclick="setMedicStatusTab('Pending')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition bg-blue-600 text-white shadow border-none">Pending Queue</button>
                        <button type="button" id="tabApprovedBtn" onclick="setMedicStatusTab('Approved')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">Cleared Pass</button>
                        <button type="button" id="tabResubmitBtn" onclick="setMedicStatusTab('Resubmit')" class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">Corrections</button>
                    </div>

                    <!-- Urgency Processing Filter Tabs Matrix -->
                    <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none" style="display: flex !important; flex-direction: row !important; gap: 4px !important; margin: 0 !important; align-items: center !important;">
                        <button type="button" id="urgAllBtn" onclick="setUrgencyTabFilter('ALL')" class="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition bg-slate-800 text-white shadow border-none">All Tiers</button>
                        <button type="button" id="urgNormalBtn" onclick="setUrgencyTabFilter('Normal')" class="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">Normal</button>
                        <button type="button" id="urgUrgentBtn" onclick="setUrgencyTabFilter('Urgent')" class="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">🚨 Urgent</button>
                        <button type="button" id="urgCriticalBtn" onclick="setUrgencyTabFilter('Critical Emergency')" class="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition text-slate-400 hover:text-slate-200 border-none">🔥 Critical</button>
                    </div>

                    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important; margin: 0 !important;">
                        Records Displayed: <span id="recordCount" class="text-blue-400 font-black">0</span>
                    </div>
                </div>
            </div>
            <!-- ADMINISTRATIVE RECORDS VIEW DIR GRID CONTAINER -->
            <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col w-full">
                <div class="overflow-x-auto w-full">
                    <table class="w-full text-left border-collapse min-w-[850px]">
                        <thead>
                            <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                <th class="px-6 py-4">Bio Profile Details</th>
                                <th class="px-6 py-4">Contractor & Allocation</th>
                                <th class="px-6 py-4 text-center">Priority Scope</th>
                                <th class="px-6 py-4 text-center">Verification Targets</th>
                                <th class="px-6 py-4 text-center">Action Gateway</th>
                            </tr>
                        </thead>
                        <tbody id="medicTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                            <!-- JavaScript rows paint cleanly here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
    <script>
        const token = localStorage.getItem('token');
        let pendingMobilizationsDataset = [];
        let currentMedicTabFilter = 'Pending';
        let selectedUrgencyFilter = 'ALL';

        // Perimeter security gateway checking run
        if (!token) { window.location.href = "/user/login-page"; }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // READ PIPELINES: STREAM ACTIVE MOBILIZATIONS UNRESTRICTED FOR TAB SORTING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        async function fetchActiveMedicReviewQueue() {
            try {
                const res = await fetch('/admin-review/medic/pending', { 
                    method: 'GET', 
                    headers: { 'Authorization': `Bearer ${token}` } 
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                pendingMobilizationsDataset = data.requests || [];
                applyMedicFilters();
            } catch (err) { showAlert(err.message, "error"); }
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MULTI-FILTER SIFT ENGINE: SEPARATES STATUSES CASE-INSENSITIVELY NATIVELY
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function applyMedicFilters() {
            const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
            
            const filtered = pendingMobilizationsDataset.filter(req => {
                // 1. Resolve Multi-Gate Status parameters matching case-insensitively
                const medStatus = (req.medical_status || "Pending").trim();
                let tabMatch = false;

                if (currentMedicTabFilter === 'Pending') {
                    tabMatch = medStatus === 'Pending' || medStatus === null || medStatus === undefined;
                } else if (currentMedicTabFilter === 'Approved') {
                    tabMatch = medStatus === 'Approved';
                } else if (currentMedicTabFilter === 'Resubmit') {
                    tabMatch = medStatus === 'Resubmit';
                }

                // 2. Resolve Urgency priority level parameters matching bounds
                const urgencyMatch = (selectedUrgencyFilter === 'ALL') || (req.urgency === selectedUrgencyFilter);
                
                // 3. Resolve keyword text string lookup parameters query matching values
                const empName = (req.employee_name || "").toLowerCase();
                const civilId = (req.civil_id || "");
                const subconName = req.sub_company_id && req.sub_company_id.supplier_name ? req.sub_company_id.supplier_name.toLowerCase() : "";
                const tradeTitle = req.designation_id && req.designation_id.title ? req.designation_id.title.toLowerCase() : "";

                const searchMatch = empName.includes(searchVal) || civilId.includes(searchVal) || subconName.includes(searchVal) || tradeTitle.includes(searchVal);

                return tabMatch && urgencyMatch && searchMatch;
            });

            renderMedicGridTable(filtered);
        }

        function setMedicStatusTab(tabType) {
            currentMedicTabFilter = tabType;
            const tPen = document.getElementById('tabPendingBtn');
            const tApp = document.getElementById('tabApprovedBtn');
            const tRes = document.getElementById('tabResubmitBtn');

            if (tPen) tPen.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Pending' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tApp) tApp.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Approved' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tRes) tRes.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Resubmit' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200");

            applyMedicFilters();
        }

        function setUrgencyTabFilter(urgencyType) {
            selectedUrgencyFilter = urgencyType;
            const tAll = document.getElementById('urgAllBtn');
            const tNorm = document.getElementById('urgNormalBtn');
            const tUrg = document.getElementById('urgUrgentBtn');
            const tCrit = document.getElementById('urgCriticalBtn');

            if (tAll) tAll.className = "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition border-none " + (urgencyType === 'ALL' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tNorm) tNorm.className = "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition border-none " + (urgencyType === 'Normal' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tUrg) tUrg.className = "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition border-none " + (urgencyType === 'Urgent' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tCrit) tCrit.className = "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition border-none " + (urgencyType === 'Critical Emergency' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200");

            applyMedicFilters();
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DOM ROW WRITER PANEL: ALIGNS ITEMS HORIZONTALLY AND FORMATS TIMESTAMPS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function renderMedicGridTable(arr) {
            const tbody = document.getElementById('medicTableBody');
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic text-xs">No personnel records currently pending clinical review checks under this parameter.</td></tr>`;
                return;
            }

            arr.forEach(req => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition items-center";

                let urgencyBadge = 'bg-slate-800 text-slate-400 border-slate-700';
                if (req.urgency === 'Urgent') urgencyBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-black';
                else if (req.urgency && req.urgency.includes('Critical')) urgencyBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-black animate-pulse';

                const creationDateRaw = req.createdAt ? new Date(req.createdAt) : new Date();
                const formattedSubmissionDate = creationDateRaw.toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                const subName = req.sub_company_id ? (req.sub_company_id.supplier_name || 'Direct Subcon') : 'Direct Subcon';
                const destSite = req.target_site_id ? (req.target_site_id.site_name || 'Base Site') : 'Base Site';
                const tradeRole = req.designation_id ? (req.designation_id.title || 'Expatriate Labor') : 'Expatriate Labor';

                let wqtMarkup = '';
                if (req.wqt_file_url) {
                    wqtMarkup = `<a href="${req.wqt_file_url}" target="_medic_view" class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold tracking-wide hover:bg-rose-600 hover:text-white transition">WQT Card</a>`;
                }

                // Conditional decision button locks depending on gate states
                let actionCellMarkup = `<span class="text-emerald-400 font-extrabold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 uppercase tracking-wide select-none">Passed</span>`;
                
                if (req.medical_status === 'Resubmit') {
                    actionCellMarkup = `<span class="text-rose-400 font-extrabold bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 uppercase tracking-wide select-none">Rejected</span>`;
                } else if (req.medical_status === 'Pending' || !req.medical_status) {
                    actionCellMarkup = `
                        <button onclick="openEvaluationModal('${req._id}', '${req.employee_name.replace(/'/g, "\\'")}', '${req.civil_id}')" class="bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2 rounded-xl uppercase tracking-wider text-[10px] transition border-none shadow-md shadow-blue-600/10 active:scale-95">
                            Evaluate
                        </button>`;
                }

                tr.innerHTML = `
                    <td class="px-6 py-4 vertical-align-middle">
                        <div class="font-black text-white text-xs uppercase tracking-wide">${req.employee_name}</div>
                        <div class="font-mono text-[10px] text-slate-500 font-bold mt-0.5">CIVIL: ${req.civil_id} (${req.nationality || 'Expat'})</div>
                        <div class="text-[10px] text-slate-400 font-medium mt-1">🎂 DOB: ${req.dob ? new Date(req.dob).toLocaleDateString('en-GB') : '--'}</div>
                        <div class="text-[10px] text-blue-400/80 font-semibold mt-1.5 flex items-center gap-1">
                            📅 Logged: <span class="text-slate-300 font-mono">${formattedSubmissionDate}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 vertical-align-middle">
                        <div class="text-xs font-extrabold text-slate-300 capitalize">${tradeRole}</div>
                        <div class="text-[10px] text-slate-500 font-bold mt-0.5">🏭 Firm: ${subName.toUpperCase()}</div>
                        <div class="text-[10px] text-slate-400 font-semibold mt-1">📍 Dest: ${destSite.toUpperCase()} (Bed: ${req.accommodation_type || '--'})</div>
                    </td>
                    <td class="px-6 py-4 text-center vertical-align-middle" style="text-align: center !important;">
                        <div class="inline-flex justify-center items-center w-full">
                            <span class="px-2.5 py-1 rounded-xl border text-[10px] uppercase font-black tracking-wider ${urgencyBadge} select-none">
                                ${req.urgency || 'Normal'}
                            </span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center vertical-align-middle" style="text-align: center !important;">
                        <div class="flex gap-1.5 justify-center items-center flex-wrap w-full">
                            <a href="${req.medical_file_url}" target="_medic_view" class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-xl font-black tracking-wide hover:bg-blue-600 hover:text-white transition text-[10px] border-none">Medical PDF</a>
                            ${wqtMarkup}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center vertical-align-middle" style="text-align: center !important;">
                        <div class="inline-flex justify-center items-center w-full">
                            ${actionCellMarkup}
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TRANSACTION DISPATCHERS: SAVES NOTES AND CLOSES MODALS CLEANLY
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function openEvaluationModal(id, name, civilId) {
            document.getElementById('targetRequestId').value = id;
            document.getElementById('modalWorkerName').innerText = name;
            document.getElementById('modalCivilId').innerText = `CIVIL ID PARAMETER REFERENCE: ${civilId}`;
            document.getElementById('medic_notes').value = '';
            
            const modal = document.getElementById('evaluationModal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeEvaluationModal() {
            const modal = document.getElementById('evaluationModal');
            if (modal) modal.classList.add('hidden');
        }

        async function submitMedicDecision(decisionValue) {
            const requestId = document.getElementById('targetRequestId').value;
            const comments = document.getElementById('medic_notes').value.trim();

            if (!comments) {
                showAlert("Clinical evaluation notes are mandatory fields.", "error");
                return;
            }

            try {
                const res = await fetch('/admin-review/medic/evaluate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ requestId, decision: decisionValue, comments })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                showAlert(`Clinical verdict logged successfully! Status marked as: ${decisionValue}`, "success");
                closeEvaluationModal();
                await fetchActiveMedicReviewQueue(); 
            } catch (err) { showAlert(err.message, "error"); }
        }

        function showAlert(msg, type) {
            const sb = document.getElementById('statusBox'); if (!sb) return;
            sb.innerText = msg;
            if (type === 'success') {
                sb.style.backgroundColor = '#020617'; sb.style.color = '#34d399'; sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
            } else {
                sb.style.backgroundColor = '#020617'; sb.style.color = '#f87171'; sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
            }
            sb.classList.remove('hidden', 'scale-95', 'opacity-0'); sb.classList.add('scale-100', 'opacity-100');
            setTimeout(() => {
                sb.classList.remove('scale-100', 'opacity-100'); sb.classList.add('scale-95', 'opacity-0');
                setTimeout(() => { sb.classList.add('hidden'); }, 300);
            }, 3000);
        }

        async function handleSystemLogout() {
            localStorage.clear(); window.location.href = "/user/login-page";
        }

        // Initialize queue logs instantly upon execution
        fetchActiveMedicReviewQueue();
    </script>
</body>
</html>


==================================================
FILE: .\views\request_details.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Applicant Verification File</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0">

    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 shadow-lg w-full shrink-0">
            <div class="max-w-7xl mx-auto flex justify-between items-center w-full">
                <div>
                    <h1 class="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <button onclick="window.history.back()" class="bg-slate-900 border border-slate-800 text-slate-400 font-bold px-3 py-1.5 text-xs rounded-xl hover:text-white transition">◀ Back to Portal</button>
                        <span>SAS_SUBCON Personnel Profile File</span>
                    </h1>
                </div>
                <div id="globalLifecycleStatusBadge" class="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 font-black uppercase tracking-wider rounded-xl select-none">Under Review</div>
            </div>
        </header>

        <!-- MAIN OVERVIEW CONTAINER SPACE -->
        <main class="flex-1 w-full max-w-7xl mx-auto p-6 space-y-6 flex flex-col items-stretch">
            
            <!-- BIOMETRIC DATA CARDS GRID PANEL ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                
                <!-- ACCOUNT PROFILE PANEL CONTAINER -->
                <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-1.5">👤 Worker Profile Registry</h3>
                    <div class="space-y-3 text-xs">
                        <div><span class="text-slate-500 font-semibold block uppercase">Employee Name:</span> <span id="lbl_worker_name" class="text-sm font-black text-white uppercase tracking-wide">--</span></div>
                        <div><span class="text-slate-500 font-semibold block uppercase">Oman Civil ID:</span> <span id="lbl_civil_id" class="font-mono text-slate-200 font-bold">--</span></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><span class="text-slate-500 font-semibold block uppercase">Nationality:</span> <span id="lbl_nationality" class="font-semibold text-slate-300">--</span></div>
                            <div><span class="text-slate-500 font-semibold block uppercase">Date of Birth:</span> <span id="lbl_dob" class="font-mono font-semibold text-slate-300">--</span></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><span class="text-slate-500 font-semibold block uppercase">Mobile GSM:</span> <span id="lbl_mobile" class="font-mono font-semibold text-slate-300">--</span></div>
                            <div><span class="text-slate-500 font-semibold block uppercase">Civil Expiry:</span> <span id="lbl_civil_expire" class="font-mono font-semibold text-slate-300">--</span></div>
                        </div>
                    </div>
                </div>

                <!-- ALLOCATION SCALES COMPLIANCE CARD CONTAINER -->
                <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-1.5">🗺️ Logistics & Site Allocation Scope</h3>
                    <div class="space-y-3 text-xs">
                        <div><span class="text-slate-500 font-semibold block uppercase">Trade Designation:</span> <span id="lbl_designation" class="text-sm font-bold text-emerald-400 capitalize">--</span></div>
                        <div><span class="text-slate-500 font-semibold block uppercase">Target Camp Site Destination:</span> <span id="lbl_site" class="font-semibold text-slate-200">--</span></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><span class="text-slate-500 font-semibold block uppercase">Housing Bed:</span> <span id="lbl_lodging" class="font-mono font-black text-slate-300">--</span></div>
                            <div><span class="text-slate-500 font-semibold block uppercase">Priority Tier:</span> <span id="lbl_urgency" class="font-bold text-slate-300">--</span></div>
                        </div>
                        <div><span class="text-slate-500 font-semibold block uppercase">Visa Sponsor Company Link:</span> <span id="lbl_sponsor" class="font-semibold text-slate-300">--</span></div>
                    </div>
                </div>

                <!-- INDEPENDENT EVALUATION PRIVILEGE GATES DISPLAY CARD -->
                <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-1.5">🛡️ Privilege Gates Clearance Metrics</h3>
                    <div class="space-y-4 text-xs flex flex-col justify-center">
                        <div class="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800/60">
                            <div><span class="font-bold text-slate-300">🩺 Site Clinic Medical Status:</span><div id="lbl_medic_comment" class="text-[10px] text-slate-500 font-medium mt-0.5">--</div></div>
                            <span id="badge_medic_gate" class="px-2 py-0.5 font-black text-[10px] uppercase rounded border">Pending</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800/60">
                            <div><span class="font-bold text-slate-300">🛡️ HSE Safety Induction Status:</span><div id="lbl_hse_comment" class="text-[10px] text-slate-500 font-medium mt-0.5">--</div></div>
                            <span id="badge_hse_gate" class="px-2 py-0.5 font-black text-[10px] uppercase rounded border">Pending</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800/60">
                            <div><span class="font-bold text-slate-300">🛠️ Welder Qualification (WQT):</span><div id="lbl_wqt_comment" class="text-[10px] text-slate-500 font-medium mt-0.5">--</div></div>
                            <span id="badge_wqt_gate" class="px-2 py-0.5 font-black text-[10px] uppercase rounded border">Pending</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COMPLIANCE BINARY ATTACHMENTS VIEW CARDS ROW -->
            <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-3">
                <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-900 pb-2">📄 Uploaded Compliance Certificate Documents</h3>
                <div class="flex items-center gap-3 flex-wrap">
                    <a id="btn_view_medical" href="#" target="_id_view" class="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition">📄 Review Fit-For-Duty Medical PDF</a>
                    <a id="btn_view_hse" href="#" target="_id_view" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition">📄 Review Safety Induction PDF</a>
                    <a id="btn_view_wqt" href="#" target="_id_view" class="hidden bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs transition">📄 Review Welder WQT PDF</a>
                </div>
            </div>
            <!-- CHRONOLOGICAL HISTORY TIMELINE PANEL DECK BLOCK (BOTTOM FUNCTIONAL ALIGNMENT) -->
            <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-stretch space-y-4">
                <div class="border-b border-slate-900 pb-3 flex justify-between items-center">
                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <span>⏱️ Audit Submission History Log Timeline</span>
                    </h3>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Read-Only Automated Tracking Ledger</span>
                </div>

                <!-- Live Historical Activity List Paint Target Row -->
                <div id="timelineLogsContainer" class="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    <!-- JavaScript dynamically writes horizontal history cards here -->
                </div>
            </div>
        </main>
    </div>

    <!-- Script Orchestrator: Pulls, compiles, and frames relational histories instantly -->
    <script>
        const activeToken = localStorage.getItem('token');
        const activeRequestId = "<%= requestId %>"; // Injected safely from backend express view router params

        if (!activeToken) { window.location.href = "/user/login-page"; }

        async function initializeRequestDetailedConsole() {
            try {
                // Fetch the expanded populated payload profile row matrix
                const res = await fetch(`/mobilization/request-context/${activeRequestId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${activeToken}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                const req = data.request;

                // 1. Map static text biometric data fields
                document.getElementById('lbl_worker_name').innerText = req.employee_name;
                document.getElementById('lbl_civil_id').innerText = req.civil_id;
                document.getElementById('lbl_nationality').innerText = req.nationality;
                document.getElementById('lbl_dob').innerText = new Date(req.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                document.getElementById('lbl_mobile').innerText = req.mobile_number;
                document.getElementById('lbl_civil_expire').innerText = new Date(req.civil_expire).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                
                document.getElementById('lbl_designation').innerText = req.designation_id ? req.designation_id.title : 'Expatriate Labor';
                document.getElementById('lbl_site').innerText = req.target_site_id ? `${req.target_site_id.site_name.toUpperCase()} (${req.target_site_id.location})` : 'Global Core';
                document.getElementById('lbl_lodging').innerText = req.accommodation_type;
                document.getElementById('lbl_urgency').innerText = req.urgency;
                document.getElementById('lbl_sponsor').innerText = req.sponsor_company;

                // 2. Configure compliance text viewers link anchors
                document.getElementById('btn_view_medical').href = req.medical_file_url;
                document.getElementById('btn_view_hse').href = req.hse_file_url;
                
                if (req.wqt_file_url && req.wqt_file_url.trim() !== "") {
                    const wqtBtn = document.getElementById('btn_view_wqt');
                    wqtBtn.href = req.wqt_file_url;
                    wqtBtn.classList.remove('hidden');
                }

                // 3. Draw independent multi-gate clearance status badge layout states
                mapIndependentGateBadge('badge_medic_gate', 'lbl_medic_comment', req.medical_status, req.medical_comment);
                mapIndependentGateBadge('badge_hse_gate', 'lbl_hse_comment', req.hse_status, req.hse_comment);
                mapIndependentGateBadge('badge_wqt_gate', 'lbl_wqt_comment', req.wqt_status, req.wqt_comment);

                // Global Lifecycle Wrapper Badge
                const gBadge = document.getElementById('globalLifecycleStatusBadge');
                gBadge.innerText = req.status;
                if (req.status === 'Approved') gBadge.className = "text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 font-black uppercase tracking-wider rounded-xl";
                else if (req.status.includes('Resubmit')) gBadge.className = "text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 font-black uppercase tracking-wider rounded-xl";
                else gBadge.className = "text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 font-black uppercase tracking-wider rounded-xl";

                // 4. CHRONOLOGICAL LOGS PAINTER TABLE: Compiles full site medic & hse historical evaluation tracks
                paintHistoryChronologyTimeline(req.submission_history || []);

            } catch (err) { alert("Console Initialization Fault: " + err.message); }
        }

        function mapIndependentGateBadge(badgeId, textId, stateValue, noteText) {
            const bg = document.getElementById(badgeId);
            const tx = document.getElementById(textId);
            
            bg.innerText = stateValue;
            tx.innerText = noteText || "Awaiting evaluation check-in loops...";

            if (stateValue === 'Approved') bg.className = "px-2 py-0.5 font-black text-[10px] uppercase rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            else if (stateValue === 'Resubmit') bg.className = "px-2 py-0.5 font-black text-[10px] uppercase rounded border bg-rose-500/10 text-rose-400 border-rose-500/20";
            else if (stateValue === 'Not Required') bg.className = "px-2 py-0.5 font-black text-[10px] uppercase rounded border bg-slate-900 text-slate-500 border-slate-800";
            else bg.className = "px-2 py-0.5 font-black text-[10px] uppercase rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse";
        }

        function paintHistoryChronologyTimeline(historyArray) {
            const container = document.getElementById('timelineLogsContainer');
            if (!container) return;
            container.innerHTML = '';

            if (!historyArray || historyArray.length === 0) {
                container.innerHTML = `<div class="text-xs text-slate-500 font-semibold italic p-4 text-center">No system operations snapshots cataloged for this packet timeline.</div>`;
                return;
            }

            // Clone and reverse array rows to stack the latest audit logs right at the peak
            [...historyArray].reverse().forEach(log => {
                const row = document.createElement('div');
                row.className = "bg-slate-900 p-3.5 rounded-xl border border-slate-800/60 text-xs flex justify-between items-start gap-4 flex-wrap hover:border-slate-700/40 transition mb-3";
                
                let logBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
                if (log.action === 'Submitted' || log.action === 'Resubmitted') logBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold';
                else if (log.action === 'Approved' || log.action.includes('Room') || log.action.includes('Passed')) logBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold';
                else if (log.action.includes('Resubmit') || log.action === 'Cancelled' || log.action.includes('Rejected')) logBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold';

                const logTime = new Date(log.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                });
                
                // 🌟 CRITICAL RE-ALIGNMENT FIX: Safe evaluation guards map strings and user object models cleanly!
                let displayExecutorName = "System Portal";
                let displayExecutorRole = "";

                if (log.by_user) {
                    if (typeof log.by_user === 'object' && log.by_user !== null) {
                        // 🌟 SUCCESS: Read the hydrated name and role properties fetched by the controller!
                        displayExecutorName = log.by_user.name || "System Portal";
                        displayExecutorRole = log.by_user.role ? `[${log.by_user.role}]` : "";
                    } else if (typeof log.by_user === 'string') {
                        const cleanUserStr = log.by_user.trim();
                        // Safe check fallback rule if an ID fails to query cleanly or defaults to baseline string tracks
                        if (mongoose.Types.ObjectId.isValid(cleanUserStr)) {
                            displayExecutorName = `User ID: ${cleanUserStr.substring(0, 8)}...`;
                            displayExecutorRole = "[COORDINATOR]";
                        } else {
                            displayExecutorName = cleanUserStr;
                            if (cleanUserStr.toLowerCase().includes("portal") || cleanUserStr.toLowerCase().includes("supplier")) {
                                displayExecutorRole = "[SUPPLIER]";
                            }
                        }
                    }
                }

                row.innerHTML = `
                    <div class="space-y-1.5 flex-1 min-w-[250px]">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${logBadgeClass}">${log.action}</span>
                            <div class="font-extrabold text-slate-300">
                                Executed by: <span class="text-white">${displayExecutorName}</span> 
                                <span class="text-emerald-500 font-mono text-[10px] font-black tracking-wide">${displayExecutorRole}</span>
                            </div>
                        </div>
                        <div class="text-xs text-slate-400 font-medium pl-1 leading-relaxed border-l-2 border-slate-800/80 mt-1">${log.notes || 'No notes left for this verification lane.'}</div>
                    </div>
                    <div class="font-mono text-[10px] text-slate-500 font-bold shrink-0 mt-0.5">⏱️ ${logTime}</div>
                `;
                container.appendChild(row);
            });
        }

        // Initialize script parameters pipeline
        initializeRequestDetailedConsole();
    </script>
</body>
</html>


==================================================
FILE: .\views\summy.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Site Management</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. CORRECTED Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased">

    <!-- OVER-RIDE WRAPPER: Forces everything to flow top-to-bottom, breaking the bad CSS rule -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start">

        <!-- Top Navigation Header: Spans 100% of top screen width -->
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg w-full shrink-0">
            <div>
                <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>SAS_SUBCON</span>
                    <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Hub Portal</span>
                </h1>
                <p class="text-xs text-slate-400 font-medium mt-0.5">Physical Infrastructure & Project Locations</p>
            </div>
            <a href="/user/dashboard-view" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700">
                Back to Dashboard
            </a>
        </header>
        <!-- Main Content Area: Aligns Form and Table Side-by-Side underneath header -->
        <main class="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            
            <!-- Status Notification Alert Banner -->
            <div id="statusBox" class="hidden lg:col-span-3 p-4 rounded-xl text-sm font-semibold border text-center transition-all duration-300"></div>
            
            <!-- LEFT PANEL: Operational Hub Configuration Input Form -->
            <section class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
                <div class="mb-5">
                    <h3 id="formTitle" class="text-lg font-black text-white flex items-center gap-2">🏗️ Provision Operational Site</h3>
                    <p class="text-xs text-slate-400 mt-1">Configure workspace parameters and master deployment locations.</p>
                </div>

                <form id="siteForm" class="space-y-4">
                    <input type="hidden" id="siteId" value="">

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Functional Site Code</label>
                        <input type="text" id="siteCode" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., FHD, YBL, FHD_PDO">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Descriptive Site Name</label>
                        <input type="text" id="siteName" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., Fahud Maintenance Camp">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Geographical Location (Oman Region)</label>
                        <input type="text" id="location" required 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="e.g., Fahud, Oman">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Deployment Framework Status</label>
                        <select id="status" 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition">
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="submit" id="submitBtn" 
                            class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10">
                            Register Site
                        </button>
                        <button type="button" id="cancelEditBtn" 
                            class="hidden bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition border border-slate-700">
                            Cancel
                        </button>
                    </div>
                </form>
            </section>

            <!-- RIGHT PANEL: Live Operational Hub Directory Table & Search Field Area -->
           <section class="lg:col-span-2 space-y-4 flex flex-col min-h-[500px] h-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
                
                <!-- Live Active Filter Search Bar -->
                <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row gap-3 items-center justify-between">
                    <div class="relative w-full md:max-w-md">
                        <input type="text" id="searchInput" 
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            placeholder="Search by code, descriptive name, or region...">
                        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
                    </div>
                    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        Active Deployment Locations: <span id="recordCount" class="text-emerald-400 font-black">0</span>
                    </div>
                </div>

                <!-- Dynamic Table Grid Output Content Layer Container -->
                <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl flex-1 overflow-hidden flex flex-col">
                    <div class="overflow-x-auto flex-1">
                        <table class="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                    <th class="px-6 py-4">Site Code</th>
                                    <th class="px-6 py-4">Descriptive Name</th>
                                    <th class="px-6 py-4">Oman Region / Location</th>
                                    <th class="px-6 py-4">Status</th>
                                    <th class="px-6 py-4 text-right">Actions Pipeline</th>
                                </tr>
                            </thead>
                            <tbody id="siteTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                                <!-- Javascript data inject loop -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>
    </div> <!-- Closes global over-ride flex wrapper layout -->
    <!-- Script Pipeline: Fully handles data orchestration with your backend APIs -->
    <script>
        const token = localStorage.getItem('token');
        let allSites = [];

        if (!token) { window.location.href = "/user/login-page"; }

        async function loadSites() {
            try {
                const res = await fetch('/site/all', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                allSites = data.sites || [];
                renderTable(allSites);
            } catch (err) { showAlert(err.message, 'error'); }
        }

        function renderTable(arr) {
            const tbody = document.getElementById('siteTableBody');
            document.getElementById('recordCount').innerText = arr.length;
            tbody.innerHTML = '';

            if (arr.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 italic">No operational locations found matching requirements.</td></tr>`;
                return;
            }

            arr.forEach(site => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition";
                const badge = site.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400';
                
                tr.innerHTML = `
                    <td class="px-6 py-4 font-black font-mono text-white tracking-wider">${site.site_code}</td>
                    <td class="px-6 py-4 font-bold text-slate-200">${site.site_name}</td>
                    <td class="px-6 py-4 text-slate-400">${site.location}</td>
                    <td class="px-6 py-4"><span class="px-2 py-0.5 rounded border border-slate-800 text-[10px] font-bold uppercase ${badge}">${site.status}</span></td>
                    <td class="px-6 py-4 text-right"><div class="flex justify-end gap-2">
                        <button onclick="populateEdit('${site._id}')" class="bg-blue-600/10 text-blue-400 border border-blue-500/10 px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm hover:bg-blue-600 hover:text-white transition">Edit</button>
                        <button onclick="deactivateSite('${site._id}')" class="bg-rose-600/10 text-rose-400 border border-rose-500/10 px-3 py-1.5 text-[11px] font-bold rounded-lg shadow-sm hover:bg-rose-600 hover:text-white transition">Deactivate</button>
                    </div></td>`;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('siteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('siteId').value;
            const payload = {
                site_code: document.getElementById('siteCode').value,
                site_name: document.getElementById('siteName').value,
                location: document.getElementById('location').value,
                status: document.getElementById('status').value
            };
            const isEdit = id.length > 0;
            try {
                const res = await fetch(isEdit ? `/site/update/${id}` : '/site/create', {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
                showAlert(isEdit ? "Site configuration parameters modified!" : "Operational site created successfully!", 'success');
                resetForm(); loadSites();
            } catch (err) { showAlert(err.message, 'error'); }
        });

        function populateEdit(id) {
            const site = allSites.find(s => s._id === id);
            if (!site) return;
            document.getElementById('siteId').value = site._id;
            document.getElementById('siteCode').value = site.site_code;
            document.getElementById('siteCode').disabled = true; 
            document.getElementById('siteName').value = site.site_name;
            document.getElementById('location').value = site.location;
            document.getElementById('status').value = site.status;
            document.getElementById('formTitle').innerText = "✏️ Modify Operational Parameters";
            document.getElementById('submitBtn').innerText = "Update Site Configuration";
            document.getElementById('submitBtn').className = "flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.remove('hidden');
        }

        async function deactivateSite(id) {
            if (!confirm("Are you sure you want to change this operational hub deployment status to Inactive?")) return;
            try {
                const res = await fetch(`/site/delete/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message); }
                showAlert("Operational hub profile flagged as Inactive status.", 'success'); loadSites();
            } catch (err) { showAlert(err.message, 'error'); }
        }

        document.getElementById('searchInput').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase().trim();
            const filtered = allSites.filter(s => 
                s.site_code.toLowerCase().includes(val) || 
                s.site_name.toLowerCase().includes(val) || 
                s.location.toLowerCase().includes(val)
            );
            renderTable(filtered);
        });

        function resetForm() {
            document.getElementById('siteForm').reset();
            document.getElementById('siteId').value = "";
            document.getElementById('siteCode').disabled = false;
            document.getElementById('formTitle').innerText = "🏗️ Provision Operational Site";
            document.getElementById('submitBtn').innerText = "Register Site";
            document.getElementById('submitBtn').className = "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition";
            document.getElementById('cancelEditBtn').classList.add('hidden');
        }

        document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

        function showAlert(msg, type) {
            const sb = document.getElementById('statusBox'); sb.innerText = msg;
            sb.className = `mb-6 p-4 rounded-xl text-sm font-semibold border text-center block ${type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`;
            setTimeout(() => sb.className = "hidden", 4000);
        }

        loadSites();
    </script>
</body>
</html>


==================================================
FILE: .\views\supplier_portal.ejs
==================================================

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAS_SUBCON - Subcontractor Mobilization Hub</title>
    <!-- 1. Local Fallback Static Stylesheet Link -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- 2. Tailwind CSS Runtime Engine Script CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-900 min-h-screen text-slate-100 font-sans antialiased m-0 p-0">
    <!-- Place this absolute block at the absolute top of your <body> tag wrapper -->
<div id="portalGlobalLoader" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] gap-4 transition-all duration-300">
    <!-- Animated Processing Spinner Matrix Core -->
    <div class="relative w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <div class="absolute inset-0 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin"></div>
        <div class="w-8 h-8 rounded-full border-4 border-slate-900 border-b-blue-400 animate-spin animate-reverse" style="animation-duration: 1s; animation-direction: reverse;"></div>
    </div>
    <div class="text-center space-y-1 mx-auto">
        <h4 class="text-sm font-black uppercase tracking-widest text-white animate-pulse">Streaming Workforce Assets</h4>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Uploading physical document PDFs into local storage bucket disks...</p>
    </div>
</div>
    <!-- Place this absolute block at the absolute top of your <body> tag wrapper in all 3 files -->
<div id="statusBox" class="hidden fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-2xl border transition-all duration-300 transform scale-95 opacity-0 duration-300" style="min-width: 22rem; pointer-events: none;"></div>


    <!-- MASTER WRAPPER: Forces strict layout distribution -->
    <div class="flex flex-col w-full min-h-screen items-stretch justify-start bg-slate-900">

        <!-- Top Navigation Header: Pinned horizontal channel -->
        <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 shadow-lg w-full shrink-0">
            <div class="max-w-7xl mx-auto flex justify-between items-center w-full">
                <div>
                    <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>SAS_SUBCON</span>
                        <span class="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">Supplier Portal</span>
                    </h1>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Subcontractor Workforce Mobilization & Deployment Workbench</p>
                </div>
                
                <!-- Disconnect Session Trigger Button -->
                <button onclick="handleLogout()" 
                    class="bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-200 text-xs font-bold px-4 py-2 rounded-xl transition border border-slate-700 shadow-md active:scale-[0.98]">
                    Disconnect Session
                </button>
            </div>
        </header>

        <!-- Main Workspace Deck Grid Wrapper Container -->
        <main class="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start bg-slate-900">
            
        
            <!-- LEFT PANEL: Workforce Deployment Submission Form Card Components -->
            <div class="lg:col-span-1 w-full">
                <section class="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div class="mb-5">
                    <h3 class="text-lg font-black text-white flex items-center gap-2">👤 Mobilize Personnel</h3>
                    <p class="text-xs text-slate-400 mt-1">Register field employee documentation packets for multi-tier clearance evaluation.</p>
                </div>

                <!-- 🌟 CRITICAL FIX: Explicitly added the required form element ID -->
                <form id="mobilizationForm" class="space-y-4">
                    
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Oman Civil ID Number</label>
                        <input type="text" id="civil_id" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="e.g., 10928374">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Employee Name</label>
                        <input type="text" id="employee_name" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="As written on Civil ID">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Employee Nationality</label>
                            <select id="nationality" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                                <option value="" disabled selected>Select Nationality...</option>
                                <option value="Omani">🇴🇲 Omani</option>
                                <option value="Indian">🇮🇳 Indian</option>
                                <option value="Pakistani">🇵🇰 Pakistani</option>
                                <option value="Bangladeshi">🇧🇩 Bangladeshi</option>
                                <option value="Egyptian">🇪🇬 Egyptian</option>
                                <option value="Filipino">🇵🇭 Filipino</option>
                                <option value="Other">🌍 Other / Expatriate</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Date of Birth</label>
                            <input type="date" id="dob" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Mobile Number</label>
                            <input type="text" id="mobile_number" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="e.g., 99445566">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Civil Expire Date</label>
                            <input type="date" id="civil_expire" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Trade Designation</label>
                            <select id="designation_id" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                                <option value="" disabled selected>Select Risk Category Role...</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Lodging Type</label>
                            <select id="accommodation_type" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                                <option value="" disabled selected>Select Bed...</option>
                                <option value="1SS">1SS</option>
                                <option value="2SS">2SS</option>
                                <option value="3SS">3SS</option>
                                <option value="1JS">1JS</option>
                                <option value="2JS">2JS</option>
                                <option value="3JS">3JS</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Target Deployment Site</label>
                            <select id="target_site_id" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                                <option value="" disabled selected>Select Target Camp Location...</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sponsor Company</label>
                            <input type="text" id="sponsor_company" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition" placeholder="Visa Sponsor Name">
                        </div>
                    </div>

                   <!-- 🌟 MEDICAL FILE BOX -->
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fit-For-Duty Medical Certificate (PDF)</label>
                        <input type="file" id="medical_file" name="medical_file" accept="application/pdf" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                        <p class="text-[10px] text-slate-500 font-semibold mt-1">⚠️ Accepts PDF format only. Maximum file size size: 5 MB.</p>
                    </div>

                    <!-- 🌟 HSE FILE BOX -->
                    <div class="mt-4">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">HSE Induction Clearance (PDF)</label>
                        <input type="file" id="hse_file" name="hse_file" accept="application/pdf" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                        <p class="text-[10px] text-slate-500 font-semibold mt-1">⚠️ Accepts PDF format only. Maximum file size size: 5 MB.</p>
                    </div>

                    <!-- 🌟 HIDING WELDER WQT BOX -->
                    <div id="wqt_wrapper" class="mt-4" style="display: none;">
                        <label class="block text-xs font-bold uppercase tracking-wider text-rose-400 mb-1.5">Welder Qualification Card (WQT PDF)</label>
                        <input type="file" id="wqt_file" name="wqt_file" accept="application/pdf" class="w-full bg-slate-900 border border-rose-900 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-rose-500 outline-none transition">
                        <p class="text-[10px] text-rose-500/70 font-semibold mt-1">⚠️ Accepts PDF format only. Maximum file size size: 5 MB.</p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Processing Priority Tier</label>
                        <select id="urgency" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                            <option value="Normal">Normal Priority Processing</option>
                            <option value="Urgent">Urgent Priority Processing</option>
                            <option value="Critical Emergency">Critical Emergency Flight Priority</option>
                        </select>
                    </div>

                    <div class="pt-2">
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-[0.99]">
                            Submit Worker Packet
                        </button>
                    </div>
                </form>
            </section>
            </div>
            <!-- RIGHT PANEL: Subcontractor Live History Registry (2 Columns Grid Span) -->
            <div class="lg:col-span-2 w-full space-y-4">
                <section class="space-y-4 flex flex-col bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl w-full">
                     
                     <!-- HORIZONTAL FILTER BAR DECK (Matches administrative dashboard structure symmetry) -->
<div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 w-full" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important;">
    
    <!-- Search Keyword Wrapper -->
    <div class="relative w-full md:max-w-xs shrink-0" style="display: block !important; margin: 0 !important; max-width: 20rem !important; width: 100% !important;">
        <input type="text" id="searchInput" oninput="applyHistoryFilters()"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
            placeholder="Search by worker name, civil ID...">
        <span class="absolute left-3.5 top-3.5 text-slate-500 text-xs">🔍</span>
    </div>

    <!-- Segmented Processing Pipeline Filter Tabs (Emerald/Rose State Toggles) -->
    <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 select-none gap-1" style="display: flex !important; flex-direction: row !important; gap: 4px !important; margin: 0 !important; align-items: center !important;">
        <button type="button" id="tabReviewBtn" onclick="setPortalTab('Review')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 bg-emerald-600 text-white shadow border-none">
            Pending Review
        </button>
        <button type="button" id="tabCorrectionBtn" onclick="setPortalTab('Correction')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200 border-none">
            Corrections
        </button>
        <button type="button" id="tabClearedBtn" onclick="setPortalTab('Cleared')"
            class="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 text-slate-400 hover:text-slate-200 border-none">
            Fully Cleared
        </button>
    </div>

    <!-- Dynamic Grid Row Entries Summary Count Badge -->
    <div class="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 tracking-wide shrink-0" style="display: block !important; margin: 0 !important;">
        Records Displayed: <span id="recordCount" class="text-emerald-400 font-black">0</span>
    </div>
</div>
                     <!-- Standardized Data Table Framework Container Window -->
                     <div class="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col w-full">
                         <div class="overflow-x-auto">
                             <table class="w-full text-left border-collapse min-w-[700px]">
                                 <thead>
                                     <tr class="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                                         <th class="px-5 py-4">Bio Profile</th>
                                         <th class="px-5 py-4">Deployment Allocation</th>
                                         <th class="px-5 py-4">File Status</th>
                                         <th class="px-5 py-4 text-right">Actions Pipeline</th>
                                     </tr>
                                 </thead>
                                 <tbody id="supplierTableBody" class="divide-y divide-slate-800/60 text-sm font-medium text-slate-300">
                                     <!-- JavaScript paint loop target location -->
                                 </tbody>
                             </table>
                         </div>
                     </div>
                </section>
            </div>


<!-- 🌟 ARCHITECTURAL ALIGNMENT UPGRADE: STRUCTURALLY HIDDEN BY DEFAULT -->
<div id="resubmitFileModal" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 p-4 transition-all duration-200">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 mx-auto mt-24 transform scale-100 transition-all">
        <div class="flex justify-between items-center border-b border-slate-800/60 pb-3">
            <h3 class="text-md font-black text-white flex items-center gap-2">🔄 Resubmit Compliance Document</h3>
            <button type="button" onclick="closeResubmitModal()" class="text-slate-500 hover:text-slate-300 text-sm font-bold bg-slate-950 px-2 py-1 rounded-lg transition border border-slate-800 border-none outline-none">ESC</button>
        </div>
        
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800/40 space-y-1">
            <div id="resubmitWorkerNameHeader" class="text-sm font-black text-emerald-400 uppercase tracking-wide">--</div>
            <div id="resubmitTargetGateLabel" class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">--</div>
        </div>

        <form id="fileCorrectionForm" class="space-y-4">
            <input type="hidden" id="resubmitTargetRequestId">
            <input type="hidden" id="resubmitTargetGateField">
            
            <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Select Fresh Valid PDF Document File</label>
                <input type="file" id="resubmit_file_input" accept="application/pdf" required class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition">
                <p class="text-[10px] text-slate-500 font-semibold mt-1">⚠️ Accepts PDF format only. Maximum file size: 5 MB.</p>
            </div>

            <div class="pt-2">
                <button type="button" onclick="executeBinaryFileResubmission()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/10 active:scale-95 border-none">
                    Upload & Transmit File Correction
                </button>
            </div>
        </form>
    </div>
</div>




        </main>
    </div> <!-- Master global architecture page wrapper close out block -->
    <!-- Script Engine Core: Maps data streams down to Express routing endpoints -->
        <!-- Master Script Pipeline: Fully handles data orchestration with your backend Mobilization APIs -->
    <script>
        const token = localStorage.getItem('token');
        let allRequests = [];
        let currentTabFilter = 'Review'; // Toggles across 'Review', 'Correction', 'Cleared' states

        // Session Gateway Guarding Pipeline Check
        if (!token) { window.location.href = "/user/login-page"; }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DYNAMIC DROPDOWN LOADER ENGINE: Connected directly to your controller keys
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                async function populateDesignationsDropdown() {
                const selector = document.getElementById('designation_id');
                
                // 🌟 SAFETY GUARD: If the HTML select box is missing, stop instead of crashing!
                if (!selector) {
                    console.error("Layout Error: Could not find an HTML element with id='designation_id' on this page. Check your form markup!");
                    return;
                }
                
                try {
                    const res = await fetch('/designation/all', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    const arraySource = data.designations || [];
                    
                    selector.innerHTML = '<option value="" disabled selected class="text-slate-500">Select Risk Category Role...</option>';
                    arraySource.forEach(des => {
                        if (des.status !== 'Inactive') {
                            const opt = document.createElement('option');
                            opt.value = des._id;
                            opt.className = "bg-slate-900 text-white font-medium";
                            opt.innerText = `🛠️ ${des.title.toUpperCase()} [Risk: ${des.risk_level}]`;
                            selector.appendChild(opt);
                        }
                    });
                } catch (err) { 
                    console.error("Designation select sync exception:", err.message); 
                }
            }

            async function populateSitesDropdown() {
                const selector = document.getElementById('target_site_id');
                
                // 🌟 SAFETY GUARD: If the HTML select box is missing, stop instead of crashing!
                if (!selector) {
                    console.error("Layout Error: Could not find an HTML element with id='target_site_id' on this page. Check your form markup!");
                    return;
                }
                
                try {
                    const res = await fetch('/site/all', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    const arraySource = data.sites || [];
                    
                    selector.innerHTML = '<option value="" disabled selected class="text-slate-500">Select Target Camp Location...</option>';
                    arraySource.forEach(site => {
                        if (site.status !== 'Inactive') {
                            const opt = document.createElement('option');
                            opt.value = site._id;
                            opt.className = "bg-slate-900 text-white font-medium";
                            opt.innerText = `📍 ${site.site_name.toUpperCase()} [${site.location || 'Oman'}]`;
                            selector.appendChild(opt);
                        }
                    });
                } catch (err) { 
                    console.error("Site select sync exception:", err.message); 
                }
            }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // WELDER EXPLICIT SPECIALIZED FIELDBOX TOGGLE DETECTOR RULE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const designationSelectorInput = document.getElementById('designation_id');

        // SAFETY GUARD: Only binds listener if the DOM node element is successfully found!
        if (designationSelectorInput) {
            designationSelectorInput.addEventListener('change', function() {
                const selectedOptionText = this.options[this.selectedIndex].text.toLowerCase();
                const wqtWrapper = document.getElementById('wqt_wrapper');
                
                // 🌟 CRITICAL FIX: Point this selector straight to your active 'wqt_file' upload element tag!
                const wqtInput = document.getElementById('wqt_file');

                if (wqtWrapper && wqtInput) {
                    if (selectedOptionText.includes('welder')) {
                        wqtWrapper.style.display = 'block';
                        wqtInput.required = true;
                        console.log("Welder role matched! Expanding WQT input slot.");
                    } else {
                        wqtWrapper.style.display = 'none';
                        wqtInput.required = false;
                        wqtInput.value = '';
                    }
                }
            });
            console.log("Welder verification event listener safely mounted.");
        } else {
            console.error("Layout Warning: HTML ID element 'designation_id' was not found inside your form card panel!");
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // READ OPERATIONS: FETCH ISOLATED HISTORICAL REQUESTS LOG MATRIX
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        async function loadSupplierDashboard() {
            try {
                const res = await fetch('/mobilization/my-submissions', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                allRequests = data.requests || [];
                applyHistoryFilters();
            } catch (err) { showAlert(err.message, "error"); }
        }

        // UNIFIED SEARCH AND HORIZONTAL TAB SYSTEM ENGINE FILTERS
function applyHistoryFilters() {
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    
    const filteredDataset = allRequests.filter(req => {
        // Safe check fallbacks to ensure field variables exist smoothly
        const currentGlobalStatus = (req.status || "Under Review").toLowerCase().trim();
        const medGate = (req.medical_status || "Pending").trim();
        const hseGate = (req.hse_status || "Pending").trim();
        const wqtGate = (req.wqt_status || "Pending").trim();
        
        let tabMatch = false;
        
        // 🌟 ARCHITECTURAL UPGRADE: Evaluates independent granular gate markers
        if (currentTabFilter === 'Review') {
            // Worker is in the active review pool ONLY if all gates are pending/approved and global state is active
            const hasAnyRejections = medGate === 'Resubmit' || hseGate === 'Resubmit' || wqtGate === 'Resubmit';
            tabMatch = !hasAnyRejections && (currentGlobalStatus === 'under review' || currentGlobalStatus.includes('pending'));
            
        } else if (currentTabFilter === 'Correction') {
            // 🌟 CRITICAL FIX: Instantly traps rows if ANY specific team issued a Resubmit override order!
            tabMatch = medGate === 'Resubmit' || hseGate === 'Resubmit' || wqtGate === 'Resubmit';
            
        } else if (currentTabFilter === 'Cleared') {
            tabMatch = currentGlobalStatus === 'approved' || currentGlobalStatus === 'rejected' || currentGlobalStatus === 'cancelled';
        }

        // Search text matching query execution loops
        const searchMatch = 
            req.employee_name.toLowerCase().includes(searchVal) ||
            req.civil_id.includes(searchVal) ||
            req.sponsor_company.toLowerCase().includes(searchVal) ||
            (req.designation_id && req.designation_id.title && req.designation_id.title.toLowerCase().includes(searchVal));

        return tabMatch && searchMatch;
    });

    // Fire table layout matrix row painter
    renderTable(filteredDataset);
}
        function setPortalTab(tabType) {
            currentTabFilter = tabType;
            
            // Support your original HTML button ID names
            const tabReview = document.getElementById('tabReviewBtn') || document.getElementById('filterActiveBtn');
            const tabCorrection = document.getElementById('tabCorrectionBtn') || document.getElementById('filterCorrectionsBtn');
            const tabCleared = document.getElementById('tabClearedBtn') || document.getElementById('filterClearedBtn');

            // Toggle horizontal active button styles dynamically via Tailwind utilities
            if (tabReview) tabReview.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Review' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tabCorrection) tabCorrection.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Correction' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");
            if (tabCleared) tabCleared.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition border-none " + (tabType === 'Cleared' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200");

            applyHistoryFilters();
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DOM RENDERING ENGINE: DRAW DATA TABLE ROW NODES WITH DYNAMIC DROP SHORTCUTS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            function renderTable(arr) {
                // 🌟 CRITICAL FIX: Point this selector straight to your active 'portalTableBody' container element tag!
                const tbody = document.getElementById('portalTableBody') || document.getElementById('supplierTableBody');  
                
                const recordIndicatorCount = document.getElementById('recordCount');
                if (recordIndicatorCount) recordIndicatorCount.innerText = arr.length;
                
                if (!tbody) {
                    console.error("System Matrix Error: Could not locate 'portalTableBody' element inside your HTML layout view!");
                    return;
                }
                
                tbody.innerHTML = '';

                if (arr.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 italic text-xs">No workforce deployment records active under this segment parameter.</td></tr>`;
                    return;
                }

                arr.forEach(req => {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-slate-900/30 border-b border-slate-800/40 text-xs transition items-center";

                    // Format timestamps cleanly
                    const creationDateRaw = req.createdAt ? new Date(req.createdAt) : new Date();
                    const formattedSubmissionDate = creationDateRaw.toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    // 🌟 ARCHITECTURAL EXTRACT: Isolate granular gate values natively
                    const medGate = (req.medical_status || "Pending").trim();
                    const hseGate = (req.hse_status || "Pending").trim();
                    const wqtGate = (req.wqt_status || "Pending").trim();

                    // 1. DYNAMIC STATUS & CORRECTION BADGES DETECTOR
                    let statusBadgeMarkup = `<span class="px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border-amber-500/20 select-none">${req.status}</span>`;
                    let actionBtnMarkup = `<span class="text-slate-500 italic font-semibold tracking-wide">No Actions</span>`;

                    const isRejected = medGate === 'Resubmit' || hseGate === 'Resubmit' || wqtGate === 'Resubmit';

                    if (isRejected) {
                        // Packet contains a correction order! Build explicit red warning pills detailing the bottleneck
                        let errorNotes = [];
                        if (medGate === 'Resubmit') errorNotes.push(`<button onclick="openResubmitModal('${req._id}', '${req.employee_name.replace(/'/g, "\\'")}', 'medical_file')" class="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded hover:bg-rose-600 hover:text-white transition font-bold uppercase tracking-wider border-none">Fix Medical PDF 🔄</button>`);
                        if (hseGate === 'Resubmit') errorNotes.push(`<button onclick="openResubmitModal('${req._id}', '${req.employee_name.replace(/'/g, "\\'")}', 'hse_file')" class="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded hover:bg-rose-600 hover:text-white transition font-bold uppercase tracking-wider border-none">Fix HSE PDF 🔄</button>`);
                        if (wqtGate === 'Resubmit') errorNotes.push(`<button onclick="openResubmitModal('${req._id}', '${req.employee_name.replace(/'/g, "\\'")}', 'wqt_file')" class="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded hover:bg-rose-600 hover:text-white transition font-bold uppercase tracking-wider border-none">Fix WQT PDF 🔄</button>`);

                        statusBadgeMarkup = `
                            <div class="flex flex-col gap-1 items-center">
                                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20 select-none">Action Required</span>
                                <div class="flex flex-col gap-1">${errorNotes.join('')}</div>
                            </div>`;
                            
                        actionBtnMarkup = `<button onclick="dropMobilizationPacket('${req._id}')" class="bg-rose-600/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-rose-600 hover:text-white transition border-none shadow-sm active:scale-95">Drop</button>`;
                    } else {
                        // Standard normal operational states mapping
                        const droppableStates = ["Under Review", "Pending HO Approval", "Pending Site Admin"];
                        if (droppableStates.includes(req.status)) {
                            actionBtnMarkup = `<button onclick="dropMobilizationPacket('${req._id}')" class="bg-rose-600/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-rose-600 hover:text-white transition border-none shadow-sm active:scale-95">Withdraw</button>`;
                        }
                        if (req.status === 'Approved') statusBadgeMarkup = `<span class="px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/20 select-none">Approved</span>`;
                    }

                    const destName = req.target_site_id ? (req.target_site_id.site_name || 'Active Site') : 'Unassigned';
                    const destLoc = req.target_site_id ? (req.target_site_id.location || 'Oman') : 'Oman';
                    const roleTitle = req.designation_id ? (req.designation_id.title || 'General Labor') : 'Unclassified';

                    let wqtLinkMarkup = '';
                    if (req.wqt_file_url) {
                        wqtLinkMarkup = `<a href="${req.wqt_file_url}" target="_id_view" class="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-md hover:bg-rose-600 hover:text-white transition font-bold">📄 WQT PDF</a>`;
                    }

                    tr.innerHTML = `
                        <td class="px-6 py-4 vertical-align-middle">
                            <div class="font-black text-white text-xs uppercase tracking-wide">${req.employee_name}</div>
                            <div class="font-mono text-[10px] text-slate-500 font-bold mt-0.5">CIVIL ID: ${req.civil_id}</div>
                            <div class="text-[10px] text-emerald-500/80 font-semibold mt-1.5 flex items-center gap-1.5">
                                <span>📅 ${formattedSubmissionDate}</span>
                                <a href="/mobilization/request-details/${req._id}" class="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700/60 font-black tracking-wider uppercase hover:bg-emerald-600 hover:text-white hover:border-transparent transition ml-1">View Profile 🔍</a>
                            </div>
                        </td>
                        <td class="px-6 py-4 vertical-align-middle">
                            <div class="text-xs font-bold text-slate-300 capitalize">${roleTitle}</div>
                            <div class="text-[10px] text-slate-500 font-semibold mt-0.5 mb-2">📍 ${destName.toUpperCase()} (${destLoc}) [Bed: ${req.accommodation_type}]</div>
                            
                            <div class="flex gap-1.5 items-center flex-wrap">
                                <a href="${req.medical_file_url}" target="_id_view" class="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md hover:bg-blue-600 hover:text-white transition font-bold">📄 Medical PDF</a>
                                <a href="${req.hse_file_url}" target="_id_view" class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md hover:bg-emerald-600 hover:text-white transition font-bold">📄 HSE PDF</a>
                                ${wqtLinkMarkup}
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center vertical-align-middle" style="text-align: center !important;">
                            <div class="inline-flex justify-center items-center w-full">
                                ${statusBadgeMarkup}
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center vertical-align-middle" style="text-align: center !important;">
                            <div class="inline-flex justify-center items-center w-full">
                                ${actionBtnMarkup}
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TRANSACTION WRITE PIPELINES: INITIATE REQUEST & SUPPLIER DROP ROUTINES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const submissionFormElement = document.getElementById('mobilizationForm');

        if (submissionFormElement) {
            submissionFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();
            
                // Extract and cast raw date values to ISO format strings for strict Mongoose compliance
                const rawDob = document.getElementById('dob').value;
                const rawCivilExpire = document.getElementById('civil_expire').value;
                
                // Initialize a multi-part container wrapper to pass files and text strings concurrently
                const formDataPayload = new FormData();
                
                // 1. Append standard textual database information attributes
                formDataPayload.append("civil_id", document.getElementById('civil_id').value.trim());
                formDataPayload.append("employee_name", document.getElementById('employee_name').value.trim());
                formDataPayload.append("nationality", document.getElementById('nationality').value.trim());
                formDataPayload.append("dob", rawDob ? new Date(rawDob).toISOString() : "");
                formDataPayload.append("mobile_number", document.getElementById('mobile_number').value.trim());
                formDataPayload.append("designation_id", document.getElementById('designation_id').value);
                formDataPayload.append("civil_expire", rawCivilExpire ? new Date(rawCivilExpire).toISOString() : "");
                formDataPayload.append("accommodation_type", document.getElementById('accommodation_type').value);
                formDataPayload.append("target_site_id", document.getElementById('target_site_id').value);
                formDataPayload.append("sponsor_company", document.getElementById('sponsor_company').value.trim());
                formDataPayload.append("urgency", document.getElementById('urgency').value);

                const medInput = document.getElementById('medical_file');
                const hseInput = document.getElementById('hse_file');
                const wqtInput = document.getElementById('wqt_file');

                // 3. Extract using array destructuring syntax (This pulls the 1st file body without typing [0])
                if (medInput && medInput.files && medInput.files.length > 0) {
                    const [actualMedicalFileBlob] = medInput.files; 
                    formDataPayload.append("medical_file", actualMedicalFileBlob);
                    console.log("Medical PDF binary detached from file list wrapper successfully.");
                }
                
                if (hseInput && hseInput.files && hseInput.files.length > 0) {
                    const [actualHseFileBlob] = hseInput.files;
                    formDataPayload.append("hse_file", actualHseFileBlob);
                    console.log("HSE PDF binary detached from file list wrapper successfully.");
                }
                
                // Only append the Welder qualification card if the input wrapper is active and populated
                if (wqtInput && wqtInput.files && wqtInput.files.length > 0) {
                    const [actualWqtFileBlob] = wqtInput.files;
                    formDataPayload.append("wqt_file", actualWqtFileBlob);
                    console.log("Welder special WQT PDF binary appended to multi-part payload matrix.");
                }

        try {
            // 🌟 1. SHOW LOADER: Removes hidden and injects full flex centering classes dynamically
            const globalLoaderNode = document.getElementById('portalGlobalLoader');
            if (globalLoaderNode) {
                globalLoaderNode.classList.remove('hidden');
                globalLoaderNode.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
            }

            const res = await fetch('/mobilization/submit-worker', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}` 
                },
                body: formDataPayload 
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            showAlert("Workforce mobilization packet with physical PDF documents uploaded successfully!", "success");
            resetForm(); 
            await loadSupplierDashboard();
            
        } catch (err) { 
            showAlert(err.message, "error"); 
        } finally {
            // 🌟 2. HIDE LOADER: Removes flex rules and hides the container completely
            const globalLoaderNode = document.getElementById('portalGlobalLoader');
            if (globalLoaderNode) {
                globalLoaderNode.classList.remove('flex', 'flex-col', 'items-center', 'justify-center');
                globalLoaderNode.classList.add('hidden');
            }
        }
            });
            console.log("Form submission event listener safely mounted.");
        } else {
            console.error("Critical System Warning: HTML Element id='mobilizationForm' missing in action!");
        }
        async function dropMobilizationPacket(id) {
            if (!confirm("Are you sure you want to completely drop and withdraw this pending employee mobilization request? All uploaded compliance documents will be permanently destroyed from database disks.")) return;
            try {
                const res = await fetch(`/mobilization/drop-request/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                // 🌟 SUCCESS POPUP OVERLAY TOAST DIALOG
                showAlert("Application successfully withdrawn. Associated binary document files dropped from local storage disks.", "success");
                
                // 🌟 CRITICAL FIX: Instantly pulls fresh backend data and updates the table row state
                await loadSupplierDashboard(); 
            } catch (err) { 
                showAlert(err.message, "error"); 
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TERMINATION RUN: SECURE DISCONNECT & BACKEND SESSION DEACTIVATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        async function handleLogout() {
            if (!confirm("Are you sure you want to safely disconnect your mobilization portal session?")) return;
            try {
                await fetch('/user/logout', { 
                    method: 'POST', 
                    headers: { 'Authorization': `Bearer ${token}` } 
                });
            } catch (err) { console.error("Session logout endpoint sync notice:", err.message); }
            finally {
                localStorage.clear();
                window.location.href = "/user/login-page";
            }
        }

        function resetForm() {
            const mainForm = document.getElementById('mobilizationForm');
            if (mainForm) mainForm.reset();

            const wqtWrapper = document.getElementById('wqt_wrapper');
            if (wqtWrapper) wqtWrapper.style.display = 'none';

            // 🌟 CORRECTION FIXED: Targets your actual updated 'wqt_file' file element handler!
            const wqtFileInput = document.getElementById('wqt_file');
            if (wqtFileInput) wqtFileInput.required = false;

            // Explicitly force dropdown placeholder selections back to default states
            const desSelect = document.getElementById('designation_id');
            const siteSelect = document.getElementById('target_site_id');
            const accomSelect = document.getElementById('accommodation_type');
            const natSelect = document.getElementById('nationality');
            const urgSelect = document.getElementById('urgency');

            if (desSelect) desSelect.value = "";
            if (siteSelect) siteSelect.value = "";
            if (accomSelect) accomSelect.value = "";
            if (natSelect) natSelect.value = "";
            if (urgSelect) urgSelect.value = "Normal";
            
            console.log("Form components states successfully returned to baseline.");
        }

        // UNIVERSAL OVERLAY TOAST POPUP DISPATCH PIPELINE
function showAlert(msg, type) {
    const sb = document.getElementById('statusBox');
    if (!sb) return;

    // 1. Inject server notification textual data strings
    sb.innerText = msg;

    // 2. Clear previous themes and apply matching background colors
    if (type === 'success' || type === 'status-success') {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#34d399';
        sb.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    } else {
        sb.style.backgroundColor = '#020617';
        sb.style.color = '#f87171';
        sb.style.borderColor = 'rgba(244, 63, 94, 0.3)';
        sb.style.boxShadow = '0 20px 25px -5px rgba(244, 63, 94, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.5)';
    }

    // 3. Trigger css pop-up animations entry states
    sb.classList.remove('hidden', 'scale-95', 'opacity-0');
    sb.classList.add('scale-100', 'opacity-100');

    // 4. Close the popup cleanly after a 3-second cycle run duration interval
    setTimeout(() => {
        sb.classList.remove('scale-100', 'opacity-100');
        sb.classList.add('scale-95', 'opacity-0');
        
        // Wait for the exit animation transition to complete before hiding the container node completely
        setTimeout(() => {
            sb.classList.add('hidden');
        }, 300);
    }, 3000);
}

        async function initializePortal() {
            await Promise.all([populateDesignationsDropdown(), populateSitesDropdown()]);
            loadSupplierDashboard();
        }

        initializePortal();

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESUBMISSION MODAL CONTROLLERS: PACK CORRECTION BLOCKS & STREAMS TO MONGO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function openResubmitModal(requestId, workerName, gateFieldName) {
    document.getElementById('resubmitTargetRequestId').value = requestId;
    document.getElementById('resubmitTargetGateField').value = gateFieldName;
    document.getElementById('resubmitWorkerNameHeader').innerText = `AMENDING FILE FOR: ${workerName}`;
    document.getElementById('resubmitTargetGateLabel').innerText = `Target Bottleneck: ${gateFieldName.replace('_', ' ').toUpperCase()}`;
    document.getElementById('resubmit_file_input').value = '';

    const modal = document.getElementById('resubmitFileModal');
    if (modal) {
        // 🌟 RE-ALIGNMENT: Clear hidden and inject absolute layout flex properties on trigger click
        modal.classList.remove('hidden');
        modal.classList.add('flex', 'items-center', 'justify-center');
    }
}

function closeResubmitModal() {
    const modal = document.getElementById('resubmitFileModal');
    if (modal) {
        // 🌟 RE-ALIGNMENT: Clear display properties and snap back to hidden baseline states
        modal.classList.remove('flex', 'items-center', 'justify-center');
        modal.classList.add('hidden');
    }
}

async function executeBinaryFileResubmission() {
    const requestId = document.getElementById('resubmitTargetRequestId').value;
    const gateField = document.getElementById('resubmitTargetGateField').value; // Evaluates to 'medical_file', 'hse_file', or 'wqt_file'
    const fileInput = document.getElementById('resubmit_file_input');

    if (!fileInput.files || fileInput.files.length === 0) {
        showAlert("Please select a fresh valid physical PDF document file to proceed.", "error");
        return;
    }

    const [actualFileBlob] = fileInput.files;
    const formDataPayload = new FormData();
    
    // Pass the indicator string parameter
    formDataPayload.append("targetField", gateField);
    
    // 🌟 CRITICAL RE-ALIGNMENT FIX:
    // Instead of passing a generic string like 'correction_file', we pass the exact field name
    // (medical_file, hse_file, or wqt_file) that Multer expects for validation clearance!
    formDataPayload.append(gateField, actualFileBlob); 

    try {
        const loader = document.getElementById('portalGlobalLoader');
        if (loader) {
            loader.classList.remove('hidden'); 
            loader.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
        }

        const res = await fetch(`/mobilization/resubmit-file/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formDataPayload
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        showAlert("Correction document uploaded successfully! Gate returned to Pending review loops.", "success");
        closeResubmitModal();
        await loadSupplierDashboard(); 
    } catch (err) { 
        showAlert(err.message, "error"); 
    } finally {
        const loader = document.getElementById('portalGlobalLoader');
        if (loader) { 
            loader.classList.remove('flex', 'flex-col', 'items-center', 'justify-center'); 
            loader.classList.add('hidden'); 
        }
    }
}
    </script>
</body>
</html>

