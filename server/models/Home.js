const mongoose = require("mongoose");

const HOME_TYPES = ["bachelor_mess", "shared_apartment", "hostel", "family", "other"];

const mealTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,23}$/ },
    label: { type: String, required: true, trim: true, maxlength: 30 },
    // Weight lets a home count e.g. breakfast as half a meal.
    weight: { type: Number, default: 1, min: 0, max: 5 },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const DEFAULT_MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast", weight: 0.5, enabled: true },
  { key: "lunch", label: "Lunch", weight: 1, enabled: true },
  { key: "dinner", label: "Dinner", weight: 1, enabled: true },
];

const settingsSchema = new mongoose.Schema(
  {
    rules: { type: [String], default: [] },
    requireApproval: { type: Boolean, default: true },
    codeJoinEnabled: { type: Boolean, default: true },
    allowMemberInvites: { type: Boolean, default: false },
    departureNoticeDays: { type: Number, default: 15, min: 0, max: 180 },
    paymentDueDay: { type: Number, default: 10, min: 1, max: 28 },
    mealTypes: { type: [mealTypeSchema], default: () => DEFAULT_MEAL_TYPES },
    mealOffCutoff: { type: String, default: "22:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    autoApproveMealOff: { type: Boolean, default: false },
    guestMealPricing: { type: String, enum: ["meal_rate", "fixed"], default: "meal_rate" },
    guestMealFixedRate: { type: Number, default: 0, min: 0 }, // minor units
    mealPolicy: { type: String, default: "", maxlength: 2000 },
    guestPolicy: { type: String, default: "", maxlength: 2000 },
    paymentPolicy: { type: String, default: "", maxlength: 2000 },
    // { manager: [...], meal_manager: [...], member: [...] } – unset means defaults.
    rolePermissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const homeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 1000 },
    type: { type: String, enum: HOME_TYPES, default: "bachelor_mess" },
    currency: { type: String, default: "BDT", match: /^[A-Z]{3}$/ },
    timezone: { type: String, default: "Asia/Dhaka" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true, unique: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    onboardingCompleted: { type: Boolean, default: false },
    // The "Get your home set up" checklist on the overview is hidden once dismissed.
    setupDismissed: { type: Boolean, default: false },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Home", homeSchema, "homes");
module.exports.HOME_TYPES = HOME_TYPES;
module.exports.DEFAULT_MEAL_TYPES = DEFAULT_MEAL_TYPES;
