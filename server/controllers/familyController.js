// controllers/familyController.js
const Family = require("../models/Family");
const Membership = require("../models/Membership");

// Helper: generate a 6-digit code as string
const generateFamilyCode = () => {
  // ensures it is always 6 digits, e.g., "045321"
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
};

// Helper: generate random invite code
const generateInviteCode = () => {
  // simple base36 random string
  return Math.random().toString(36).substring(2, 10);
};

// Ensure familyCode is unique
const generateUniqueFamilyCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = generateFamilyCode();
    const found = await Family.findOne({ familyCode: code });
    if (!found) {
      exists = false;
    }
  }

  return code;
};

// Ensure inviteCode is unique
const generateUniqueInviteCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = generateInviteCode();
    const found = await Family.findOne({ inviteCode: code });
    if (!found) {
      exists = false;
    }
  }

  return code;
};

// @desc    Create a new family (house)
// @route   POST /api/families
// @access  Private
const createFamily = async (req, res, next) => {
  try {
    const { name, billConfig } = req.body;

    if (!name) {
      res.status(400);
      return res.json({
        success: false,
        message: "Family name is required",
      });
    }

    const familyCode = await generateUniqueFamilyCode();
    const inviteCode = await generateUniqueInviteCode();

    const family = await Family.create({
      name,
      createdBy: req.user._id,
      familyCode,
      inviteCode,
      billConfig: billConfig || {},
    });

    // Creator becomes admin + member, auto-approved
    const membership = await Membership.create({
      user: req.user._id,
      family: family._id,
      roles: ["admin", "member"],
      status: "approved",
      // default bill flags = true (from schema)
    });

    return res.status(201).json({
      success: true,
      data: {
        family,
        membership,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get families where current user is an approved member
// @route   GET /api/families/my
// @access  Private
const getMyFamilies = async (req, res, next) => {
  try {
    const memberships = await Membership.find({
      user: req.user._id,
      status: "approved",
    })
      .populate("family")
      .lean();

    return res.json({
      success: true,
      data: memberships,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Join family via 6-digit familyCode
// @route   POST /api/families/join
// @access  Private
const joinFamilyByCode = async (req, res, next) => {
  try {
    const { familyCode } = req.body;

    if (!familyCode) {
      res.status(400);
      return res.json({
        success: false,
        message: "familyCode is required",
      });
    }

    const family = await Family.findOne({ familyCode });

    if (!family) {
      res.status(404);
      return res.json({
        success: false,
        message: "No family found with this code",
      });
    }

    let membership = await Membership.findOne({
      user: req.user._id,
      family: family._id,
    });

    if (membership) {
      if (membership.status === "kicked") {
        res.status(403);
        return res.json({
          success: false,
          message: "You were removed from this family. Contact an admin.",
        });
      }

      return res.json({
        success: true,
        message: "You already have a membership for this family",
        data: membership,
      });
    }

    membership = await Membership.create({
      user: req.user._id,
      family: family._id,
      roles: ["member"],
      status: "pending", // needs admin/manager approval
    });

    return res.status(201).json({
      success: true,
      message: "Join request created. Waiting for approval.",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Join family via inviteCode
// @route   POST /api/families/join-by-invite
// @access  Private
const joinFamilyByInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      res.status(400);
      return res.json({
        success: false,
        message: "inviteCode is required",
      });
    }

    const family = await Family.findOne({ inviteCode });

    if (!family) {
      res.status(404);
      return res.json({
        success: false,
        message: "Invalid invite code",
      });
    }

    let membership = await Membership.findOne({
      user: req.user._id,
      family: family._id,
    });

    if (membership) {
      if (membership.status === "kicked") {
        res.status(403);
        return res.json({
          success: false,
          message: "You were removed from this family. Contact an admin.",
        });
      }

      return res.json({
        success: true,
        message: "You already have a membership for this family",
        data: membership,
      });
    }

    membership = await Membership.create({
      user: req.user._id,
      family: family._id,
      roles: ["member"],
      status: "pending", // still requires approval
    });

    return res.status(201).json({
      success: true,
      message: "Join request created. Waiting for approval.",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

// Helper: check if user is admin/manager in a family
const getRequesterMembership = async (userId, familyId) => {
  return Membership.findOne({
    user: userId,
    family: familyId,
    status: "approved",
  });
};

// @desc    Get all members (including pending) of a family
// @route   GET /api/families/:familyId/members
// @access  Private (admin/manager)
const getFamilyMembers = async (req, res, next) => {
  try {
    const { familyId } = req.params;

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (
      !requesterMembership ||
      !requesterMembership.roles.some((r) => r === "admin" || r === "manager")
    ) {
      res.status(403);
      return res.json({
        success: false,
        message: "Not authorized to view members of this family",
      });
    }

    const members = await Membership.find({ family: familyId })
      .populate("user", "name email phone provider")
      .lean();

    return res.json({
      success: true,
      data: members,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve a membership (join request)
// @route   PATCH /api/families/:familyId/members/:membershipId/approve
// @access  Private (admin/manager)
const approveMembership = async (req, res, next) => {
  try {
    const { familyId, membershipId } = req.params;

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (
      !requesterMembership ||
      !requesterMembership.roles.some((r) => r === "admin" || r === "manager")
    ) {
      res.status(403);
      return res.json({
        success: false,
        message: "Not authorized to approve members for this family",
      });
    }

    const membership = await Membership.findById(membershipId).populate(
      "user",
      "name email"
    );

    if (!membership || membership.family.toString() !== familyId) {
      res.status(404);
      return res.json({
        success: false,
        message: "Membership not found for this family",
      });
    }

    membership.status = "approved";
    if (!membership.joinDate) {
      membership.joinDate = new Date();
    }

    await membership.save();

    return res.json({
      success: true,
      message: "Membership approved",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Kick a member out of the family
// @route   PATCH /api/families/:familyId/members/:membershipId/kick
// @access  Private (admin/manager, but protect last admin)
const kickMember = async (req, res, next) => {
  try {
    const { familyId, membershipId } = req.params;

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (
      !requesterMembership ||
      !requesterMembership.roles.some((r) => r === "admin" || r === "manager")
    ) {
      res.status(403);
      return res.json({
        success: false,
        message: "Not authorized to kick members from this family",
      });
    }

    const membership = await Membership.findById(membershipId).populate(
      "user",
      "name email"
    );

    if (!membership || membership.family.toString() !== familyId) {
      res.status(404);
      return res.json({
        success: false,
        message: "Membership not found for this family",
      });
    }

    // Protect last admin from being kicked
    const isTargetAdmin = membership.roles.includes("admin");
    if (isTargetAdmin) {
      const adminCount = await Membership.countDocuments({
        family: familyId,
        status: "approved",
        roles: "admin",
      });

      if (adminCount <= 1) {
        res.status(400);
        return res.json({
          success: false,
          message: "Cannot remove the last admin from the family",
        });
      }
    }

    membership.status = "kicked";
    membership.leaveDate = new Date();

    await membership.save();

    return res.json({
      success: true,
      message: "Member kicked from family",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update member roles (admin/manager/member)
// @route   PATCH /api/families/:familyId/members/:membershipId/roles
// @access  Private (admin only)
const updateMemberRoles = async (req, res, next) => {
  try {
    const { familyId, membershipId } = req.params;
    const { roles } = req.body;

    const VALID_ROLES = ["admin", "manager", "member"];

    if (!Array.isArray(roles) || roles.length === 0) {
      res.status(400);
      return res.json({
        success: false,
        message: "Roles array is required",
      });
    }

    // Clean roles
    let cleanedRoles = [
      ...new Set(roles.filter((r) => VALID_ROLES.includes(r))),
    ];

    if (cleanedRoles.length === 0) {
      res.status(400);
      return res.json({
        success: false,
        message: "No valid roles provided",
      });
    }

    // Ensure every member has at least 'member'
    if (!cleanedRoles.includes("member")) {
      cleanedRoles.push("member");
    }

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (!requesterMembership || !requesterMembership.roles.includes("admin")) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only admins can change member roles",
      });
    }

    const membership = await Membership.findById(membershipId);

    if (!membership || membership.family.toString() !== familyId) {
      res.status(404);
      return res.json({
        success: false,
        message: "Membership not found for this family",
      });
    }

    const targetWasAdmin = membership.roles.includes("admin");
    const targetWillBeAdmin = cleanedRoles.includes("admin");

    // If we are removing admin role from this member, ensure not last admin
    if (targetWasAdmin && !targetWillBeAdmin) {
      const adminCount = await Membership.countDocuments({
        family: familyId,
        status: "approved",
        roles: "admin",
      });

      if (adminCount <= 1) {
        res.status(400);
        return res.json({
          success: false,
          message: "Cannot remove admin role from the last admin",
        });
      }
    }

    membership.roles = cleanedRoles;
    await membership.save();

    return res.json({
      success: true,
      message: "Member roles updated",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

const getFamilyById = async (req, res, next) => {
  try {
    const { familyId } = req.params;

    const membership = await Membership.findOne({
      family: familyId,
      user: req.user._id,
      status: "approved",
    });

    if (!membership) {
      res.status(403);
      return res.json({
        success: false,
        message: "You are not a member of this family or not approved yet",
      });
    }

    const family = await Family.findById(familyId).lean();

    if (!family) {
      res.status(404);
      return res.json({
        success: false,
        message: "Family not found",
      });
    }

    return res.json({
      success: true,
      data: family,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update family bill configuration (rent, wifi, etc.)
// @route   PATCH /api/families/:familyId/bill-config
// @access  Private (admin only)
const updateFamilyBillConfig = async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const { homeRent, wifiBill, waterBill, dustBill, electricityBill } =
      req.body;

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (!requesterMembership || !requesterMembership.roles.includes("admin")) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only admins can update bill configuration",
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

    // Only update fields that are present in the body
    if (homeRent !== undefined) family.billConfig.homeRent = homeRent;
    if (wifiBill !== undefined) family.billConfig.wifiBill = wifiBill;
    if (waterBill !== undefined) family.billConfig.waterBill = waterBill;
    if (dustBill !== undefined) family.billConfig.dustBill = dustBill;
    if (electricityBill !== undefined)
      family.billConfig.electricityBill = electricityBill;

    await family.save();

    return res.json({
      success: true,
      message: "Bill configuration updated",
      data: family.billConfig,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a member's bill participation flags
// @route   PATCH /api/families/:familyId/members/:membershipId/bills
// @access  Private (admin only)
const updateMemberBills = async (req, res, next) => {
  try {
    const { familyId, membershipId } = req.params;
    const { paysRent, paysWifi, paysWater, paysDust, paysElectricity } =
      req.body;

    const requesterMembership = await getRequesterMembership(
      req.user._id,
      familyId
    );

    if (!requesterMembership || !requesterMembership.roles.includes("admin")) {
      res.status(403);
      return res.json({
        success: false,
        message: "Only admins can update member bill settings",
      });
    }

    const membership = await Membership.findById(membershipId).populate(
      "user",
      "name email"
    );

    if (!membership || membership.family.toString() !== familyId) {
      res.status(404);
      return res.json({
        success: false,
        message: "Membership not found for this family",
      });
    }

    // Update flags only if explicitly sent
    if (paysRent !== undefined) membership.paysRent = paysRent;
    if (paysWifi !== undefined) membership.paysWifi = paysWifi;
    if (paysWater !== undefined) membership.paysWater = paysWater;
    if (paysDust !== undefined) membership.paysDust = paysDust;
    if (paysElectricity !== undefined)
      membership.paysElectricity = paysElectricity;

    await membership.save();

    return res.json({
      success: true,
      message: "Member bill settings updated",
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
