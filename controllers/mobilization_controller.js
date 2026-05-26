const MobilizationRequest = require("../models/mobilization_request");
const Designation = require("../models/designation");
const mongoose = require("mongoose");

// 1. DISPATCH NEW WORKFORCE MOBILIZATION RECOGNITION PACKET
const createMobilizationRequest = async (req, res) => {
    try {
        const { 
            civil_id, employee_name, nationality, dob, mobile_number, 
            designation_id, civil_expire, accommodation_type, target_site_id, 
            sponsor_company, medical_file_url, hse_file_url, wqt_file_url, urgency 
        } = req.body;

        // Extracts the authenticated subcontractor company ID linked by authMiddleware
        const sub_company_id = req.user.supplier_id; 

        // Core base validation guard check
        if (!civil_id || !employee_name || !nationality || !dob || !mobile_number || 
            !designation_id || !civil_expire || !accommodation_type || !target_site_id || 
            !sponsor_company || !medical_file_url || !hse_file_url) {
            return res.status(400).json({ message: "All required employee information and document file reference links are mandatory." });
        }

        // Strict accommodation type structural verification boundary check
        const allowedAccommodations = ["1SS", "2SS", "3SS", "1JS", "2JS", "3JS"];
        if (!allowedAccommodations.includes(accommodation_type)) {
            return res.status(400).json({ message: "Invalid field entry! Accommodation type must map strictly to: 1SS, 2SS, 3SS, 1JS, 2JS, or 3JS." });
        }

        const cleanCivilId = civil_id.trim();

        // SECURITY GUARD A: Query your native blacklists log collection map to enforce safety boundaries
        const isBlacklisted = await mongoose.connection.collection("blacklist").findOne({ civil_id: cleanCivilId });
        if (isBlacklisted) {
            return res.status(403).json({ 
                message: `Deployment Blocked! Employee Civil ID '${cleanCivilId}' is permanently blacklisted. Reason: ${isBlacklisted.reason_for_blacklisting || 'Compliance Violation'}` 
            });
        }

        // SECURITY GUARD B: Smart Queue Check - ONLY block if this worker has an entry actively sitting in 'Under Review' status state.
        // Historic applications that are already Approved, Rejected, or Cancelled are completely ignored, allowing re-mobilization over time!
        const activeQueueCheck = await MobilizationRequest.findOne({ 
            civil_id: cleanCivilId, 
            status: "Under Review" 
        });
        
        if (activeQueueCheck) {
            return res.status(400).json({ 
                message: "Duplicate registration rejected! A mobilization package for this worker is currently active inside the evaluation review queues." 
            });
        }

        // 2. Fetch selected trade designation data to enforce specialized Oman welder constraints
        const tradeProfile = await Designation.findById(designation_id);
        if (!tradeProfile) {
            return res.status(404).json({ message: "Selected Designation Job Title classification not found in system catalogs." });
        }

        const isWelderTrade = tradeProfile.title.toLowerCase().includes("welder");
        let assignedWqtComment = "Not Required for this Trade";
        let verifiedWqtUrl = "";

        // WELDER MANDATORY WQT CARD SUBMISSION CONSTRAINT RULE
        if (isWelderTrade) {
            if (!wqt_file_url) {
                return res.status(400).json({ message: "Compliance Verification Blocked! Workers under Welder designations must possess a valid Welder Qualification Test (WQT) card file attachment link." });
            }
            assignedWqtComment = "Pending Welder Review Team Evaluation";
            verifiedWqtUrl = wqt_file_url;
        }

        // Construct initial logging snapshot inside submission history tracking maps
        const initialLogEntry = {
            action: "Submitted",
            by_user: req.user.id || "Supplier Portal",
            timestamp: new Date().toISOString(),
            notes: `Initial package cataloged. Welder special WQT requirements: ${isWelderTrade ? "Enabled" : "Bypassed"}.`
        };

        const newRequest = new MobilizationRequest({
            civil_id: cleanCivilId,
            employee_name: employee_name.trim(),
            nationality: nationality.trim(),
            dob,
            mobile_number: mobile_number.trim(),
            designation_id,
            civil_expire,
            accommodation_type,
            target_site_id,
            sub_company_id,
            sponsor_company: sponsor_company.trim(),
            medical_file_url,
            hse_file_url,
            wqt_file_url: verifiedWqtUrl, 
            wqt_comment: assignedWqtComment,
            status: "Under Review",
            urgency: urgency || "Normal", 
            submission_history: [initialLogEntry]
        });

        await newRequest.save();
        res.status(201).json({ message: "Workforce mobilization request package successfully registered and saved into review queues.", request: newRequest });

    } catch (error) {
        res.status(500).json({ message: "Error compiling mobilization record metadata attributes", error: error.message });
    }
};
// 2. FETCH HISTORICAL MOBILIZATION LOGS FOR THE SPECIFIC LOGGED SUPPLIER ONLY
const getSupplierOwnMobilizations = async (req, res) => {
    try {
        const companyId = req.user.supplier_id;

        // Executes populate schema queries to replace ObjectIDs with clear textual reference labels
        const history = await MobilizationRequest.find({ sub_company_id: companyId })
            .populate("designation_id", "title risk_level")
            .populate("target_site_id", "site_name location")
            .sort({ createdAt: -1 });

        res.status(200).json({ count: history.length, requests: history });
    } catch (error) {
        res.status(500).json({ message: "Error syncing workforce mobilization registry history streams", error: error.message });
    }
};

// 3. SUBCONTRACTOR SUPPLIER SYSTEM DROP / WITHDRAW FUNCTIONALITY
const dropMobilizationRequest = async (req, res) => {
    try {
        const currentId = req.params.id;

        // Locates application data, verifying it explicitly belongs to the requesting logged supplier tenant bounds
        const request = await MobilizationRequest.findOne({ 
            _id: currentId, 
            sub_company_id: req.user.supplier_id 
        });

        if (!request) {
            return res.status(404).json({ message: "Mobilization application profile tracking packet not found or access unauthorized." });
        }

        // SAFETY IRREVERSIBLE STAGE GATE CHECK: Drop can only be processed before validation reaches Tier 3 Head Office
        const advancedPipelineStates = ["Approved", "Pending HO Approval", "Pending Site Admin", "Rejected"];
        if (advancedPipelineStates.includes(request.status)) {
            return res.status(400).json({ 
                message: `Drop action rejected! This worker application packet has already advanced downstream (Current Status: ${request.status}) and can no longer be dropped.` 
            });
        }

        request.status = "Cancelled";
        request.submission_history.push({
            action: "Cancelled",
            by_user: req.user.id || "Supplier Portal",
            timestamp: new Date().toISOString(),
            notes: "Subcontractor manager successfully invoked portal drop action parameter hook to cancel application pack."
        });

        await request.save();
        res.status(200).json({ message: "Application package successfully withdrawn from evaluation pipelines and set to Cancelled status.", request });

    } catch (error) {
        res.status(500).json({ message: "Error executing subscriber deployment package drop process", error: error.message });
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
