const mongoose = require("mongoose");

// Messages people send from "Send feedback" in the app (beta testing).
// Stored with where they were in the app so a report can be reproduced.
const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["problem", "idea", "praise", "other"], default: "other" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    page: { type: String, maxlength: 300 },
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home" },
    language: { type: String, maxlength: 10 },
    release: { type: String, maxlength: 40 },
    screen: { type: String, maxlength: 20 },
    userAgent: { type: String, maxlength: 300 },
    status: { type: String, enum: ["new", "seen", "done"], default: "new" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema, "feedback");
