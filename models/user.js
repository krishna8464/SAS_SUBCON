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
    }
}, {
    timestamps: true,
    versionKey: false
});

// --- Pre-Save Hook: Automatically hash password before saving to database ---
UserSchema.pre("save", async function () {
    // Only hash the password if it has been modified or is brand new
    if (!this.isModified("password")) return;

    try {
        const saltRounds = 10; 
        const salt = await bcrypt.genSalt(saltRounds);
        this.password = await bcrypt.hash(this.password, salt);
        // No next() needed here! Returning finishes the pre-save hook smoothly.
    } catch (error) {
        throw error; // Mongoose intercepts thrown errors and passes them down safely
    }
});

// --- Method: Helper function to compare passwords during login ---
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);