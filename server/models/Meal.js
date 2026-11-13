const mongoose = require("mongoose");

// One row per member per day. counts/guests are keyed by meal type key.
const mealEntrySchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    counts: { type: Map, of: Number, default: {} },
    guests: { type: Map, of: Number, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);
mealEntrySchema.index({ home: 1, membership: 1, day: 1 }, { unique: true });
mealEntrySchema.index({ home: 1, day: 1 });

// A billing period for meals. Closing a period freezes its numbers and posts
// meal charges to each member's ledger.
const mealPeriodSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    startDay: { type: String, required: true },
    endDay: { type: String, required: true },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    snapshot: { type: mongoose.Schema.Types.Mixed }, // frozen calculation at close
  },
  { timestamps: true }
);

module.exports = {
  MealEntry: mongoose.model("MealEntry", mealEntrySchema, "meal_entries"),
  MealPeriod: mongoose.model("MealPeriod", mealPeriodSchema, "meal_periods"),
};
