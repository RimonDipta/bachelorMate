// controllers/paymentController.js
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");

// helper to find membership of current user in a family
const getUserMembershipInFamily = async (userId, familyId) => {
  return Membership.findOne({
    user: userId,
    family: familyId,
    status: "approved",
  });
};

// helper to check if membership has manager/admin role
const isManagerOrAdmin = (membership) => {
  if (!membership) return false;
  return membership.roles.some((r) => r === "admin" || r === "manager");
};

// @desc    Create a payment (self payment or by manager/admin for others)
// @route   POST /api/payments
// @access  Private
const createPayment = async (req, res, next) => {
  try {
    const {
      familyId,
      membershipId, // optional, for manager/admin adding payment for others
      amount,
      description,
      method,
      paidAt,
    } = req.body;

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

    // membership of current user in that family
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

    let targetMembershipId;

    if (membershipId) {
      // manager/admin adding payment for someone else
      if (!isManagerOrAdmin(userMembership)) {
        res.status(403);
        return res.json({
          success: false,
          message: "Only managers/admins can create payments for other members",
        });
      }

      const targetMembership = await Membership.findById(membershipId);

      if (
        !targetMembership ||
        targetMembership.family.toString() !== familyId
      ) {
        res.status(404);
        return res.json({
          success: false,
          message: "Target membership not found for this family",
        });
      }

      targetMembershipId = targetMembership._id;
    } else {
      // self payment
      targetMembershipId = userMembership._id;
    }

    const payment = await Payment.create({
      family: familyId,
      membership: targetMembershipId,
      createdBy: req.user._id,
      amount,
      description,
      method,
      paidAt: paidAt || new Date(),
      // status default is pending
    });

    return res.status(201).json({
      success: true,
      message: "Payment created. Waiting for approval.",
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve a payment
// @route   PATCH /api/payments/:paymentId/approve
// @access  Private (manager/admin)
const approvePayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      res.status(404);
      return res.json({
        success: false,
        message: "Payment not found",
      });
    }

    const userMembership = await getUserMembershipInFamily(
      req.user._id,
      payment.family
    );

    if (!isManagerOrAdmin(userMembership)) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only managers/admins can approve payments",
      });
    }

    payment.status = "approved";
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();

    await payment.save();

    return res.json({
      success: true,
      message: "Payment approved",
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reject a payment
// @route   PATCH /api/payments/:paymentId/reject
// @access  Private (manager/admin)
const rejectPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      res.status(404);
      return res.json({
        success: false,
        message: "Payment not found",
      });
    }

    const userMembership = await getUserMembershipInFamily(
      req.user._id,
      payment.family
    );

    if (!isManagerOrAdmin(userMembership)) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only managers/admins can reject payments",
      });
    }

    payment.status = "rejected";
    payment.approvedBy = req.user._id;
    payment.approvedAt = new Date();

    await payment.save();

    return res.json({
      success: true,
      message: "Payment rejected",
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user's payments (optionally by family)
// @route   GET /api/payments/my
// @access  Private
const getMyPayments = async (req, res, next) => {
  try {
    const { familyId } = req.query;

    let membershipsQuery = { user: req.user._id, status: "approved" };
    if (familyId) {
      membershipsQuery.family = familyId;
    }

    const memberships = await Membership.find(membershipsQuery).select(
      "_id family"
    );

    const membershipIds = memberships.map((m) => m._id);

    const payments = await Payment.find({
      membership: { $in: membershipIds },
    })
      .populate({
        path: "family",
        select: "name familyCode",
      })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all payments in a family (manager/admin)
// @route   GET /api/payments
// @access  Private
const getFamilyPayments = async (req, res, next) => {
  try {
    const { familyId } = req.query;

    if (!familyId) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyId query param is required",
      });
    }

    const membership = await getUserMembershipInFamily(req.user._id, familyId);

    if (!isManagerOrAdmin(membership)) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only managers/admins can view all family payments",
      });
    }

    const payments = await Payment.find({ family: familyId })
      .populate({
        path: "membership",
        populate: { path: "user", select: "name email phone" },
      })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPayment,
  approvePayment,
  rejectPayment,
  getMyPayments,
  getFamilyPayments,
};
