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
