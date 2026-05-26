const Supplier = require("../models/supplier"); // Ensure this matches your file casing exactly

// 1. REGISTER A NEW SUBCONTRACTOR COMPANY
const createSupplier = async (req, res) => {
    try {
        const { supplier_name, cr_number, contact_email, contact_phone, status } = req.body;

        // Validation: Verify all required data fields are supplied
        if (!supplier_name || !cr_number || !contact_email || !contact_phone) {
            return res.status(400).json({ message: "Supplier Name, CR Number, Email, and Phone number are all required." });
        }

        const trimmedCR = cr_number.trim();
        const trimmedName = supplier_name.trim();

        // Check A: Verify Oman Commercial Registration (CR) Number is absolutely unique
        const existingCR = await Supplier.findOne({ cr_number: trimmedCR });
        if (existingCR) {
            return res.status(400).json({ message: `A company with CR Number '${trimmedCR}' is already registered.` });
        }

        // Check B: Case-insensitive check to prevent duplicate Company Name strings
        const existingName = await Supplier.findOne({
            supplier_name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
        });
        if (existingName) {
            return res.status(400).json({ message: `A supplier named '${trimmedName}' already exists in the system.` });
        }

        // Build and save the clean record
        const newSupplier = new Supplier({
            supplier_name: trimmedName,
            cr_number: trimmedCR,
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone: contact_phone.trim(), 
            status: status || "Active"
        });

        await newSupplier.save();
        res.status(201).json({ message: "Supplier registered successfully", supplier: newSupplier });

    } catch (error) {
        res.status(500).json({ message: "Error registering supplier", error: error.message });
    }
};

// 2. FETCH ALL REGISTERED SUPPLIERS (Sorted Alphabetically by Company Name)
const getAllSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort({ supplier_name: 1 });
        res.status(200).json({ count: suppliers.length, suppliers });
    } catch (error) {
        res.status(500).json({ message: "Error fetching suppliers", error: error.message });
    }
};

// 3. GET A SINGLE SUPPLIER BY UNIQUE OBJECT ID
const getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: "Supplier company records not found." });
        }
        res.status(200).json(supplier);
    } catch (error) {
        res.status(500).json({ message: "Error fetching supplier profile", error: error.message });
    }
};

// 4. UPDATE SUPPLIER PROFILES (With Safety Collision Checks)
const updateSupplier = async (req, res) => {
    try {
        const { supplier_name, cr_number, contact_email, contact_phone, status } = req.body;
        const currentId = req.params.id;
        const updateFields = {};

        // If CR number is being modified, ensure it doesn't collide with another company record
        if (cr_number) {
            const cleanCR = cr_number.trim();
            const crCollision = await Supplier.findOne({ cr_number: cleanCR, _id: { $ne: currentId } });
            if (crCollision) {
                return res.status(400).json({ message: "This CR number is already registered to another subcontractor." });
            }
            updateFields.cr_number = cleanCR;
        }

        // If Company Name is modified, perform a case-insensitive validation guard check
        if (supplier_name) {
            const cleanName = supplier_name.trim();
            const nameCollision = await Supplier.findOne({
                supplier_name: { $regex: new RegExp(`^${cleanName}$`, "i") },
                _id: { $ne: currentId }
            });
            if (nameCollision) {
                return res.status(400).json({ message: "This subcontractor company name already exists under another profile." });
            }
            updateFields.supplier_name = cleanName;
        }

        // Process other simple properties safely
        if (contact_email) updateFields.contact_email = contact_email.trim().toLowerCase();
        if (contact_phone) updateFields.contact_phone = contact_phone.trim();
        if (status) updateFields.status = status;

        const updatedSupplier = await Supplier.findByIdAndUpdate(
            currentId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedSupplier) {
            return res.status(404).json({ message: "Supplier profile update failed or record not found." });
        }

        res.status(200).json({ message: "Supplier details updated cleanly", supplier: updatedSupplier });

    } catch (error) {
        res.status(500).json({ message: "Error updating supplier profile", error: error.message });
    }
};

// 5. SUSPEND / DEACTIVATE SUPPLIER (Soft Delete)
// 5. INTELLIGENT BINARY STATUS TOGGLE ENGINE (Fixed Activation Loop Bug)
const deleteSupplier = async (req, res) => {
    try {
        // 1. Fetch the target subcontractor profile to check its current database state
        const targetSupplier = await Supplier.findById(req.params.id);
        if (!targetSupplier) {
            return res.status(404).json({ message: "Supplier company records not found." });
        }

        // 2. Compute the exact opposite state dynamically
        const nextStatusState = targetSupplier.status === "Active" ? "Inactive" : "Active";

        // 3. Update the record with the dynamic value using returnDocument: 'after'
        const toggledSupplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            { $set: { status: nextStatusState } },
            { returnDocument: 'after' } // Returns the fresh updated values instantly
        );

        res.status(200).json({ 
            message: `Supplier successfully set to ${nextStatusState} status.`, 
            supplier: toggledSupplier 
        });
    } catch (error) {
        res.status(500).json({ message: "Error changing supplier status parameter", error: error.message });
    }
};


module.exports = {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
};
