// Request center: meal off, guest meal, temporary absence and departure.
const express = require("express");
const Request = require("../models/Request");
const Membership = require("../models/Membership");
const { validate, z, objectId, day, badRequest, notFound, conflict, forbidden } = require("../lib/http");
const { isValidDay, todayIn, nowIn, addDays, eachDay, diffDays } = require("../lib/dates");
const { applyMealOff, applyGuestMeal, assertDaysEditable } = require("./meals");
const { notify, notifyPermitted } = require("../services/notify");
const { logActivity } = require("../services/activity");
const { balanceOf } = require("../services/ledger");

const router = express.Router({ mergeParams: true });

const REVIEW_PERM = { meal_off: "meals.review", guest_meal: "meals.review", absence: "requests.review", departure: "requests.review" };
const LABEL = { meal_off: "meal-off", guest_meal: "guest meal", absence: "absence", departure: "departure" };

/** Meal-off for day D must arrive before the cutoff time on D-1 (home timezone). */
function assertBeforeCutoff(home, startDay) {
  const deadline = `${addDays(startDay, -1)} ${home.settings.mealOffCutoff}`;
  if (nowIn(home.timezone) >= deadline) {
    throw badRequest(`Too late — requests for ${startDay} closed at ${home.settings.mealOffCutoff} on ${addDays(startDay, -1)}`);
  }
}

router.get("/requests/departure-info", async (req, res) => {
  const today = todayIn(req.home.timezone);
  const noticeDays = req.home.settings.departureNoticeDays;
  const bal = await balanceOf(req.home._id, req.membership._id);
  res.json({ noticeDays, today, earliestDay: addDays(today, noticeDays), balance: bal.balance, isAdmin: req.membership.roles.includes("admin") });
});

router.get(
  "/requests",
  validate({ query: z.object({ status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).default("all"), type: z.enum(["meal_off", "guest_meal", "absence", "departure"]).optional(), scope: z.enum(["mine", "review"]).default("mine") }) }),
  async (req, res) => {
    const { status, type, scope } = req.v.query;
    const filter = { home: req.home._id };
    if (status !== "all") filter.status = status;
    if (scope === "mine") {
      filter.membership = req.membership._id;
      if (type) filter.type = type;
    } else {
      const reviewable = Object.keys(REVIEW_PERM).filter((t) => req.can(REVIEW_PERM[t]));
      if (!reviewable.length) throw forbidden();
      filter.type = type ? (reviewable.includes(type) ? type : "__none__") : { $in: reviewable };
    }
    const requests = await Request.find(filter).sort({ createdAt: -1 }).limit(200).populate("user", "name avatarUrl").populate("reviewedBy", "name");
    res.json({ requests });
  }
);

const createInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meal_off"), startDay: day, endDay: day.optional(), mealTypes: z.array(z.string()).max(8).optional(), note: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal("guest_meal"), startDay: day, mealTypes: z.array(z.string()).length(1), guestCount: z.number().int().min(1).max(50), guestName: z.string().trim().max(80).optional(), note: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal("absence"), startDay: day, endDay: day, note: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal("departure"), startDay: day, note: z.string().trim().max(500).optional(), exceptionReason: z.string().trim().max(500).optional() }),
]);

router.post("/requests", validate({ body: createInput }), async (req, res) => {
  const b = req.v.body;
  const home = req.home;
  const today = todayIn(home.timezone);
  if (!isValidDay(b.startDay) || (b.endDay && !isValidDay(b.endDay))) throw badRequest("Invalid date");
  if (b.endDay && b.endDay < b.startDay) throw badRequest("End date must be on or after the start date");
  const doc = { home: home._id, membership: req.membership._id, user: req.user._id, type: b.type, startDay: b.startDay, endDay: b.endDay, note: b.note };
  const keys = new Set(home.settings.mealTypes.filter((t) => t.enabled).map((t) => t.key));
  if (b.mealTypes?.some((k) => !keys.has(k))) throw badRequest("Unknown meal type");

  if (b.type === "meal_off" || b.type === "absence" || b.type === "guest_meal") {
    if (b.startDay < today) throw badRequest("The date has already passed");
    if (b.endDay && diffDays(b.startDay, b.endDay) > 60) throw badRequest("Requests can cover at most 60 days");
    // Days in a closed meal period are locked; reject now rather than at review.
    await assertDaysEditable(home, eachDay(b.startDay, b.endDay || b.startDay));
  }
  if (b.type === "meal_off" || b.type === "absence") {
    assertBeforeCutoff(home, b.startDay);
    doc.endDay = b.endDay || b.startDay;
    doc.mealTypes = b.type === "meal_off" && b.mealTypes?.length ? b.mealTypes : undefined;
    // Duplicate prevention: an overlapping pending/approved request for the same meals.
    const overlapping = await Request.find({
      membership: req.membership._id,
      type: { $in: ["meal_off", "absence"] },
      status: { $in: ["pending", "approved"] },
      startDay: { $lte: doc.endDay },
      endDay: { $gte: doc.startDay },
    });
    const clash = overlapping.find((o) => !o.mealTypes?.length || !doc.mealTypes || o.mealTypes.some((k) => doc.mealTypes.includes(k)));
    if (clash) throw conflict(`You already have a ${clash.status} ${LABEL[clash.type]} request covering these meals`);
  }
  if (b.type === "guest_meal") {
    doc.mealTypes = b.mealTypes;
    doc.guestCount = b.guestCount;
    doc.guestName = b.guestName;
  }
  if (b.type === "departure") {
    if (req.membership.roles.includes("admin")) throw badRequest("Transfer ownership before requesting to leave");
    if (await Request.exists({ membership: req.membership._id, type: "departure", status: "pending" })) throw conflict("You already have a pending departure request");
    const notice = home.settings.departureNoticeDays;
    doc.noticeDays = notice;
    doc.earliestAllowedDay = addDays(today, notice);
    if (b.startDay < today) throw badRequest("Departure date cannot be in the past");
    if (b.startDay < doc.earliestAllowedDay) {
      if (!b.exceptionReason) throw badRequest(`This home requires ${notice} days notice. The earliest departure date is ${doc.earliestAllowedDay}. Add a reason to ask the Admin for an exception.`);
      doc.isException = true;
      doc.note = [b.note, `Exception requested: ${b.exceptionReason}`].filter(Boolean).join("\n");
    }
  }

  const request = await Request.create(doc);

  if (b.type === "meal_off" && home.settings.autoApproveMealOff) {
    await applyMealOff(home, req.membership, eachDay(request.startDay, request.endDay), request.mealTypes, req.user._id);
    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewNote = "Approved automatically";
    await request.save();
  } else {
    await notifyPermitted(home, REVIEW_PERM[b.type], {
      type: `${b.type}_request`,
      title: `${req.user.name} requested ${b.type === "guest_meal" ? `${b.guestCount} guest meal(s)` : LABEL[b.type]}`,
      body: `${request.startDay}${request.endDay && request.endDay !== request.startDay ? ` → ${request.endDay}` : ""}${request.isException ? " · exception requested" : ""}`,
      link: `/h/${home._id}/requests?tab=review`,
      actor: req.user._id,
    });
  }
  await logActivity({ home, actor: req.user._id, action: "request.created", summary: `${req.user.name} submitted a ${LABEL[b.type]} request`, targetKind: "request", targetId: request._id });
  res.status(201).json({ request });
});

