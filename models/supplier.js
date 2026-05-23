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
