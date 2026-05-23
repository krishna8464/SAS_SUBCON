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