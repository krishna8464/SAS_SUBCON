const express = require("express");
const { connection } = require("./config/db");
const { Userroute } = require("./routes/user_route");
const { Siteroute } = require("./routes/sites_route");
const { Supplierroute } = require("./routes/suppliers_route");
const { Designationroute } = require("./routes/designation_route");
const { Mobilizationroute } = require("./routes/mobilization_route");
const { AdminReviewRoute } = require("./routes/admin_review_route");

require("dotenv").config();
const cors = require("cors");
const path = require("path");
const { logger } = require("./middleware/logger");
const { errorHandler } = require("./middleware/errorhandler"); // Keep import here

const app = express();
app.use(express.json());
// 🌟 FIXED: Removed errorHandler from this line slot right here!

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors({ origin : "*" }));

// Base Route Root
app.get("/", async(req, res) => {
    try { res.send("Welcome to the SAS Management"); } 
    catch (error) { res.send("something went wrong"); }
});

// Mounted Application Gateways API Modules
app.use("/user", Userroute);
app.use("/site", Siteroute);
app.use("/supplier", Supplierroute);
app.use("/designation", Designationroute);
app.use("/mobilization", Mobilizationroute);
app.use("/admin-review", AdminReviewRoute);

// Handle invalid routes
app.use(logger, (req, res) => {
    res.status(404).send({ error: 'Not found' });
});

// 🌟 FIXED: MOUNTED ERROR HANDLER HERE AT THE ABSOLUTE BOTTOM TO WORK CORRECTLY
app.use(errorHandler);

app.listen(process.env.port, async () => {
    try {
        await connection;
        console.log("server is connect to DB");
        console.log(`server is connected to ${process.env.port}`);
    } catch (error) {
        console.log(error);
        console.log("Not able to connect to DB");
    }
});
