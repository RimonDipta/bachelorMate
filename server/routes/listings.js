// Home-scoped seat listings: post an empty seat, manage photos, see inquiries.
const express = require("express");
const { Listing, AMENITIES } = require("../models/Community");
const { Conversation } = require("../models/Chat");
const { validate, z, objectId, day, badRequest, notFound, moneyInput } = require("../lib/http");
const { toMinor } = require("../lib/money");
const { isValidDay } = require("../lib/dates");
const { requirePerm } = require("../middleware/home");
const { requireVerified } = require("../middleware/auth");
const { makeUploader } = require("../middleware/upload");
const { deleteByUrl } = require("../services/storage");
const { logActivity } = require("../services/activity");

const router = express.Router({ mergeParams: true });
const photoUpload = makeUploader("listing");
const MAX_PHOTOS = 8;

const listingInput = z.object({
  title: z.string().trim().min(5, "Give the listing a short title").max(100),
  description: z.string().trim().max(3000).optional(),
  seats: z.number().int().min(1).max(20),
  roomType: z.enum(["shared_room", "single_room", "bed_space"]).default("shared_room"),
  rent: moneyInput,
  deposit: moneyInput.optional(),
  mealCostEstimate: moneyInput.optional().nullable(),
  availableFrom: day,
  gender: z.enum(["any", "male", "female"]).default("any"),
  occupation: z.enum(["any", "student", "professional"]).default("any"),
  city: z.string().trim().min(2).max(60),
  area: z.string().trim().min(2).max(80),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).default([]),
});

const toData = (b) => {
  if (!isValidDay(b.availableFrom)) throw badRequest("Invalid date");
  return {
    ...b,
    rent: toMinor(b.rent, { allowZero: true }),
    deposit: b.deposit ? toMinor(b.deposit, { allowZero: true }) : 0,
    mealCostEstimate: b.mealCostEstimate ? toMinor(b.mealCostEstimate, { allowZero: true }) : undefined,
    amenities: [...new Set(b.amenities)],
  };
};

router.get("/listings", async (req, res) => {
  const filter = { home: req.home._id };
  if (!req.can("invites.manage")) filter.status = "open";
  const listings = await Listing.find(filter).sort({ status: 1, createdAt: -1 }).populate("postedBy", "name avatarUrl");
  const counts = await Conversation.aggregate([
    { $match: { kind: "listing", listing: { $in: listings.map((l) => l._id) }, lastMessageAt: { $ne: null } } },
    { $group: { _id: "$listing", n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ listings: listings.map((l) => ({ ...l.toObject(), inquiries: byId.get(String(l._id)) || 0 })) });
});

router.post("/listings", requirePerm("invites.manage"), requireVerified, validate({ body: listingInput }), async (req, res) => {
  const listing = await Listing.create({ ...toData(req.v.body), home: req.home._id, postedBy: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "listing.created", summary: `${req.user.name} listed ${listing.seats} empty seat${listing.seats > 1 ? "s" : ""}: "${listing.title}"`, targetKind: "listing", targetId: listing._id });
  res.status(201).json({ listing });
});

const findListing = async (req) => {
  const l = await Listing.findOne({ _id: req.params.lid, home: req.home._id });
  if (!l) throw notFound("Listing not found");
  return l;
};
const lidParam = z.object({ lid: objectId }).passthrough();

router.patch("/listings/:lid", requirePerm("invites.manage"), validate({ params: lidParam, body: listingInput }), async (req, res) => {
  const l = await findListing(req);
  Object.assign(l, toData(req.v.body));
  await l.save();
  res.json({ listing: l });
});

router.post("/listings/:lid/status", requirePerm("invites.manage"), validate({ params: lidParam, body: z.object({ status: z.enum(["open", "closed"]) }) }), async (req, res) => {
  const l = await findListing(req);
  l.status = req.v.body.status;
  await l.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "listing.status", summary: `${req.user.name} ${l.status === "open" ? "reopened" : "closed"} listing "${l.title}"` });
  res.json({ listing: l });
});

router.delete("/listings/:lid", requirePerm("invites.manage"), validate({ params: lidParam }), async (req, res) => {
  const l = await findListing(req);
  await Promise.all(l.photos.map(deleteByUrl));
  await l.deleteOne(); // inquiry chats remain readable by their participants
  res.json({ ok: true });
});

router.post("/listings/:lid/photos", requirePerm("invites.manage"), validate({ params: lidParam }), async (req, res, next) => {
  const l = await findListing(req);
  if (l.photos.length >= MAX_PHOTOS) throw badRequest(`A listing can have up to ${MAX_PHOTOS} photos`);
  req.listing = l;
  next();
}, ...photoUpload("photo"), async (req, res) => {
  if (!req.file) throw badRequest("Choose a photo to upload");
  req.listing.photos.push(req.file.url);
  await req.listing.save();
  res.status(201).json({ listing: req.listing, url: req.file.url });
});

router.delete("/listings/:lid/photos", requirePerm("invites.manage"), validate({ params: lidParam, body: z.object({ url: z.string().max(80) }) }), async (req, res) => {
  const l = await findListing(req);
  if (!l.photos.includes(req.v.body.url)) throw notFound("Photo not found");
  l.photos = l.photos.filter((p) => p !== req.v.body.url);
  await l.save();
  await deleteByUrl(req.v.body.url);
  res.json({ listing: l });
});

// Inquiry conversations for one listing (only the poster is a participant,
// so managers see who asked; replies happen in Messages).
router.get("/listings/:lid/inquiries", requirePerm("invites.manage"), validate({ params: lidParam }), async (req, res) => {
  const l = await findListing(req);
  const convs = await Conversation.find({ kind: "listing", listing: l._id, lastMessageAt: { $ne: null } }).sort({ lastMessageAt: -1 }).populate("participants", "name avatarUrl");
  res.json({
    inquiries: convs.map((c) => ({
      conversationId: c._id,
      user: c.participants.find((p) => String(p._id) !== String(l.postedBy))?.toPublic(),
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      mine: c.participants.some((p) => String(p._id) === String(req.user._id)),
    })),
  });
});

module.exports = router;
