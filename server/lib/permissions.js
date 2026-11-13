// Role-based access control. Each role maps to a default permission set; the
// home Admin can customise the sets for manager / meal_manager / member.

const PERMISSIONS = {
  "home.manage": "Edit home details",
  "home.delete": "Archive or delete the home",
  "settings.manage": "Change house rules and settings",
  "members.view": "View members",
  "members.manage": "Approve, edit and remove members",
  "members.roles": "Assign roles",
  "invites.manage": "Create and revoke invitations",
  "requests.review": "Review absence and departure requests",
  "meals.manage": "Edit daily meal entries",
  "meals.review": "Review meal-off and guest meal requests",
  "meals.configure": "Configure meal types, rates and periods",
  "finance.view_all": "View every member's account",
  "finance.record": "Record payments and adjustments",
  "expenses.view": "View home expenses",
  "expenses.manage": "Add and edit any expense",
  "expenses.meal": "Add and edit grocery / meal expenses",
  "announcements.manage": "Publish announcements",
  "grocery.manage": "Manage the grocery list",
  "calendar.manage": "Manage calendar events",
  "reports.view": "View reports",
  "activity.view": "View the activity log",
};

const ALL = Object.keys(PERMISSIONS);

const ROLE_DEFAULTS = {
  admin: ALL,
  manager: [
    "members.view",
    "members.manage",
    "invites.manage",
    "requests.review",
    "finance.view_all",
    "finance.record",
    "expenses.view",
    "expenses.manage",
    "announcements.manage",
    "grocery.manage",
    "calendar.manage",
    "reports.view",
    "activity.view",
  ],
  meal_manager: [
    "members.view",
    "meals.manage",
    "meals.review",
    "meals.configure",
    "expenses.view",
    "expenses.meal",
    "grocery.manage",
    "reports.view",
  ],
  member: ["members.view", "expenses.view"],
};

const ROLES = ["admin", "manager", "meal_manager", "member"];
const CONFIGURABLE_ROLES = ["manager", "meal_manager", "member"];

// Permissions that may never be granted to non-admin roles.
const ADMIN_ONLY = ["home.delete", "members.roles", "settings.manage"];

function permissionsFor(membership, home) {
  if (!membership || membership.status !== "active") return new Set();
  const roles = membership.roles || [];
  if (roles.includes("admin")) return new Set(ALL);
  const custom = home?.settings?.rolePermissions || {};
  const set = new Set();
  for (const role of roles) {
    const list = Array.isArray(custom[role]) ? custom[role] : ROLE_DEFAULTS[role] || [];
    list.forEach((p) => PERMISSIONS[p] && !ADMIN_ONLY.includes(p) && set.add(p));
  }
  return set;
}

module.exports = { PERMISSIONS, ROLE_DEFAULTS, ROLES, CONFIGURABLE_ROLES, ADMIN_ONLY, permissionsFor };
