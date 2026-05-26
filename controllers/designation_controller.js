const Designation = require("../models/designation"); // Adjust case to match your Designation model file name

// 1. CREATE A NEW JOB DESIGNATION TITLE
const createDesignation = async (req, res) => {
    try {
        const { title, risk_level } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Designation title is required." });
        }

        const trimmedTitle = title.trim();

        // CASE-INSENSITIVE CHECK: Ensures "Welder" and "welder" do not duplicate
        const existingDesignation = await Designation.findOne({
            title: { $regex: new RegExp(`^${trimmedTitle}$`, "i") }
        });

        if (existingDesignation) {
            return res.status(400).json({ message: `The designation '${trimmedTitle}' already exists.` });
        }

        const newDesignation = new Designation({
        title: trimmedTitle,
        risk_level: risk_level || "Low",
        status: req.body.status || "Active" // 🌟 FIXED HERE: Guarantees status field is populated
        });

        await newDesignation.save();
        res.status(201).json({ message: "Designation added successfully", designation: newDesignation });

    } catch (error) {
        res.status(500).json({ message: "Error creating designation", error: error.message });
    }
};

// 2. GET ALL DESIGNATIONS (Sorted Alphabetically for Form Selection Lists)
const getAllDesignations = async (req, res) => {
    try {
        const designations = await Designation.find().sort({ title: 1 });
        res.status(200).json({ count: designations.length, designations });
    } catch (error) {
        res.status(500).json({ message: "Error fetching designations", error: error.message });
    }
};

// 3. GET SINGLE DESIGNATION BY UNIQUE OBJECT ID
const getDesignationById = async (req, res) => {
    try {
        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ message: "Designation role not found." });
        }
        res.status(200).json(designation);
    } catch (error) {
        res.status(500).json({ message: "Error fetching designation profile", error: error.message });
    }
};

// 4. UPDATE DESIGNATION DETAILS
const updateDesignation = async (req, res) => {
    try {
        const { title, risk_level } = req.body;
        const currentId = req.params.id;
        const updateFields = {};

        if (title) {
            const cleanTitle = title.trim();
            const titleCollision = await Designation.findOne({
                title: { $regex: new RegExp(`^${cleanTitle}$`, "i") },
                _id: { $ne: currentId }
            });
            if (titleCollision) {
                return res.status(400).json({ message: "This job title already matches an existing designation." });
            }
            updateFields.title = cleanTitle;
        }

        if (risk_level) updateFields.risk_level = risk_level;

        const updatedDesignation = await Designation.findByIdAndUpdate(
            currentId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedDesignation) {
            return res.status(404).json({ message: "Designation update failed or record not found." });
        }

        res.status(200).json({ message: "Designation updated cleanly", designation: updatedDesignation });

    } catch (error) {
        res.status(500).json({ message: "Error updating designation details", error: error.message });
    }
};

// 5. DELETE DESIGNATION
const deleteDesignation = async (req, res) => {
    try {
        // 1. Fetch the target job designation profile to check its current database state value
        const targetDesignation = await Designation.findById(req.params.id);
        if (!targetDesignation) {
            return res.status(404).json({ message: "Job designation records not found." });
        }

        // 2. Compute the exact opposite state value toggle parameter dynamically
        const nextStatusState = targetDesignation.status === "Active" ? "Inactive" : "Active";

        // 3. Execute the single-run modification swap block using the returnDocument 'after' standard
        const toggledDesignation = await Designation.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the fresh updated state values instantly
        );

        res.status(200).json({ 
            message: `Designation successfully toggled to ${nextStatusState} status.`, 
            designation: toggledDesignation 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing designation status parameter", error: error.message });
    }
};
module.exports = {
    createDesignation,
    getAllDesignations,
    getDesignationById,
    updateDesignation,
    deleteDesignation
};
