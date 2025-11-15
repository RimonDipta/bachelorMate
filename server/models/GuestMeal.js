// models/GuestMeal.js
const mongoose = require("mongoose");

const guestMealSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
    },
    // number of guest meals per meal type (can be 0 or more)
    breakfastGuests: { type: Number, default: 0, min: 0 },
    lunchGuests: { type: Number, default: 0, min: 0 },
    dinnerGuests: { type: Number, default: 0, min: 0 },

    totalGuestMeals: { type: Number, default: 0 },

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

// One guest-meal row per (family, membership, date)
guestMealSchema.index({ family: 1, membership: 1, date: 1 }, { unique: true });

guestMealSchema.pre("save", function (next) {
  this.totalGuestMeals =
    (this.breakfastGuests || 0) +
    (this.lunchGuests || 0) +
    (this.dinnerGuests || 0);
  next();
});

const GuestMeal = mongoose.model("GuestMeal", guestMealSchema);

module.exports = GuestMeal;
