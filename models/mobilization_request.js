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
