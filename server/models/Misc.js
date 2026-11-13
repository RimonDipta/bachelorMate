// Notifications, announcements, grocery list, calendar and activity log.
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const NOTIFICATION_TYPES = [
  "home_invitation",
  "invitation_accepted",
  "join_request",
  "membership_approved",
  "friend_request",
  "friend_accepted",
  "message",
  "guest_meal_request",
  "meal_off_request",
  "absence_request",
  "departure_request",
  "request_reviewed",
  "payment",
  "payment_reminder",
  "expense",
  "announcement",
  "role_change",
  "meal_period_closed",
  "member_removed",
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    home: { type: ObjectId, ref: "Home" },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 400 },
    link: { type: String, maxlength: 300 },
    actor: { type: ObjectId, ref: "User" },
    readAt: { type: Date },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
// Notifications older than 180 days are cleaned up automatically.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });

const announcementSchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    important: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    author: { type: ObjectId, ref: "User", required: true },
    acknowledgements: [{ user: { type: ObjectId, ref: "User" }, at: Date, _id: false }],
    eventDay: { type: String }, // optional date to surface on the calendar
  },
  { timestamps: true }
);

const groceryItemSchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    quantity: { type: Number, min: 0, default: 1 },
    unit: { type: String, trim: true, maxlength: 20, default: "pcs" },
    assignedTo: { type: ObjectId, ref: "Membership" },
    estimatedCost: { type: Number, min: 0, default: 0 }, // minor units
    actualCost: { type: Number, min: 0 },
    purchased: { type: Boolean, default: false },
    purchasedAt: { type: Date },
    neededBy: { type: String },
    createdBy: { type: ObjectId, ref: "User", required: true },
    expense: { type: ObjectId, ref: "Expense" },
  },
  { timestamps: true }
);

const calendarEventSchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    startDay: { type: String, required: true },
    endDay: { type: String },
    time: { type: String },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true },
    actor: { type: ObjectId, ref: "User" },
    action: { type: String, required: true },
    summary: { type: String, maxlength: 300 },
    targetKind: { type: String },
    targetId: { type: ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
activitySchema.index({ home: 1, createdAt: -1 });

module.exports = {
  Notification: mongoose.model("Notification", notificationSchema, "notifications"),
  Announcement: mongoose.model("Announcement", announcementSchema, "announcements"),
  GroceryItem: mongoose.model("GroceryItem", groceryItemSchema, "grocery_items"),
  CalendarEvent: mongoose.model("CalendarEvent", calendarEventSchema, "calendar_events"),
  ActivityLog: mongoose.model("ActivityLog", activitySchema, "activity_logs"),
  NOTIFICATION_TYPES,
};
