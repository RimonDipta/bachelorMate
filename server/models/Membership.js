// models/Membership.js
const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
    },
    roles: {
      type: [String],
      enum: ["admin", "manager", "member"],
      default: ["member"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "kicked"],
      default: "pending",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    leaveDate: {
      type: Date,
    },
    // Bill participation flags
    paysRent: { type: Boolean, default: true },
    paysWifi: { type: Boolean, default: true },
    paysWater: { type: Boolean, default: true },
    paysDust: { type: Boolean, default: true },
    paysElectricity: { type: Boolean, default: true },

    isGuest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ensure one membership per user per family
membershipSchema.index({ user: 1, family: 1 }, { unique: true });

const Membership = mongoose.model("Membership", membershipSchema);

module.exports = Membership;
