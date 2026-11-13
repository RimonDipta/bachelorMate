// Unified member request: meal off, guest meal, temporary absence, departure.
const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["meal_off", "guest_meal", "absence", "departure"], required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    startDay: { type: String }, // meal_off / guest_meal / absence / departure date
    endDay: { type: String },
    mealTypes: { type: [String], default: undefined },
    guestCount: { type: Number, min: 1, max: 50 },
    guestName: { type: String, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 500 },
    // departure only
    noticeDays: { type: Number },
    earliestAllowedDay: { type: String },
    isException: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);
requestSchema.index({ home: 1, status: 1, type: 1, createdAt: -1 });
requestSchema.index({ membership: 1, type: 1, status: 1 });

module.exports = mongoose.model("Request", requestSchema, "member_requests");
