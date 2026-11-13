const User = require("../models/User");
const { verifyAccessToken } = require("../lib/security");
const { unauthorized, HttpError } = require("../lib/http");
const env = require("../config/env");

async function authenticateToken(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw unauthorized(err.name === "TokenExpiredError" ? "Session expired" : "Invalid token");
  }
  const user = await User.findById(payload.sub);
  if (!user || (user.tokenVersion || 0) !== payload.tv) throw unauthorized("Session is no longer valid");
  return user;
}

const protect = async (req, _res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw unauthorized();
  req.user = await authenticateToken(header.slice(7));
  next();
};

/**
 * Blocks unverified accounts from actions that affect other people (creating
 * or joining homes, posting listings, writing reviews) when
 * REQUIRE_EMAIL_VERIFICATION is on. The client shows a verify prompt on this code.
 */
const requireVerified = (req, _res, next) => {
  // Only enforced when emails can actually be delivered — otherwise nobody could get a code.
  const canDeliver = require("../lib/mailer").provider() !== "console";
  if (env.REQUIRE_EMAIL_VERIFICATION && canDeliver && !req.user.emailVerified) {
    throw new HttpError(403, "Please verify your email address first", undefined, "EMAIL_NOT_VERIFIED");
  }
  next();
};

module.exports = { protect, authenticateToken, requireVerified };
