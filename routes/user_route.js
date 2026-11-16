const express = require("express");
const { 
    welcometouser, 
    createUser, 
    getAllUserProfiles,       // 🌟 ADDED: Controller to fetch all system accounts
    toggleUserAccountStatus,  // 🌟 ADDED: Controller to toggle active state filters
    loginUser, 
    logoutUser, 
    updateSupplierId,
    updateUserProfile 
} = require("../controllers/user_controller");
const { authMiddleware } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/role_access");

const Userroute = express.Router();

// 1. FRONTEND WORKSPACE PAGE RENDERING VIEWS REROUTES
Userroute.get("/login-page", (req, res) => {
    res.render("login");
});

Userroute.get("/dashboard-view", authMiddleware, (req, res) => {
    const role = req.user.role;

    if (role === 'SUPPLIER') return res.redirect('/mobilization/portal');
    if (['SITE_MEDIC', 'SITE_HSE'].includes(role)) return res.redirect('/user/medic-dashboard');
    if (role === 'SITE_MANAGER') return res.redirect('/site/manage-sites');
    if (['HO', 'ERP_TEAM', 'DEVELOPER'].includes(role)) return res.render('dashboard', { role });

    return res.redirect('/user/login-page');
});

Userroute.get("/manage-users", authMiddleware, authorizeRoles('HO', 'ERP_TEAM', 'DEVELOPER'), (req, res) => {
    res.render("manage_users");
});

Userroute.get("/medic-dashboard", authMiddleware, authorizeRoles('SITE_MEDIC', 'SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), (req, res) => {
    res.render("medic_dashboard");
});

Userroute.get("/hse-dashboard", authMiddleware, authorizeRoles('SITE_HSE', 'HO', 'ERP_TEAM', 'DEVELOPER'), (req, res) => {
    res.render("medic_dashboard");
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

Userroute.put("/update-profile/:id", authMiddleware, updateUserProfile);

module.exports = { Userroute };
