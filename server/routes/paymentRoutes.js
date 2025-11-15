// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const {
  createPayment,
  approvePayment,
  rejectPayment,
  getMyPayments,
  getFamilyPayments,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

// Create payment (self or for others)
router.post("/", protect, createPayment);

// Approve payment
router.patch("/:paymentId/approve", protect, approvePayment);

// Reject payment
router.patch("/:paymentId/reject", protect, rejectPayment);

// Get current user's payments (optional family filter)
router.get("/my", protect, getMyPayments);

// Get all payments in a family (manager/admin)
router.get("/", protect, getFamilyPayments);

module.exports = router;
