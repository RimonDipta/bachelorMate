const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// Helper to generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d", // 7 days
  });
};

// @desc    Google login / register
// @route   POST /api/auth/google
// @access  Public
const googleAuth = asyncHandler(async (req, res) => {
  const { name, email, uid } = req.body;

  if (!email || !uid) {
    res.status(400);
    return res.json({
      success: false,
      message: "Email and uid are required",
    });
  }
  // In a production-grade app, you should verify the Firebase idToken here.
  // For now, we trust the client for this project.

  let user = await User.findOne({ email });

  if (!user) {
    // create new user with provider 'google'
    user = await User.create({
      name: name || email.split("@")[0],
      email,
      password: Math.random().toString(36).slice(2), // dummy password
      provider: "google",
    });
  } else {
    // existing user: if provider is local, keep it; if not, update provider to google
    if (!user.provider) {
      user.provider = "google";
      await user.save();
    }
  }

  const token = generateToken(user._id);

  return res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provider: user.provider,
      token,
    },
  });
});

// @desc    Register new user (local email/password)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      return res.json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      res.status(400);
      return res.json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      provider: "local",
    });

    await user.setPassword(password);
    await user.save();

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        provider: user.provider,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login user (local email/password)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      return res.json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.passwordHash) {
      res.status(401);
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.validatePassword(password);

    if (!isMatch) {
      res.status(401);
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        provider: user.provider,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // req.user is attached by protect middleware
    return res.json({
      success: true,
      data: req.user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  googleAuth,
};
