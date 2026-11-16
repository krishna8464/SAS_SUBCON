const express = require("express");
const { createDesignation, getAllDesignations, getDesignationById, updateDesignation, deleteDesignation } = require("../controllers/designation_controller");
const { authMiddleware } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/role_access");

const Designationroute = express.Router();

Designationroute.get("/manage-designations", authMiddleware, authorizeRoles('HO', 'ERP_TEAM', 'DEVELOPER', 'SITE_MANAGER'), (req, res) => res.render("manage_designations"));
Designationroute.post("/create", authMiddleware, createDesignation);
Designationroute.get("/all", authMiddleware, getAllDesignations);
Designationroute.get("/:id", authMiddleware, getDesignationById);
Designationroute.put("/update/:id", authMiddleware, updateDesignation);
Designationroute.delete("/delete/:id", authMiddleware, deleteDesignation);




module.exports = { Designationroute };
