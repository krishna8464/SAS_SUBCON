const mongoose = require("mongoose");
require("dotenv").config();

const connection = mongoose.connect(process.env.Mongo_url);

let gfsBucket;

mongoose.connection.once("open", () => {
    // 🌟 INJECTS NATIVE GRIDFS STREAMING STORAGE BUCKET CHANNELS
    gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "workforce_docs" // Automatically creates workforce_docs.files and workforce_docs.chunks collections
    });
    console.log("GridFS local binary document storage bucket initialized successfully.");
});

// Function to safely access the global bucket instance across other controller files
const getGfsBucket = () => {
    if (!gfsBucket) throw new Error("Database Bucket has not been fully established yet.");
    return gfsBucket;
};

module.exports = { connection, getGfsBucket };