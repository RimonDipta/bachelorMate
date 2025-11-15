// routes/expenseRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createExpense,
  getFamilyExpenses,
} = require("../controllers/expenseController");

// Add expense
router.post("/", protect, createExpense);

// Get expenses for family/month
router.get("/", protect, getFamilyExpenses);

module.exports = router;
