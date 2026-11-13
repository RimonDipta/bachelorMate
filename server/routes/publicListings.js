// Public seat search — browsable without an account. Only safe, coarse
// details are exposed: area & city (never the street address), no member names.
const express = require("express");
const mongoose = require("mongoose");
const Membership = require("../models/Membership");
const { Listing, HomeReview, AMENITIES } = require("../models/Community");
const { validate, z, objectId, notFound } = require("../lib/http");
const { escapeRegex } = require("../lib/security");
const { ratingSummaries, homeReviewSummary } = require("../services/community");

const router = express.Router();

async function cards(listings) {
  const homeIds = [...new Set(listings.map((l) => String(l.home?._id || l.home)))];
  const [ratings, counts] = await Promise.all([
    ratingSummaries(homeIds),
    Membership.aggregate([{ $match: { home: { $in: homeIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: "active" } }, { $group: { _id: "$home", n: { $sum: 1 } } }]),
  ]);
  const members = new Map(counts.map((c) => [String(c._id), c.n]));
  return listings.map((l) => {
    const o = l.toObject();
    const hid = String(l.home?._id || l.home);
    return {
      _id: o._id, title: o.title, description: o.description, seats: o.seats, roomType: o.roomType, rent: o.rent, deposit: o.deposit,
      mealCostEstimate: o.mealCostEstimate, availableFrom: o.availableFrom, gender: o.gender, occupation: o.occupation, city: o.city, area: o.area,
      amenities: o.amenities, photos: o.photos, status: o.status, createdAt: o.createdAt, views: o.views,
      home: { _id: hid, name: l.home?.name, type: l.home?.type, currency: l.home?.currency || "BDT", memberCount: members.get(hid) || 0 },
      rating: ratings[hid] || { avg: null, count: 0 },
      postedBy: l.postedBy && { _id: l.postedBy._id, name: l.postedBy.name, avatarUrl: l.postedBy.avatarUrl },
    };
  });
}

router.get(
  "/listings",
  validate({
    query: z.object({
      q: z.string().trim().max(80).optional(),
      city: z.string().trim().max(60).optional(),
      gender: z.enum(["any", "male", "female"]).optional(),
      roomType: z.enum(["shared_room", "single_room", "bed_space"]).optional(),
      maxRent: z.coerce.number().min(0).max(1e9).optional(),
      amenities: z.string().max(300).optional(),
      sort: z.enum(["newest", "rent_asc", "rent_desc"]).default("newest"),
      page: z.coerce.number().int().min(1).max(100).default(1),
    }),
  }),
  async (req, res) => {
    const { q, city, gender, roomType, maxRent, amenities, sort, page } = req.v.query;
    const filter = { status: "open" };
    if (city) filter.city = { $regex: `^${escapeRegex(city)}`, $options: "i" };
    if (gender && gender !== "any") filter.gender = { $in: ["any", gender] };
    if (roomType) filter.roomType = roomType;
    if (maxRent !== undefined) filter.rent = { $lte: Math.round(maxRent * 100) };
    const wanted = (amenities || "").split(",").filter((a) => AMENITIES.includes(a));
    if (wanted.length) filter.amenities = { $all: wanted };
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ title: rx }, { area: rx }, { city: rx }, { description: rx }];
    }
    const order = sort === "rent_asc" ? { rent: 1 } : sort === "rent_desc" ? { rent: -1 } : { createdAt: -1 };
    const limit = 18;
    const [listings, total] = await Promise.all([
      Listing.find(filter).sort(order).skip((page - 1) * limit).limit(limit).populate("home", "name type currency status").populate("postedBy", "name avatarUrl"),
      Listing.countDocuments(filter),
    ]);
    const live = listings.filter((l) => l.home && l.home.status === "active");
    res.json({ listings: await cards(live), total, page, pages: Math.ceil(total / limit) });
  }
);

router.get("/listings/:id", validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const l = await Listing.findById(req.v.params.id).populate("home", "name type currency status description settings.rules").populate("postedBy", "name avatarUrl");
  if (!l || !l.home || l.home.status !== "active") throw notFound("This listing is no longer available");
  await Listing.updateOne({ _id: l._id }, { $inc: { views: 1 } });
  const [card] = await cards([l]);
  const [summary, reviews] = await Promise.all([
    homeReviewSummary(l.home._id),
    HomeReview.find({ home: l.home._id }).sort({ createdAt: -1 }).limit(10).populate("user", "name avatarUrl"),
  ]);
  res.json({
    listing: { ...card, home: { ...card.home, description: l.home.description, rules: l.home.settings?.rules || [] } },
    reviews: { summary, items: reviews.map((r) => ({ _id: r._id, rating: r.rating, body: r.body, scores: r.scores, createdAt: r.createdAt, stayedTo: r.stayedTo, reply: r.reply, user: r.user && { _id: r.user._id, name: r.user.name, avatarUrl: r.user.avatarUrl } })) },
  });
});

module.exports = router;
