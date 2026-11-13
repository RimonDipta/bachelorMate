const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Session = require("../models/Session");
const env = require("../config/env");
const { protect } = require("../middleware/auth");
const { validate, z, badRequest, unauthorized, HttpError } = require("../lib/http");
const { randomToken, sha256, signAccessToken } = require("../lib/security");
const { sendMail, esc } = require("../lib/mailer");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

const REFRESH_COOKIE = "bm_rt";
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_DAYS * 86400000,
});

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

async function issueSession(req, res, user) {
  const token = randomToken(48);
  await Session.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ip: req.ip,
  });
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
  return { user, accessToken: signAccessToken(user) };
}

const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

/** Emails a verification link AND a 6-digit code (either works). Only hashes are stored. */
async function sendVerification(user) {
  const token = randomToken(32);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  user.emailVerifyTokenHash = sha256(token);
  user.emailVerifyCodeHash = sha256(`${user._id}:${code}`);
  user.emailVerifyAttempts = 0;
  user.emailVerifySentAt = new Date();
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();
  return sendMail({
    to: user.email,
    subject: `${code} is your BachelorMate verification code`,
    title: "Confirm your email",
    body: `Hi ${esc(user.name)}, enter this code in BachelorMate to verify your email address — or use the button below. Both expire in 24 hours.`,
    code,
    cta: { label: "Verify email", url: `${env.CLIENT_URL}/verify-email?token=${token}` },
    footer: "If you didn't create a BachelorMate account, you can safely ignore this email.",
  });
}

const markVerified = (user) => {
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyCodeHash = undefined;
  user.emailVerifyExpires = undefined;
  user.emailVerifyAttempts = 0;
};

router.post(
  "/register",
  authLimiter,
  validate({ body: z.object({ name: z.string().trim().min(2).max(80), email, password }) }),
  async (req, res) => {
    const { name, email: mail, password: pw } = req.v.body;
    if (await User.exists({ email: mail })) throw badRequest("An account with this email already exists");
    const user = new User({ name, email: mail, provider: "local" });
    await user.setPassword(pw);
    await user.save();
    await sendVerification(user);
    res.status(201).json(await issueSession(req, res, user));
  }
);

router.post(
  "/login",
  authLimiter,
  validate({ body: z.object({ email, password: z.string().min(1).max(128) }) }),
  async (req, res) => {
    const user = await User.findOne({ email: req.v.body.email }).select("+passwordHash");
    // Same message for unknown email and wrong password (no account enumeration).
    if (!user || !(await user.validatePassword(req.v.body.password))) {
      throw unauthorized("Invalid email or password");
    }
    res.json(await issueSession(req, res, user));
  }
);

router.post("/refresh", async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw unauthorized("No session");
  const session = await Session.findOne({ tokenHash: sha256(raw) });
  if (!session || session.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw unauthorized("Session expired");
  }
  if (session.revokedAt) {
    // A rotated token was reused: assume theft and end every session.
    await Session.updateMany({ user: session.user, revokedAt: null }, { revokedAt: new Date() });
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw unauthorized("Session expired");
  }
  const user = await User.findById(session.user);
  if (!user) throw unauthorized("Session expired");
  session.revokedAt = new Date();
  await session.save();
  res.json(await issueSession(req, res, user));
});

