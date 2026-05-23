const express = require("express");
const { createSite, getAllSites, getSiteById, updateSite, deleteSite } = require("../controllers/sites_controller");
const { authMiddleware } = require("../middleware/auth");

const Siteroute = express.Router();

Siteroute.get("/manage-sites", (req, res) => res.render("manage_sites"));
Siteroute.post("/create", authMiddleware, createSite);
Siteroute.get("/all", authMiddleware, getAllSites);
Siteroute.get("/:id", authMiddleware, getSiteById);
Siteroute.put("/update/:id", authMiddleware, updateSite);
Siteroute.delete("/delete/:id", authMiddleware, deleteSite);

module.exports = { Siteroute };
