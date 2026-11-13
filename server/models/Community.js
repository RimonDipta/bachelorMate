// Seat listings (find a room / fill an empty seat) and reviews.
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const AMENITIES = ["wifi", "meals", "ac", "attached_bath", "balcony", "furnished", "generator", "lift", "gas", "water_filter", "laundry", "parking", "security", "cleaner"];

const listingSchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true, index: true },
    postedBy: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 3000 },
    seats: { type: Number, required: true, min: 1, max: 20 },
    roomType: { type: String, enum: ["shared_room", "single_room", "bed_space"], default: "shared_room" },
    rent: { type: Number, required: true, min: 0, validate: Number.isInteger }, // minor units per month
    deposit: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    mealCostEstimate: { type: Number, min: 0, validate: Number.isInteger }, // optional monthly estimate
    availableFrom: { type: String, required: true },
    gender: { type: String, enum: ["any", "male", "female"], default: "any" },
    occupation: { type: String, enum: ["any", "student", "professional"], default: "any" },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    area: { type: String, required: true, trim: true, maxlength: 80 },
    amenities: { type: [{ type: String, enum: AMENITIES }], default: [] },
    photos: { type: [String], default: [] }, // /api/files/<id>
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);
listingSchema.index({ status: 1, city: 1, rent: 1, createdAt: -1 });
listingSchema.index({ title: "text", description: "text", area: "text", city: "text" });

const homeReviewSchema = new mongoose.Schema(
  {
    home: { type: ObjectId, ref: "Home", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    // Optional category scores.
    scores: {
      cleanliness: { type: Number, min: 1, max: 5 },
      food: { type: Number, min: 1, max: 5 },
      management: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    stayedFrom: { type: Date },
    stayedTo: { type: Date }, // null while still living there
    reply: { body: { type: String, trim: true, maxlength: 1000 }, by: { type: ObjectId, ref: "User" }, at: Date },
  },
  { timestamps: true }
);
homeReviewSchema.index({ home: 1, user: 1 }, { unique: true });
homeReviewSchema.index({ home: 1, createdAt: -1 });

const ROOMMATE_TAGS = ["clean", "respectful", "pays_on_time", "quiet", "friendly", "helpful", "cooks_well", "messy", "noisy", "late_payments"];

const roommateReviewSchema = new mongoose.Schema(
  {
    reviewer: { type: ObjectId, ref: "User", required: true },
    subject: { type: ObjectId, ref: "User", required: true, index: true },
    home: { type: ObjectId, ref: "Home", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true, trim: true, minlength: 10, maxlength: 1500 },
    tags: { type: [{ type: String, enum: ROOMMATE_TAGS }], default: [] },
  },
  { timestamps: true }
);
roommateReviewSchema.index({ reviewer: 1, subject: 1, home: 1 }, { unique: true });

module.exports = {
  Listing: mongoose.model("Listing", listingSchema, "seat_listings"),
  HomeReview: mongoose.model("HomeReview", homeReviewSchema, "home_reviews"),
  RoommateReview: mongoose.model("RoommateReview", roommateReviewSchema, "roommate_reviews"),
  AMENITIES,
  ROOMMATE_TAGS,
};
