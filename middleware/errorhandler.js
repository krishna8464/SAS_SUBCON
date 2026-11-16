function errorHandler(err, req, res, next) {
    console.error(err);

    if (req.accepts("html")) {
        return res.status(500).render("not_available", {
            message: "This page is not available right now. Please log in again.",
            redirectUrl: "/user/login-page"
        });
    }

    return res.status(500).json({
        errorMessage: "Server error",
    });
};

module.exports = {
    errorHandler
};