// utils/familyUtils.js
const Membership = require("../models/Membership");

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

module.exports = {
  getUserMembershipInFamily,
  isManagerOrAdmin,
};
