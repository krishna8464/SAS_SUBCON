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
    }
}, {
    versionKey: false
});

module.exports = mongoose.model("Designation", DesignationSchema);