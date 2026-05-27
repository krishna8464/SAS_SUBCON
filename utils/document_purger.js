const mongoose = require("mongoose");

// 🌟 CRITICAL FIX: Define a clean, inline schema to track files safely without raw driver calls
const GridFSFileSchema = new mongoose.Schema({}, { strict: false, collection: "workforce_docs.files" });
const GridFSFileModel = mongoose.models.GridFSFile || mongoose.model("GridFSFile", GridFSFileSchema);

/**
 * UTILITY ENGINE: Automatically deletes binary file blobs from GridFS collections
 * @param {Array} fileUrls - Array of string URL file paths to extract IDs from and delete
 */
const purgeWorkforceBinaryFiles = async (fileUrls) => {
    try {
        // Validation check: Bypass if array is empty or connection dropped
        if (!fileUrls || fileUrls.length === 0 || !mongoose.connection || !mongoose.connection.db) {
            return;
        }

        const structuralBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "workforce_docs"
        });
        
        for (const url of fileUrls) {
            // Safety Check: Bypass blank rows, null indices, or invalid paths safely
            if (!url || typeof url !== 'string' || url.trim() === "" || !url.includes("/")) {
                continue;
            }

            // Extract the unique hex string ID from trailing segment of your route path
            const urlSegments = url.split("/");
            const fileIdString = urlSegments[urlSegments.length - 1];

            if (fileIdString && mongoose.Types.ObjectId.isValid(fileIdString)) {
                const objectId = new mongoose.Types.ObjectId(fileIdString);
                
                try {
                    // 🌟 MULTI-CASE CRASH SAFE LOCK: Query using official Mongoose compile tracks!
                    const fileExists = await GridFSFileModel.findById(objectId);
                    
                    if (fileExists) {
                        // Fire absolute disk cleanup cascade execution rule command
                        await structuralBucket.delete(objectId);
                        console.log(`GridFS Disk Clean Success: Erased file chunks reference -> ${fileIdString}`);
                    } else {
                        console.log(`GridFS Cleanup Notice: File reference ID ${fileIdString} already missing from disk storage.`);
                    }
                } catch (bucketError) {
                    console.warn(`GridFS Document Purge Warning for ID ${fileIdString}: ${bucketError.message}`);
                }
            }
        }
    } catch (error) {
        console.error("Non-fatal exception triggered inside background File Purge utility pipeline:", error.message);
    }
};

module.exports = { purgeWorkforceBinaryFiles };
