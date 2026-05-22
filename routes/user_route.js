const express = require("express");
const { welcometouser , createUser , loginUser , logoutUser } = require("../controlers/user_controller");
const { authMiddleware } = require("../middleware/auth")

const Userroute = express.Router();

Userroute.get("/",welcometouser);
Userroute.post("/register",createUser);
Userroute.post("/login",loginUser);
Userroute.post("/logout", authMiddleware , logoutUser);

Userroute.get("/login-page", (req, res) => {
    res.render("login"); // Matches the exact filename of views/login.ejs
});

module.exports = { Userroute };