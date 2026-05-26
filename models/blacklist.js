const mongoose = require("mongoose");

const BlacklistSchema = new mongoose.Schema({
    civil_id: {
        type: String,
        required: true,
        trim: true,
        unique: true // Guarantees a barred ID cannot have duplicate blocks
    },
    reason_for_blacklisting: {
        type: String,
        required: true,
        trim: true
    },
    blacklisted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // References the user table collection identifier who issued the drop
        required: true
    },
    date_blacklisted: {
        type: Date,
        default: Date.now
    }
}, {
    versionKey: false
});

module.exports = mongoose.model("Blacklist", BlacklistSchema);
