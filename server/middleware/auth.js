const User = require("../models/User");
const { verifyAccessToken } = require("../lib/security");
const { unauthorized } = require("../lib/http");

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

module.exports = { protect, authenticateToken };
