const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema({
  token: { 
    type: String, 
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  },
  // Linked directly to your Subcontractor 'User' model (HO, SITE_HSE, SUPPLIER, etc.)
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  // Automatically self-deletes from MongoDB after 7 days to keep data clean
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: "7d" 
  }
}, {
  versionKey: false
});

const Token = mongoose.model("Token", TokenSchema);

// Exporting directly as the model itself for standard Mongoose usage
module.exports = Token;