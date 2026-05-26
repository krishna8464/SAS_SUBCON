const Site = require("../models/sites"); // Ensure this path matches your file structure exactly

// 1. CREATE A NEW PHYSICAL OPERATIONAL SITE (With Site Code & Case-Insensitive Checks)
const createSite = async (req, res) => {
    try {
        const { site_code, site_name, location, status } = req.body;

        // Basic validation check
        if (!site_code || !site_name || !location) {
            return res.status(400).json({ message: "Site Code, Site Name, and Location are all required." });
        }

        const trimmedCode = site_code.trim().toUpperCase();
        const trimmedName = site_name.trim();

        // Check A: Verify if the short Site Code already exists
        const existingCode = await Site.findOne({ site_code: trimmedCode });
        if (existingCode) {
            return res.status(400).json({ message: `Site Code '${trimmedCode}' is already taken.` });
        }

        // Check B: Case-insensitive verify for the full descriptive Site Name
        const existingName = await Site.findOne({ 
            site_name: { $regex: new RegExp(`^${trimmedName}$`, "i") } 
        });
        if (existingName) {
            return res.status(400).json({ message: `A site with the name '${trimmedName}' already exists.` });
        }

        // Build and save the clean record
        const newSite = new Site({
            site_code: trimmedCode,
            site_name: trimmedName,
            location: location.trim(),
            status: status || "Active"
        });

        await newSite.save();
        res.status(201).json({ message: "Site registered successfully", site: newSite });

    } catch (error) {
        res.status(500).json({ message: "Error creating site", error: error.message });
    }
};

// 2. GET ALL SITES (Sorted Alphabetically by Site Code)
const getAllSites = async (req, res) => {
    try {
        const sites = await Site.find().sort({ site_code: 1 });
        res.status(200).json({ count: sites.length, sites });
    } catch (error) {
        res.status(500).json({ message: "Error fetching sites", error: error.message });
    }
};

// 3. GET A SINGLE SITE BY ID
const getSiteById = async (req, res) => {
    try {
        const site = await Site.findById(req.params.id);
        if (!site) {
            return res.status(404).json({ message: "Site not found" });
        }
        res.status(200).json(site);
    } catch (error) {
        res.status(500).json({ message: "Error fetching site details", error: error.message });
    }
};

// 4. UPDATE SITE DETAILS (With Code and Name Collision Check Protection)
const updateSite = async (req, res) => {
    try {
        const { site_code, site_name, location, status } = req.body;
        const currentSiteId = req.params.id;

        // Object to hold fields that need to be updated
        const updateFields = {};

        // If site code is being updated, verify it is unique across other entries
        if (site_code) {
            const cleanCode = site_code.trim().toUpperCase();
            const codeCollision = await Site.findOne({ site_code: cleanCode, _id: { $ne: currentSiteId } });
            if (codeCollision) {
                return res.status(400).json({ message: `Site Code '${cleanCode}' is already used by another site.` });
            }
            updateFields.site_code = cleanCode;
        }

        // If site name is being updated, run case-insensitive collision checks
        if (site_name) {
            const cleanName = site_name.trim();
            const nameCollision = await Site.findOne({ 
                site_name: { $regex: new RegExp(`^${cleanName}$`, "i") }, 
                _id: { $ne: currentSiteId } 
            });
            if (nameCollision) {
                return res.status(400).json({ message: `Site name '${cleanName}' is already used by another site.` });
            }
            updateFields.site_name = cleanName;
        }

        if (location) updateFields.location = location.trim();
        if (status) updateFields.status = status;

        const updatedSite = await Site.findByIdAndUpdate(
            currentSiteId,
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true } // Modified here
        );

        if (!updatedSite) {
            return res.status(404).json({ message: "Site not found or update failed" });
        }

        res.status(200).json({ message: "Site updated successfully", site: updatedSite });

    } catch (error) {
        res.status(500).json({ message: "Error updating site details", error: error.message });
    }
};

// 5. SOFT-DELETE SITE (Toggles status to Inactive to preserve audit integrity)
// 5. INTELLIGENT TOGGLE SITE STATUS (Fixed Double-Click Toggle Bug)
const deleteSite = async (req, res) => {
    try {
        // 1. Fetch the target site profile first to assess its current state value
        const targetSite = await Site.findById(req.params.id);
        if (!targetSite) {
            return res.status(404).json({ message: "Operational site profile not found." });
        }

        // 2. Compute the exact opposite binary state value toggle parameter
        const nextStatusState = targetSite.status === "Active" ? "Inactive" : "Active";

        // 3. Execute the single-run modification swap block using the new returnDocument standard
        const toggledSite = await Site.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the brand new updated document state variables instantly
        );

        res.status(200).json({ 
            message: `Site successfully flipped to ${nextStatusState} status.`, 
            site: toggledSite 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing site operational indicator state", error: error.message });
    }
};


module.exports = {
    createSite,
    getAllSites,
    getSiteById,
    updateSite,
    deleteSite
};
