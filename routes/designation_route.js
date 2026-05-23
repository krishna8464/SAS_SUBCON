const express = require("express");
const { createDesignation, getAllDesignations, getDesignationById, updateDesignation, deleteDesignation } = require("../controllers/designation_controller");
const { authMiddleware } = require("../middleware/auth");

const Designationroute = express.Router();

Designationroute.get("/manage-designations", (req, res) => res.render("manage_designations"));
Designationroute.post("/create", authMiddleware, createDesignation);
Designationroute.get("/all", authMiddleware, getAllDesignations);
Designationroute.get("/:id", authMiddleware, getDesignationById);
Designationroute.put("/update/:id", authMiddleware, updateDesignation);
Designationroute.delete("/delete/:id", authMiddleware, deleteDesignation);




module.exports = { Designationroute };
