const Meal = require("../models/Meal");
const Membership = require("../models/Membership");

const {
  getUserMembershipInFamily,
  isManagerOrAdmin,
} = require("../utils/familyUtils");
const { normalizeDate, getMonthRange } = require("../utils/dateUtils");

// @desc    Create or update a meal entry
// @route   POST /api/meals
// @access  Private
// Body: { familyId, date, breakfast, lunch, dinner, membershipId? }
const upsertMeal = async (req, res, next) => {
  try {
    const { familyId, date, breakfast, lunch, dinner, membershipId } = req.body;

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
      // Only manager/admin can modify others' meals
      if (!isManagerOrAdmin(userMembership)) {
        res.status(403);
        return res.json({
          success: false,
          message: "Only managers/admins can modify others' meals",
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

    // Find existing meal entry
    let meal = await Meal.findOne({
      family: familyId,
      membership: targetMembership._id,
      date: normalizedDate,
    });

    if (!meal) {
      meal = new Meal({
        family: familyId,
        membership: targetMembership._id,
        date: normalizedDate,
        createdBy: req.user._id,
      });
    }

    // Only update fields provided (so you can send partial updates)
    if (breakfast !== undefined) meal.breakfast = !!breakfast;
    if (lunch !== undefined) meal.lunch = !!lunch;
    if (dinner !== undefined) meal.dinner = !!dinner;

    meal.updatedBy = req.user._id;

    await meal.save();

    return res.status(201).json({
      success: true,
      message: "Meal entry saved",
      data: meal,
    });
  } catch (err) {
    // Handle duplicate key (if race condition)
    if (err.code === 11000) {
      res.status(400);
      return res.json({
        success: false,
        message: "Meal entry already exists for that date",
      });
    }
    next(err);
  }
};

// @desc    Get current user's meals in a month (for chart)
// @route   GET /api/meals/my?familyId=&year=&month=
// @access  Private
const getMyMeals = async (req, res, next) => {
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

    const { start, end } = getMonthRange(y, m);

    const meals = await Meal.find({
      family: familyId,
      membership: userMembership._id,
      date: { $gte: start, $lt: end },
    }).sort({ date: 1 });

    // Also prepare a simple chart-friendly structure:
    // [{ date: '2025-11-01', totalMeals: 2 }, ...]
    const chartData = meals.map((meal) => ({
      date: meal.date.toISOString().slice(0, 10),
      totalMeals: meal.totalMeals,
      breakfast: meal.breakfast,
      lunch: meal.lunch,
      dinner: meal.dinner,
    }));

    return res.json({
      success: true,
      data: {
        meals,
        chart: chartData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get family meals summary for a month
// @route   GET /api/meals/family-summary?familyId=&year=&month=
// @access  Private (manager/admin)
const getFamilyMealsSummary = async (req, res, next) => {
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
        message: "Only managers/admins can view family meals summary",
      });
    }

    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const meals = await Meal.find({
      family: familyId,
      date: { $gte: start, $lt: end },
    })
      .populate({
        path: "membership",
        populate: { path: "user", select: "name email phone" },
      })
      .sort({ date: 1 });

    // Aggregate per member
    const summaryMap = new Map();

    meals.forEach((meal) => {
      const mId = String(meal.membership._id);
      if (!summaryMap.has(mId)) {
        summaryMap.set(mId, {
          membershipId: mId,
          user: meal.membership.user,
          totalMeals: 0,
          breakfastCount: 0,
          lunchCount: 0,
          dinnerCount: 0,
        });
      }
      const entry = summaryMap.get(mId);
      entry.totalMeals += meal.totalMeals;
      if (meal.breakfast) entry.breakfastCount++;
      if (meal.lunch) entry.lunchCount++;
      if (meal.dinner) entry.dinnerCount++;
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
  upsertMeal,
  getMyMeals,
  getFamilyMealsSummary,
};