const findRequest = async (req) => {
  const r = await Request.findOne({ _id: req.params.rid, home: req.home._id });
  if (!r) throw notFound("Request not found");
  return r;
};
const ridParam = z.object({ rid: objectId }).passthrough();

router.post("/requests/:rid/approve", validate({ params: ridParam, body: z.object({ note: z.string().trim().max(500).optional() }) }), async (req, res) => {
  const r = await findRequest(req);
  if (!req.can(REVIEW_PERM[r.type])) throw forbidden();
  if (r.status !== "pending") throw conflict(`This request is already ${r.status}`);
  if (String(r.membership) === String(req.membership._id) && !req.membership.roles.includes("admin")) throw forbidden("You cannot approve your own request");
  if (r.type === "departure" && r.isException && !req.membership.roles.includes("admin")) throw forbidden("Only the Admin can approve a departure exception");

  const member = await Membership.findOne({ _id: r.membership, home: req.home._id });
  if (!member || member.status !== "active") throw badRequest("This member is no longer active");

  if (r.type === "meal_off" || r.type === "absence") {
    await applyMealOff(req.home, member, eachDay(r.startDay, r.endDay), r.mealTypes, req.user._id);
  } else if (r.type === "guest_meal") {
    await applyGuestMeal(req.home, member, r.startDay, r.mealTypes[0], r.guestCount, req.user._id);
  } else if (r.type === "departure") {
    member.scheduledLeaveDay = r.startDay;
    await member.save();
  }
  r.status = "approved";
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.reviewNote = req.v.body.note;
  await r.save();

  let extra = "";
  if (r.type === "departure") {
    const bal = await balanceOf(req.home._id, member._id);
    if (bal.balance < 0) extra = ` Outstanding dues: ${(-bal.balance / 100).toFixed(2)} ${req.home.currency}.`;
  }
  await notify([r.user], { type: "request_reviewed", home: req.home._id, title: `Your ${LABEL[r.type]} request was approved`, body: `${req.v.body.note || ""}${extra}`.trim() || undefined, link: `/h/${req.home._id}/requests`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "request.approved", summary: `${req.user.name} approved a ${LABEL[r.type]} request`, targetKind: "request", targetId: r._id });
  res.json({ request: r });
});

router.post("/requests/:rid/reject", validate({ params: ridParam, body: z.object({ note: z.string().trim().max(500).optional() }) }), async (req, res) => {
  const r = await findRequest(req);
  if (!req.can(REVIEW_PERM[r.type])) throw forbidden();
  if (r.status !== "pending") throw conflict(`This request is already ${r.status}`);
  r.status = "rejected";
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.reviewNote = req.v.body.note;
  await r.save();
  await notify([r.user], { type: "request_reviewed", home: req.home._id, title: `Your ${LABEL[r.type]} request was declined`, body: req.v.body.note, link: `/h/${req.home._id}/requests`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "request.rejected", summary: `${req.user.name} declined a ${LABEL[r.type]} request`, targetKind: "request", targetId: r._id });
  res.json({ request: r });
});

router.post("/requests/:rid/cancel", validate({ params: ridParam }), async (req, res) => {
  const r = await findRequest(req);
  if (String(r.membership) !== String(req.membership._id)) throw forbidden();
  if (r.status === "pending") {
    r.status = "cancelled";
  } else if (r.status === "approved" && r.type === "departure") {
    // Withdrawing an approved departure before the date keeps the member.
    const member = await Membership.findById(r.membership);
    member.scheduledLeaveDay = undefined;
    await member.save();
    r.status = "cancelled";
  } else {
    throw badRequest("Only pending requests can be cancelled");
  }
  await r.save();
  res.json({ request: r });
});

module.exports = router;
