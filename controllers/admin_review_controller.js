const MobilizationRequest = require("../models/mobilization_request");
const SubcontractorEmployee = require("../models/subcontractor_employee");

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

        if (!requestId || !room_number || !joining_date) {
            return res.status(400).json({ message: "Request ID, Room Number placement, and verified Joining Arrival Date fields are mandatory." });
        }

        const request = await MobilizationRequest.findById(requestId);
        if (!request) return res.status(404).json({ message: "Mobilization application request records not found." });
        if (request.status !== "Pending Site Admin") return res.status(400).json({ message: "This worker package parameters are not pending camp housing allocation steps." });

        const cleanRoom = room_number.trim();
        const cleanJoinDate = new Date(joining_date);

        // 1. Finalize and update Mobilization Tracker collection document attributes
        request.status = "Approved";
        request.room_number = cleanRoom;
        request.joining_date = cleanJoinDate;
        request.submission_history.push({ action: "Site Admin Cleared", by_user: req.user.id, timestamp: new Date().toISOString(), notes: `Camp accommodation verified: Room ${cleanRoom}. Mobilization check-in target date scheduled for: ${joining_date}. Workforce cleared to travel.` });
        await request.save();

        // 2. Dual-Sync Update: Instantly change the profile sheet collection properties in subcontractor_employees
        const employee = await SubcontractorEmployee.findOne({ mobilization_request_id: request._id });
        if (employee) {
            employee.employment_status = "Active"; // Flips to active now that space is confirmed
            employee.room_number = cleanRoom;
            employee.joining_date = cleanJoinDate;
            employee.mobilized_at = new Date();
            employee.history.push({ event_type: "Check-In Approved", from_state: "Pending Allocation", to_state: "Active", authorized_by: req.user.id, date: new Date().toISOString(), notes: `Lodging room placement completed: Assigned Room ${cleanRoom}. Worker authorized to enter camp gates.` });
            await employee.save();
        }

        res.status(200).json({ message: "Site workspace allocation success! Worker is now officially active and authorized to mobilize.", request });
    } catch (error) {
        res.status(500).json({ message: "Error processing local camp administrator check-in allocation routines", error: error.message });
    }
};

module.exports = { evaluateSiteComplianceDocs, processHeadOfficeApproval, allocateSiteAccommodation };
