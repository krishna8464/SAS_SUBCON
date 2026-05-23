const express = require("express");
const { createSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier } = require("../controllers/suppliers_controller");
const { authMiddleware } = require("../middleware/auth");

const Supplierroute = express.Router();

Supplierroute.get("/manage-suppliers", (req, res) => res.render("manage_suppliers"));
Supplierroute.post("/create", authMiddleware, createSupplier);
Supplierroute.get("/all", authMiddleware, getAllSuppliers);
Supplierroute.get("/:id", authMiddleware, getSupplierById);
Supplierroute.put("/update/:id", authMiddleware, updateSupplier);
Supplierroute.delete("/delete/:id", authMiddleware, deleteSupplier);




module.exports = { Supplierroute };
