// routes/mealRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  upsertMeal,
  getMyMeals,
  getFamilyMealsSummary,
} = require("../controllers/mealController");

// Create/update meal entry
router.post("/", protect, upsertMeal);

// Get my meals (month view)
router.get("/my", protect, getMyMeals);

// Get family meals summary (admin/manager)
router.get("/family-summary", protect, getFamilyMealsSummary);

module.exports = router;
