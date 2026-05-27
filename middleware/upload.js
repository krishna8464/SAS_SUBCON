const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the local temporary upload directory paths exist cleanly inside workspace disks
const tempDir = path.join(__dirname, "../public/uploads/tmp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure robust local disk buffering configuration parameters
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure the multer execution limit engine parameters
const upload = multer({
    storage: diskStorage,
    fileFilter: (req, file, cb) => {
        // Enforce file validation check: Allow PDF files only
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Invalid file type! Only official PDF documents are authorized for upload."), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5 Megabytes maximum threshold limit per document
});

// Intercept up to 3 files concurrently matching your frontend naming markers
const uploadMobilizationFiles = upload.fields([
    { name: "medical_file", maxCount: 1 },
    { name: "hse_file", maxCount: 1 },
    { name: "wqt_file", maxCount: 1 }
]);

module.exports = { uploadMobilizationFiles };
