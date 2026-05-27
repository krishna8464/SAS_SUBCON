const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Token = require("../models/token");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

// 1. WELCOME BASE ROUTE
const welcometouser = async (req, res) => {
    try {
        res.status(200).json({ message: "Welcome to user routes" });
    } catch (error) {
        res.status(500).json({ message: "Welcome route not working", error: error.message });
    }
};

// 2. CREATE OPERATION: DISPATCH NEW USER PROFILE PACKET
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, site_id, supplier_id, cell_number } = req.body;

        if (!name || !email || !password || !role || !cell_number) {
            return res.status(400).json({ message: "All profile metadata attributes fields are mandatory." });
        }

        const emailClean = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: emailClean });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        // Handle structural payload parameters conversions cleanly based on selected job roles
        let cleanSiteId = (site_id === "" || !site_id) ? null : new mongoose.Types.ObjectId(site_id.trim());
        let cleanSupplierId = (supplier_id === "" || !supplier_id) ? null : new mongoose.Types.ObjectId(supplier_id.trim());

        if (['HO', 'ERP_TEAM', 'DEVELOPER'].includes(role)) {
            cleanSiteId = null;
            cleanSupplierId = null;
        } else if (role === 'SUPPLIER') {
            if (!cleanSupplierId) return res.status(400).json({ message: "Validation Blocked! SUPPLIER roles require linking a Supplier Company ID." });
            cleanSiteId = null;
        } else {
            if (!cleanSiteId) return res.status(400).json({ message: `Validation Blocked! ${role} role requires allocating a physical site location link.` });
            cleanSupplierId = null;
        }

        const newUser = new User({
            name: name.trim(),
            email: emailClean,
            password, // Plain text string passes cleanly; your pre-save schema hook handles hashing automatically
            role,
            site_id: cleanSiteId,
            supplier_id: cleanSupplierId,
            cell_number: cell_number.trim(),
            status: "Active" // 🌟 Forces status default value mapping to Active status
        });

        await newUser.save();
        res.status(201).json({ message: "User created successfully", userId: newUser._id });

    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};

// 3. READ OPERATION: FETCH ALL ACCOUNTS WITH MULTI-COLLECTION POPULATE JOINS
const getAllUserProfiles = async (req, res) => {
    try {
        // Hydrates MongoDB ObjectIds into clear textual reference records models
        const directory = await User.find()
            .populate("site_id", "site_name location site_code")
            .populate("supplier_id", "supplier_name registration_number")
            .sort({ createdAt: -1 });

        res.status(200).json({ count: directory.length, users: directory });
    } catch (error) {
        res.status(500).json({ message: "Error reading master credentials user directory stream", error: error.message });
    }
};
// 4. UPDATE OPERATION: STATE SWITCH TOGGLE OVERRIDE & INSTANT DISCONNECT
const toggleUserAccountStatus = async (req, res) => {
    try {
        const targetId = req.params.id;
        const targetAccount = await User.findById(targetId);

        if (!targetAccount) {
            return res.status(404).json({ message: "Target personnel security profile row not found." });
        }

        const nextState = targetAccount.status === "Active" ? "Inactive" : "Active";
        targetAccount.status = nextState;
        await targetAccount.save();

        // 🌟 SECURITY SHUTDOWN CASCADE: If an account is deactivated, instantly drop their active session tokens!
        if (nextState === "Inactive") {
            await Token.updateMany({ user_id: targetAccount._id }, { $set: { is_active: false } });
            console.log(`Security Notice: User session revoked for deactivated account ID: ${targetAccount._id}`);
        }

        res.status(200).json({ message: `User identity profile status successfully mapped to [${nextState}] status state.`, user: targetAccount });
    } catch (error) {
        res.status(500).json({ message: "Error compiling status state modifications loops", error: error.message });
    }
};

// 5. SESSION PIPELINE: VERIFY IDENTITY & PACK UNIFORM JWT PAYLOAD
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🌟 SAFETY BLOCK: Instantly deny entry transactions if the user document is flagged Inactive!
        if (user.status === "Inactive") {
            return res.status(403).json({ message: "Access Suspended! Your corporate identity profile has been deactivated. Contact an ERP System Admin." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Enforce single-device validation locks by wiping older session tokens
        await Token.updateMany({ user_id: user._id, is_active: true }, { $set: { is_active: false } });

        // Pack payload attributes into a clean, uniform lowercase structure matching your auth middleware
        const token = jwt.sign(
            { 
                userid: user._id, 
                role: user.role, 
                siteId: user.site_id,
                supplier_id: user.supplier_id 
            }, 
            JWT_SECRET, 
            { expiresIn: "1d" }
        );

        await Token.create({ token, is_active: true, user_id: user._id });

        res.status(200).json({ 
            message: "Login successful", 
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                site_id: user.site_id,
                supplierId: user.supplier_id // Synchronizes cleanly with your frontend caching storage engine
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// 6. TERMINATE OPERATION: SECURE LOGOUT TERMINATION RUN
const logoutUser = async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1]; 
    if (!token) return res.status(400).json({ message: "Token missing in Authorization header" });

    try {
        const tokenDoc = await Token.findOne({ token, is_active: true });
        if (!tokenDoc) return res.status(404).json({ message: "Token not found or already logged out" });

        tokenDoc.is_active = false;
        await tokenDoc.save();
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ message: "Logout failed", error: err.message });
    }
};

// 7. MAINTENANCE OPTION: UPDATE USER SUPPLIER LINK (POSTMAN BACKWARD RECOMPILING TOOL)
const updateSupplierId = async (req, res) => {
    try {
        const { userId, supplierId } = req.body;
        if (!userId || !supplierId) return res.status(400).json({ message: "Both unique Target User ID and Supplier Company ID must be supplied." });

        const updatedUser = await User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId.trim()),
            { $set: { supplier_id: new mongoose.Types.ObjectId(supplierId.trim()) } },
            { new: true }
        );
        if (!updatedUser) return res.status(404).json({ message: "Target user account not found in system directories." });

        res.status(200).json({ message: "User supplier association updated successfully inside database layers!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: "Error compiling account parameter modification overrides", error: error.message });
    }
};

module.exports = { 
    welcometouser, 
    createUser, 
    getAllUserProfiles, 
    toggleUserAccountStatus, 
    loginUser, 
    logoutUser, 
    updateSupplierId 
};
