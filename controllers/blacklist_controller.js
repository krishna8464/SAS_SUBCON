const Blacklist = require("../models/blacklist");
const MobilizationRequest = require("../models/mobilization_request");

// 1. ADD WORKER TO CORPORATE DEPLOYMENT BLACKLIST
const pushToBlacklist = async (req, res) => {
    try {
        const { civil_id, reason_for_blacklisting } = req.body;

        if (!civil_id || !reason_for_blacklisting) {
            return res.status(400).json({ message: "Worker Civil ID and explicit Reason are required parameters." });
        }

        const cleanId = civil_id.trim();
        const alreadyFlagged = await Blacklist.findOne({ civil_id: cleanId });
        if (alreadyFlagged) return res.status(400).json({ message: "This Civil ID indicator is already cataloged on the blacklist registry database." });

        const blockRecord = new Blacklist({
            civil_id: cleanId,
            reason_for_blacklisting: reason_for_blacklisting.trim(),
            blacklisted_by: req.user.id // Captured from safe user payload session tokens
        });

        await blockRecord.save();

        // CANCELLATION CASCADE: Instantly force-drop any active under-review applications for this worker
        await MobilizationRequest.updateMany(
            { civil_id: cleanId, status: "Under Review" },
            { 
                $set: { status: "Rejected" },
                $push: { 
                    submission_history: {
                        action: "Rejected",
                        by_user: req.user.id,
                        timestamp: new Date().toISOString(),
                        notes: `Application dropped instantly. Employee Civil ID blacklisted. Reason: ${reason_for_blacklisting}`
                    }
                }
            }
        );

        res.status(201).json({ message: "Worker permanently barred. Ongoing deployment packets dropped cleanly.", blockRecord });
    } catch (error) {
        res.status(500).json({ message: "Error compiling blocklist records indices data", error: error.message });
    }
};

module.exports = { pushToBlacklist };
