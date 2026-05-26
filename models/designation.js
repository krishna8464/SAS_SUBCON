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
