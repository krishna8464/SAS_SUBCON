const express = require("express");
const mongoose = require("mongoose");
const { getGfsBucket } = require("../config/db");
const { 
    createMobilizationRequest, 
    getSupplierOwnMobilizations, 
    dropMobilizationRequest, 
    resubmitMobilizationDocuments,
    getRequestDetailedContext,
    resubmitWorkerDocumentCorrection
} = require("../controllers/mobilization_controller");
const { authMiddleware } = require("../middleware/auth");
const { uploadMobilizationFiles } = require("../middleware/upload"); // 🌟 IMPORT UPLOAD MIDDLEWARE

const Mobilizationroute = express.Router();

// 1. FRONTEND USER SUBCONTRACTOR VIEW ROUTE
Mobilizationroute.get("/portal", (req, res) => {
    res.render("supplier_portal"); // Renders your upcoming views/supplier_portal.ejs file
});

Mobilizationroute.get("/request-details/:id", (req, res) => {
    res.render("request_details", { requestId: req.params.id }); 
});

// 2. PROTECTED DATA API TRANSACTION PIPELINE ROUTING
Mobilizationroute.get("/my-submissions", authMiddleware, getSupplierOwnMobilizations);
Mobilizationroute.put("/drop-request/:id", authMiddleware, dropMobilizationRequest); // Supplier 'Drop / Cancel' Route hook
Mobilizationroute.put("/resubmit/:id", authMiddleware, resubmitMobilizationDocuments); // Dynamic document re-submission route
// 🌟 UPDATED: Added uploadMobilizationFiles directly into your POST route pipeline!
Mobilizationroute.post("/submit-worker", authMiddleware, uploadMobilizationFiles, createMobilizationRequest);
Mobilizationroute.get("/request-context/:id", authMiddleware, getRequestDetailedContext);
Mobilizationroute.post("/resubmit-file/:id", authMiddleware, uploadMobilizationFiles, resubmitWorkerDocumentCorrection);

Mobilizationroute.get("/file/:id", async (req, res) => {
    try {
        const fileIdString = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(fileIdString)) {
            return res.status(400).json({ message: "Invalid binary file tracking ID parameter format." });
        }

        const fileObjectId = new mongoose.Types.ObjectId(fileIdString);

        // 🌟 CRITICAL FIX: Direct native bucket instance binding matching your controller setup exactly
        const structuralBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });

        // Open a continuous data read stream from your workforce_docs collections chunks
        const downloadStream = structuralBucket.openDownloadStream(fileObjectId);

        // Intercept pipeline stream errors (like file missing) cleanly without crashing your node app
        downloadStream.on("error", (streamError) => {
            console.error("GridFS Stream Intercept Fault:", streamError.message);
            return res.status(404).json({ message: "Requested document profile attachment not found on database disks." });
        });

        // Set response headers to display the document cleanly in a tab view instead of downloading
        res.set("Content-Type", "application/pdf");
        res.set("Content-Disposition", "inline");

        // Pipe your data fragments straight to your browser display viewport
        downloadStream.pipe(res);

    } catch (err) {
        console.error("Exception triggered inside download stream router route:", err.message);
        res.status(500).json({ message: "Internal server error streaming binary data chunks from MongoDB disks.", error: err.message });
    }
});


module.exports = { Mobilizationroute };
