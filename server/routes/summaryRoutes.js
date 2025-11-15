// routes/summaryRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getMonthlySummary } = require("../controllers/summaryController");

// Monthly summary
router.get("/monthly", protect, getMonthlySummary);

module.exports = router;
