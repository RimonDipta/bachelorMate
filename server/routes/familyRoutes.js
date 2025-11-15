// routes/familyRoutes.js
const express = require("express");
const router = express.Router();
const {
  createFamily,
  getMyFamilies,
  joinFamilyByCode,
  joinFamilyByInvite,
  getFamilyMembers,
  approveMembership,
  kickMember,
  updateMemberRoles,
  getFamilyById,
  updateFamilyBillConfig,
  updateMemberBills,
} = require("../controllers/familyController");
const { protect } = require("../middleware/authMiddleware");

// Create a new family
router.post("/", protect, createFamily);

// Get families of logged-in user
router.get("/my", protect, getMyFamilies);

// Get single family details (including billConfig)
router.get("/:familyId", protect, getFamilyById);

// Join via 6-digit family code
router.post("/join", protect, joinFamilyByCode);

// Join via invite code
router.post("/join-by-invite", protect, joinFamilyByInvite);

// Update family bill config (admin)
router.patch("/:familyId/bill-config", protect, updateFamilyBillConfig);

// === Membership management ===

// List all members of a family (admin/manager)
router.get("/:familyId/members", protect, getFamilyMembers);

// Approve a pending membership
router.patch(
  "/:familyId/members/:membershipId/approve",
  protect,
  approveMembership
);

// Kick a member
router.patch("/:familyId/members/:membershipId/kick", protect, kickMember);

// Update member roles
router.patch(
  "/:familyId/members/:membershipId/roles",
  protect,
  updateMemberRoles
);

// Update member bill participation flags (admin)
router.patch(
  "/:familyId/members/:membershipId/bills",
  protect,
  updateMemberBills
);

module.exports = router;
