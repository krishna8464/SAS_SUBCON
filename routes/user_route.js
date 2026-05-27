const express = require("express");
const { 
    welcometouser, 
    createUser, 
    getAllUserProfiles,       // 🌟 ADDED: Controller to fetch all system accounts
    toggleUserAccountStatus,  // 🌟 ADDED: Controller to toggle active state filters
    loginUser, 
    logoutUser, 
    updateSupplierId 
} = require("../controllers/user_controller");
const { authMiddleware } = require("../middleware/auth");

const Userroute = express.Router();

// 1. FRONTEND WORKSPACE PAGE RENDERING VIEWS REROUTES
Userroute.get("/login-page", (req, res) => {
    res.render("login"); // Renders your premium views/login.ejs authentication vault
});

Userroute.get("/manage-users", (req, res) => {
    res.render("manage_users"); // Renders your upcoming views/manage_users.ejs administrative deck
});

// 2. BACKEND REST DATA API TRANSACTION PIPELINE ENDPOINTS
Userroute.get("/", welcometouser);
Userroute.post("/register", createUser);
Userroute.post("/login", loginUser);
Userroute.put("/update", updateSupplierId);
Userroute.post("/logout", authMiddleware, logoutUser);

// New management route pipeline intersections mapping hooks
Userroute.get("/all", authMiddleware, getAllUserProfiles);                     // GET -> /user/all
Userroute.put("/toggle-status/:id", authMiddleware, toggleUserAccountStatus);  // PUT -> /user/toggle-status/:id

module.exports = { Userroute };
