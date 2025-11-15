// controllers/expenseController.js
const Expense = require("../models/Expense");
const Membership = require("../models/Membership");

const getUserMembershipInFamily = async (userId, familyId) => {
  return Membership.findOne({
    user: userId,
    family: familyId,
    status: "approved",
  });
};

// @desc    Create an expense (bazar/item)
// @route   POST /api/expenses
// @access  Private (approved members)
const createExpense = async (req, res, next) => {
  try {
    const { familyId, amount, description, category, date, membershipId } =
      req.body;

    if (!familyId || !amount) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId and amount are required",
      });
    }

    if (amount <= 0) {
      res.status(400);
      return res.json({
        success: false,
        message: "Amount must be greater than zero",
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

    // optionally, manager/admin can record an expense as if paid by another member
    if (membershipId && membershipId !== String(userMembership._id)) {
      const isManagerOrAdmin = userMembership.roles.some(
        (r) => r === "admin" || r === "manager"
      );
      if (!isManagerOrAdmin) {
        res.status(403);
        return res.json({
          success: false,
          message: "Only managers/admins can assign expenses to others",
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

    const expense = await Expense.create({
      family: familyId,
      membership: targetMembership._id,
      amount,
      description,
      category: category || "meal",
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Expense created",
      data: expense,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get expenses for a family (optional month filter)
// @route   GET /api/expenses?familyId=&year=&month=
// @access  Private (approved members)
const getFamilyExpenses = async (req, res, next) => {
  try {
    const { familyId, year, month } = req.query;

    if (!familyId) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId is required",
      });
    }

    const membership = await getUserMembershipInFamily(req.user._id, familyId);

    if (!membership) {
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

    const expenses = await Expense.find({
      family: familyId,
      date: { $gte: start, $lt: end },
    })
      .populate({
        path: "membership",
        populate: { path: "user", select: "name email phone" },
      })
      .sort({ date: 1 });

    return res.json({
      success: true,
      data: expenses,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createExpense,
  getFamilyExpenses,
};
