const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Token = require("../models/token");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "SAS_SUBCON";

const welcometouser = async (req, res) => {
    try {
      res.status(200).json({ message: "Welcome to user routes" });
    } catch (error) {
      res.status(500).json({ message: "Welcome route not working", error: error.message });
    }
  };


// 1. CREATE USER / REGISTER ROUTER
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, site_id, cell_number } = req.body;

        // Validation: Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        // Handle empty/null site_id values safely for non-site roles
        const cleanSiteId = (site_id === "" || !site_id) ? null : site_id;

        // Instantiate new user document
        const newUser = new User({
            name,
            email,
            password, // Plain text here; the pre-save hook handles hashing automatically
            role,
            site_id: cleanSiteId,
            cell_number
        });

        // Save to MongoDB
        await newUser.save();

        res.status(201).json({ 
            message: "User created successfully", 
            userId: newUser._id 
        });

    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};


const loginUser = async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // 1. Find user by email (converted to lowercase to prevent case issues)
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // 2. Compare password using your schema's built-in helper method
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
  
      // 3. Invalidate old tokens for this specific user to enforce single-device login
      await Token.updateMany(
        { user_id: user._id, is_active: true },
        { $set: { is_active: false } }
      );
  
      // 4. Create new JWT token containing user ID, specific Role, and assigned Site ID
      const token = jwt.sign(
        { 
          userid: user._id, 
          role: user.role, 
          siteId: user.site_id 
        }, 
        JWT_SECRET, 
        { expiresIn: "1d" }
      );
  
      // 5. Save the active session reference token to MongoDB
      await Token.create({ 
        token, 
        is_active: true, 
        user_id: user._id 
      });
  
      // 6. Return response containing token and clean user info (omitting password string)
      res.status(200).json({ 
        message: "Login successful", 
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          site_id: user.site_id
        }
      });
  
    } catch (err) {
      res.status(500).json({ message: "Login failed", error: err.message });
    }
  };

  const logoutUser = async (req, res) => {
    // Extract token from header: "Bearer <token>"
    const token = req.headers.authorization?.split(" ")[1]; 
  
    if (!token) {
      return res.status(400).json({ message: "Token missing in Authorization header" });
    }
  
    try {
      // 1. Find the active token session document in MongoDB
      const tokenDoc = await Token.findOne({ token, is_active: true });
      
      if (!tokenDoc) {
        return res.status(404).json({ message: "Token not found or already logged out" });
      }
  
      // 2. Set active switch to false to close the validation gateway instantly
      tokenDoc.is_active = false;
      await tokenDoc.save();
  
      res.status(200).json({ message: "Logged out successfully" });
      
    } catch (err) {
      res.status(500).json({ message: "Logout failed", error: err.message });
    }
  };
  

module.exports = {welcometouser , createUser , loginUser , logoutUser}