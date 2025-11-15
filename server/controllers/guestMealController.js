// controllers/guestMealController.js
const GuestMeal = require("../models/GuestMeal");
const Membership = require("../models/Membership");

const getUserMembershipInFamily = async (userId, familyId) => {
  return Membership.findOne({
    user: userId,
    family: familyId,
    status: "approved",
  });
};

const isManagerOrAdmin = (membership) => {
  if (!membership) return false;
  return membership.roles.some((r) => r === "admin" || r === "manager");
};

const normalizeDate = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// @desc    Create or update guest meals for a date
// @route   POST /api/guest-meals
// @access  Private
// Body: { familyId, date, breakfastGuests, lunchGuests, dinnerGuests, membershipId? }
const upsertGuestMeal = async (req, res, next) => {
  try {
    const {
      familyId,
      date,
      breakfastGuests,
      lunchGuests,
      dinnerGuests,
      membershipId,
    } = req.body;

    if (!familyId || !date) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId and date are required",
      });
    }

    const userMembership = await getUserMembershipInFamily(
      req.user._id,
      familyId
    );

    if (!userMembership) {
      res.status(403);
      return res.json({
        success: false,
        message: "You are not an approved member of this family",
      });
    }

    let targetMembership = userMembership;

    if (membershipId && membershipId !== String(userMembership._id)) {
      if (!isManagerOrAdmin(userMembership)) {
        res.status(403);
        return res.json({
          success: false,
          message: "Only managers/admins can modify others' guest meals",
        });
      }

      const m = await Membership.findById(membershipId);
      if (!m || String(m.family) !== familyId) {
        res.status(404);
        return res.json({
          success: false,
          message: "Target membership not found for this family",
        });
      }
      targetMembership = m;
    }

    const normalizedDate = normalizeDate(date);

    let guestMeal = await GuestMeal.findOne({
      family: familyId,
      membership: targetMembership._id,
      date: normalizedDate,
    });

    if (!guestMeal) {
      guestMeal = new GuestMeal({
        family: familyId,
        membership: targetMembership._id,
        date: normalizedDate,
        createdBy: req.user._id,
      });
    }

    if (breakfastGuests !== undefined)
      guestMeal.breakfastGuests = Number(breakfastGuests) || 0;
    if (lunchGuests !== undefined)
      guestMeal.lunchGuests = Number(lunchGuests) || 0;
    if (dinnerGuests !== undefined)
      guestMeal.dinnerGuests = Number(dinnerGuests) || 0;

    guestMeal.updatedBy = req.user._id;

    await guestMeal.save();

    return res.status(201).json({
      success: true,
      message: "Guest meal entry saved",
      data: guestMeal,
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400);
      return res.json({
        success: false,
        message: "Guest meal entry already exists for that date",
      });
    }
    next(err);
  }
};

// @desc    Get my guest meals in a month
// @route   GET /api/guest-meals/my?familyId=&year=&month=
// @access  Private
const getMyGuestMeals = async (req, res, next) => {
  try {
    const { familyId, year, month } = req.query;

    if (!familyId) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId is required",
      });
    }

    const userMembership = await getUserMembershipInFamily(
      req.user._id,
      familyId
    );

    if (!userMembership) {
      res.status(403);
      return res.json({
        success: false,
        message: "You are not an approved member of this family",
      });
    }

    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const guestMeals = await GuestMeal.find({
      family: familyId,
      membership: userMembership._id,
      date: { $gte: start, $lt: end },
    }).sort({ date: 1 });

    const chartData = guestMeals.map((gm) => ({
      date: gm.date.toISOString().slice(0, 10),
      totalGuestMeals: gm.totalGuestMeals,
      breakfastGuests: gm.breakfastGuests,
      lunchGuests: gm.lunchGuests,
      dinnerGuests: gm.dinnerGuests,
    }));

    return res.json({
      success: true,
      data: {
        guestMeals,
        chart: chartData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get family guest meals summary for a month
// @route   GET /api/guest-meals/family-summary?familyId=&year=&month=
// @access  Private (manager/admin)
const getFamilyGuestMealsSummary = async (req, res, next) => {
  try {
    const { familyId, year, month } = req.query;

    if (!familyId) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId is required",
      });
    }

    const requesterMembership = await getUserMembershipInFamily(
      req.user._id,
      familyId
    );

    if (!isManagerOrAdmin(requesterMembership)) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only managers/admins can view family guest meals summary",
      });
    }

    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const guestMeals = await GuestMeal.find({
      family: familyId,
      date: { $gte: start, $lt: end },
    })
      .populate({
        path: "membership",
        populate: { path: "user", select: "name email phone" },
      })
      .sort({ date: 1 });

    const summaryMap = new Map();

    guestMeals.forEach((gm) => {
      const mId = String(gm.membership._id);
      if (!summaryMap.has(mId)) {
        summaryMap.set(mId, {
          membershipId: mId,
          user: gm.membership.user,
          totalGuestMeals: 0,
          breakfastGuests: 0,
          lunchGuests: 0,
          dinnerGuests: 0,
        });
      }
      const entry = summaryMap.get(mId);
      entry.totalGuestMeals += gm.totalGuestMeals;
      entry.breakfastGuests += gm.breakfastGuests;
      entry.lunchGuests += gm.lunchGuests;
      entry.dinnerGuests += gm.dinnerGuests;
    });

    const byMember = Array.from(summaryMap.values());

    return res.json({
      success: true,
      data: {
        year: y,
        month: m,
        members: byMember,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upsertGuestMeal,
  getMyGuestMeals,
  getFamilyGuestMealsSummary,
};
