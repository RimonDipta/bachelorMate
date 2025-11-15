// routes/guestMealRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  upsertGuestMeal,
  getMyGuestMeals,
  getFamilyGuestMealsSummary,
} = require("../controllers/guestMealController");

// Create/update guest meal entry
router.post("/", protect, upsertGuestMeal);

// Get my guest meals (month view)
router.get("/my", protect, getMyGuestMeals);

// Get family guest meals summary (admin/manager)
router.get("/family-summary", protect, getFamilyGuestMealsSummary);

module.exports = router;
