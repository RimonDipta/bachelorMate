// models/Meal.js
const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      required: true,
    },
    // Date only (we'll normalize to midnight)
    date: {
      type: Date,
      required: true,
    },
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: false },
    dinner: { type: Boolean, default: false },

    totalMeals: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Unique: one meal entry per (family, membership, date)
mealSchema.index({ family: 1, membership: 1, date: 1 }, { unique: true });

// Pre-save calculate totalMeals
mealSchema.pre("save", function (next) {
  let count = 0;
  if (this.breakfast) count++;
  if (this.lunch) count++;
  if (this.dinner) count++;
  this.totalMeals = count;
  next();
});

const Meal = mongoose.model("Meal", mealSchema);

module.exports = Meal;