router.post("/logout", async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await Session.updateOne({ tokenHash: sha256(raw) }, { revokedAt: new Date() });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.post("/logout-all", protect, async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  await Session.updateMany({ user: req.user._id, revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.get("/me", protect, (req, res) => res.json({ user: req.user }));

router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: z.object({ email }) }),
  async (req, res) => {
    const user = await User.findOne({ email: req.v.body.email });
    if (user) {
      const token = randomToken(32);
      user.resetTokenHash = sha256(token);
      user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      await sendMail({
        to: user.email,
        subject: "Reset your password",
        body: "We received a request to reset your BachelorMate password. This link expires in 30 minutes and can be used once. If you didn't request it, you can ignore this email.",
        cta: { label: "Reset password", url: `${env.CLIENT_URL}/reset-password?token=${token}` },
      });
    }
    // Always the same response so attackers cannot discover registered emails.
    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  }
);

router.post(
  "/reset-password",
  authLimiter,
  validate({ body: z.object({ token: z.string().min(20).max(200), password }) }),
  async (req, res) => {
    const user = await User.findOne({
      resetTokenHash: sha256(req.v.body.token),
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) throw badRequest("This reset link is invalid or has expired");
    await user.setPassword(req.v.body.password);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    user.emailVerified = true; // they proved ownership of the inbox
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
    res.json({ message: "Password updated. You can now sign in." });
  }
);

router.post(
  "/verify-email",
  validate({ body: z.object({ token: z.string().min(20).max(200) }) }),
  async (req, res) => {
    const user = await User.findOne({
      emailVerifyTokenHash: sha256(req.v.body.token),
      emailVerifyExpires: { $gt: new Date() },
    });
    if (!user) throw badRequest("This verification link is invalid or has expired");
    markVerified(user);
    await user.save();
    res.json({ message: "Email verified", user });
  }
);

// Signed-in users can type the 6-digit code instead of clicking the link.
router.post(
  "/verify-email-code",
  authLimiter,
  protect,
  validate({ body: z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select("+emailVerifyCodeHash +emailVerifyExpires +emailVerifyAttempts");
    if (user.emailVerified) return res.json({ message: "Email already verified", user });
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
      throw badRequest("This code has expired. Send a new one.", undefined, "CODE_EXPIRED");
    }
    if ((user.emailVerifyAttempts || 0) >= MAX_CODE_ATTEMPTS) {
      throw badRequest("Too many wrong attempts. Send a new code.", undefined, "CODE_LOCKED");
    }
    if (sha256(`${user._id}:${req.v.body.code}`) !== user.emailVerifyCodeHash) {
      user.emailVerifyAttempts = (user.emailVerifyAttempts || 0) + 1;
      await user.save();
      const left = MAX_CODE_ATTEMPTS - user.emailVerifyAttempts;
      throw badRequest(left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Send a new code.");
    }
    markVerified(user);
    await user.save();
    res.json({ message: "Email verified", user });
  }
);

router.post("/resend-verification", authLimiter, protect, async (req, res) => {
  if (req.user.emailVerified) return res.json({ message: "Email already verified" });
  const user = await User.findById(req.user._id).select("+emailVerifySentAt");
  const wait = user.emailVerifySentAt ? RESEND_COOLDOWN_MS - (Date.now() - user.emailVerifySentAt.getTime()) : 0;
  if (wait > 0) throw new HttpError(429, `Please wait ${Math.ceil(wait / 1000)}s before requesting another code`, undefined, "RESEND_COOLDOWN");
  const result = await sendVerification(user);
  if (!result.ok) throw new HttpError(502, "We couldn't send the email right now. Please try again in a minute.");
  res.json({ message: `Verification code sent to ${user.email}` });
});

router.post(
  "/change-password",
  authLimiter,
  protect,
  validate({ body: z.object({ currentPassword: z.string().max(128).optional(), newPassword: password }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (user.passwordHash && !(await user.validatePassword(req.v.body.currentPassword || ""))) {
      throw badRequest("Current password is incorrect");
    }
    await user.setPassword(req.v.body.newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    // Sign out every other device, then start a fresh session here.
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
    res.json(await issueSession(req, res, user));
  }
);

// Google sign-in through Firebase. The Firebase ID token is verified
// server-side against Google's public keys – the client is never trusted.
let jwks;
router.post(
  "/google",
  authLimiter,
  validate({ body: z.object({ idToken: z.string().min(20).max(5000) }) }),
  async (req, res) => {
    if (!env.FIREBASE_PROJECT_ID) throw badRequest("Google sign-in is not configured on this server");
    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    jwks ||= createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    );
    let payload;
    try {
      ({ payload } = await jwtVerify(req.v.body.idToken, jwks, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
      }));
    } catch {
      throw unauthorized("Google sign-in could not be verified");
    }
    if (!payload.email || !payload.email_verified) throw unauthorized("Google account email is not verified");
    const mail = String(payload.email).toLowerCase();
    let user = await User.findOne({ $or: [{ firebaseUid: payload.sub }, { email: mail }] });
    if (!user) {
      user = await User.create({
        name: payload.name || mail.split("@")[0],
        email: mail,
        provider: "google",
        firebaseUid: payload.sub,
        emailVerified: true,
        avatarUrl: payload.picture,
      });
    } else {
      user.firebaseUid = payload.sub;
      user.emailVerified = true;
      await user.save();
    }
    res.json(await issueSession(req, res, user));
  }
);

module.exports = router;
