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
            risk_level: risk_level || "Low"
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
        const deletedDesignation = await Designation.findByIdAndDelete(req.params.id);
        if (!deletedDesignation) {
            return res.status(404).json({ message: "Designation not found." });
        }
        res.status(200).json({ message: "Designation removed successfully from master records." });
    } catch (error) {
        res.status(500).json({ message: "Error removing designation data record", error: error.message });
    }
};

module.exports = {
    createDesignation,
    getAllDesignations,
    getDesignationById,
    updateDesignation,
    deleteDesignation
};
