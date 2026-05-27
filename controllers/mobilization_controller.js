const { purgeWorkforceBinaryFiles } = require("../utils/document_purger"); // 🌟 CRITICAL FIX: Links your background cleanup function!
const MobilizationRequest = require("../models/mobilization_request");
const Designation = require("../models/designation");
const Blacklist = require("../models/blacklist");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const createMobilizationRequest = async (req, res) => {
    // Keep a listing tracking array of local files to clean up on execution exit loops
    const temporaryFilesToCleanup = [];

    try {
        const { 
            civil_id, employee_name, nationality, dob, mobile_number, 
            designation_id, civil_expire, accommodation_type, target_site_id, 
            sponsor_company, urgency 
        } = req.body;

        const sub_company_id = req.user.supplier_id || req.user.supplierId; 
        if (!sub_company_id) return res.status(401).json({ message: "Session token missing subcontractor supplier link." });

        if (!civil_id || !employee_name || !nationality || !dob || !mobile_number || !designation_id || !civil_expire || !accommodation_type || !target_site_id || !sponsor_company) {
            return res.status(400).json({ message: "All employee registration details and expiration fields are mandatory." });
        }

        // Validate physical multi-part document files presence logs
        if (!req.files || !req.files.medical_file || !req.files.hse_file) {
            return res.status(400).json({ message: "Upload Blocked! Both physical Medical and HSE PDF files must be attached." });
        }

        // Initialize the native official GridFS Bucket instance seamlessly
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });

        // HELPER SUB-ENGINE: Streams buffered disk storage data smoothly into MongoDB chunks
        const streamFileToGridFS = (fileObject) => {
            return new Promise((resolve, reject) => {
                temporaryFilesToCleanup.push(fileObject.path); // Add to cleanup list array tracking
                
                const uploadStream = bucket.openUploadStream(`${Date.now()}-${fileObject.filename}`, {
                    contentType: fileObject.mimetype
                });

                fs.createReadStream(fileObject.path)
                    .pipe(uploadStream)
                    .on("error", (err) => reject(err))
                    .on("finish", () => resolve(`/mobilization/file/${uploadStream.id}`));
            });
        };

        // Stream required documentation packets concurrently
        const medical_file_url = await streamFileToGridFS(req.files.medical_file[0]);
        const hse_file_url = await streamFileToGridFS(req.files.hse_file[0]);

        // Process dynamic specialized Welder checking parameters rules
        const tradeProfile = await Designation.findById(designation_id);
        const isWelderTrade = tradeProfile && tradeProfile.title.toLowerCase().includes("welder");
        let assignedWqtComment = "Not Required for this Trade";
        let verifiedWqtUrl = "";

        if (isWelderTrade) {
            if (!req.files.wqt_file) {
                throw new Error("Welder job classifications require uploading a valid physical WQT certification card PDF.");
            }
            verifiedWqtUrl = await streamFileToGridFS(req.files.wqt_file[0]);
            assignedWqtComment = "Pending Welder Review Team Evaluation";
        }

        const cleanCivilId = civil_id.trim();
        const isBlacklisted = await Blacklist.findOne({ civil_id: cleanCivilId });
        if (isBlacklisted) return res.status(403).json({ message: `Civil ID '${cleanCivilId}' is permanently blacklisted.` });

        const activeQueueCheck = await MobilizationRequest.findOne({ civil_id: cleanCivilId, status: "Under Review" });
        if (activeQueueCheck) return res.status(400).json({ message: "An application packet for this worker is already active inside review queues." });

        const initialLogEntry = {
            action: "Submitted", by_user: req.user.userid || req.user.id || "Supplier Portal", timestamp: new Date().toISOString(), notes: "Initial documentation packet successfully registered to database storage bucket."
        };

        const newRequest = new MobilizationRequest({
            civil_id: cleanCivilId,
            employee_name: employee_name.trim(),
            nationality,
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
            status: "Under Review", urgency: urgency || "Normal", submission_history: [initialLogEntry]
        });

        await newRequest.save();

        // 🌟 SUCCESS: Run automated storage cleanup on buffered temporary local files instantly
        temporaryFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        res.status(201).json({ message: "Workforce mobilization request package registered successfully!", request: newRequest });

    } catch (error) {
        // FAIL GUARD: Clear out temporary file buffers if a validation fault blocks the save transaction
        temporaryFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        res.status(500).json({ message: "Error compiling mobilization records parameters", error: error.message });
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

module.exports = { 
    createMobilizationRequest, 
    getSupplierOwnMobilizations, 
    dropMobilizationRequest, 
    resubmitMobilizationDocuments 
};
