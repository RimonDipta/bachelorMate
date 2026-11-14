// Home-scoped authorization. Every /api/homes/:homeId/* route passes through
// loadHome, which guarantees the caller is an active member of that home, so
// one home's data can never be reached through another home's id (IDOR).
const mongoose = require("mongoose");
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { permissionsFor } = require("../lib/permissions");
const { forbidden, notFound } = require("../lib/http");
const { finalizeDueDepartures } = require("../services/membership");
const { syncHome } = require("../services/recurring");
const { maintainMeals } = require("../services/mealAutomation");

const loadHome = async (req, _res, next) => {
  const { homeId } = req.params;
  if (!mongoose.isValidObjectId(homeId)) throw notFound("Home not found");
  const home = await Home.findById(homeId);
  if (!home) throw notFound("Home not found");
  await finalizeDueDepartures(home);
  // Post any recurring costs that fell due (throttled per home; never blocks the request on failure).
  await syncHome(home).catch((err) => console.error("Recurring sync failed:", err.message));
  const membership = await Membership.findOne({ home: home._id, user: req.user._id, status: "active" });
  if (!membership) throw notFound("Home not found");
  // This month's meal period and today's default meals (throttled per home; never throws).
  await maintainMeals(home);
  req.home = home;
  req.membership = membership;
  req.perms = permissionsFor(membership, home);
  req.can = (p) => req.perms.has(p);
  next();
};

/** requirePerm("a", "b") – passes if the member has ANY of the listed permissions. */
const requirePerm =
  (...perms) =>
  (req, _res, next) => {
    if (!perms.some((p) => req.perms.has(p))) throw forbidden();
    next();
  };

const requireAdmin = (req, _res, next) => {
  if (!req.membership.roles.includes("admin")) throw forbidden("Only the home admin can do this");
  next();
};

const requireActiveHome = (req, _res, next) => {
  if (req.home.status !== "active") throw forbidden("This home is archived");
  next();
};

module.exports = { loadHome, requirePerm, requireAdmin, requireActiveHome };
