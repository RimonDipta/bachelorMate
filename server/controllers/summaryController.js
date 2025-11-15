// controllers/summaryController.js
const Family = require("../models/Family");
const Membership = require("../models/Membership");
const Meal = require("../models/Meal");
const GuestMeal = require("../models/GuestMeal");
const Expense = require("../models/Expense");
const Payment = require("../models/Payment");

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

// @desc    Get monthly summary for a family
// @route   GET /api/summary/monthly?familyId=&year=&month=
// @access  Private (manager/admin; optional: members can see but we keep it strict)
const getMonthlySummary = async (req, res, next) => {
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
        message: "Only managers/admins can view monthly summary",
      });
    }

    const family = await Family.findById(familyId);

    if (!family) {
      res.status(404);
      return res.json({
        success: false,
        message: "Family not found",
      });
    }

    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    // 1. Get active memberships for this family
    const memberships = await Membership.find({
      family: familyId,
      status: "approved",
      // optional: join/leave filter
      joinDate: { $lte: end },
      $or: [{ leaveDate: { $exists: false } }, { leaveDate: { $gte: start } }],
    }).populate("user", "name email phone");

    const membershipIds = memberships.map((m) => m._id);

    // Prepare member map
    const memberMap = new Map();
    memberships.forEach((m) => {
      memberMap.set(String(m._id), {
        membershipId: String(m._id),
        user: m.user,
        roles: m.roles,
        paysRent: m.paysRent,
        paysWifi: m.paysWifi,
        paysWater: m.paysWater,
        paysDust: m.paysDust,
        paysElectricity: m.paysElectricity,
        totalMeals: 0,
        totalGuestMeals: 0,
        mealCost: 0,
        fixedBills: {
          rentShare: 0,
          wifiShare: 0,
          waterShare: 0,
          dustShare: 0,
          electricityShare: 0,
          totalFixed: 0,
        },
        paymentsTotal: 0,
        totalBeforePayments: 0,
        netDue: 0,
      });
    });

    // 2. Meals
    const meals = await Meal.find({
      family: familyId,
      membership: { $in: membershipIds },
      date: { $gte: start, $lt: end },
    });

    let totalMealsAll = 0;
    meals.forEach((meal) => {
      const id = String(meal.membership);
      if (!memberMap.has(id)) return;
      const entry = memberMap.get(id);
      entry.totalMeals += meal.totalMeals;
      totalMealsAll += meal.totalMeals;
    });

    // 3. Guest meals
    const guestMeals = await GuestMeal.find({
      family: familyId,
      membership: { $in: membershipIds },
      date: { $gte: start, $lt: end },
    });

    let totalGuestMealsAll = 0;
    guestMeals.forEach((gm) => {
      const id = String(gm.membership);
      if (!memberMap.has(id)) return;
      const entry = memberMap.get(id);
      entry.totalGuestMeals += gm.totalGuestMeals;
      totalGuestMealsAll += gm.totalGuestMeals;
    });

    // 4. Meal expenses (bazar)
    const expenses = await Expense.find({
      family: familyId,
      date: { $gte: start, $lt: end },
      category: "meal",
    });

    let totalMealCost = 0;
    expenses.forEach((exp) => {
      totalMealCost += exp.amount;
    });

    const totalAllMeals = totalMealsAll + totalGuestMealsAll;
    const mealRate = totalAllMeals > 0 ? totalMealCost / totalAllMeals : 0;

    // 5. Fixed bills (rent, wifi, etc.)
    const billConfig = family.billConfig || {};
    const rentTotal = billConfig.homeRent || 0;
    const wifiTotal = billConfig.wifiBill || 0;
    const waterTotal = billConfig.waterBill || 0;
    const dustTotal = billConfig.dustBill || 0;
    const elecTotal = billConfig.electricityBill || 0;

    const rentPayers = memberships.filter((m) => m.paysRent).length;
    const wifiPayers = memberships.filter((m) => m.paysWifi).length;
    const waterPayers = memberships.filter((m) => m.paysWater).length;
    const dustPayers = memberships.filter((m) => m.paysDust).length;
    const elecPayers = memberships.filter((m) => m.paysElectricity).length;

    // 6. Payments (approved only)
    const payments = await Payment.find({
      family: familyId,
      membership: { $in: membershipIds },
      status: "approved",
      paidAt: { $gte: start, $lt: end },
    });

    payments.forEach((p) => {
      const id = String(p.membership);
      if (!memberMap.has(id)) return;
      const entry = memberMap.get(id);
      entry.paymentsTotal += p.amount;
    });

    // 7. Compute per-member costs
    memberMap.forEach((entry, id) => {
      // meal cost
      const memberMealsCount = entry.totalMeals + entry.totalGuestMeals; // guest meals charged to host
      entry.mealCost = mealRate * memberMealsCount;

      // fixed bills share
      let rentShare = 0,
        wifiShare = 0,
        waterShare = 0,
        dustShare = 0,
        electricityShare = 0;

      if (entry.paysRent && rentPayers > 0) {
        rentShare = rentTotal / rentPayers;
      }
      if (entry.paysWifi && wifiPayers > 0) {
        wifiShare = wifiTotal / wifiPayers;
      }
      if (entry.paysWater && waterPayers > 0) {
        waterShare = waterTotal / waterPayers;
      }
      if (entry.paysDust && dustPayers > 0) {
        dustShare = dustTotal / dustPayers;
      }
      if (entry.paysElectricity && elecPayers > 0) {
        electricityShare = elecTotal / elecPayers;
      }

      const fixedTotal =
        rentShare + wifiShare + waterShare + dustShare + electricityShare;

      entry.fixedBills = {
        rentShare,
        wifiShare,
        waterShare,
        dustShare,
        electricityShare,
        totalFixed: fixedTotal,
      };

      entry.totalBeforePayments = entry.mealCost + fixedTotal;
      entry.netDue = entry.totalBeforePayments - entry.paymentsTotal;
    });

    const members = Array.from(memberMap.values());

    return res.json({
      success: true,
      data: {
        family: {
          _id: family._id,
          name: family.name,
          familyCode: family.familyCode,
        },
        year: y,
        month: m,
        totals: {
          totalMealCost,
          totalMealsAll,
          totalGuestMealsAll,
          totalAllMeals,
          mealRate,
        },
        members,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMonthlySummary,
};
