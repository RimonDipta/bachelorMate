const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    roles: {
      type: [{ type: String, enum: ["admin", "manager", "meal_manager", "member"] }],
      default: ["member"],
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "left", "removed"],
      default: "pending",
      index: true,
    },
    joinedVia: { type: String, enum: ["creator", "link", "code", "direct"], default: "code" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    scheduledLeaveDay: { type: String }, // YYYY-MM-DD from an approved departure
    rulesAcceptedAt: { type: Date },
    // Member information collected at join time.
    room: { type: String, trim: true, maxlength: 40 },
    phone: { type: String, trim: true, maxlength: 30 },
    emergencyContact: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    // Default number of each meal type per day, e.g. { lunch: 1, dinner: 1 }.
    defaultMeals: { type: Map, of: Number, default: undefined },
    mealsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

membershipSchema.index({ home: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Membership", membershipSchema, "home_memberships");
