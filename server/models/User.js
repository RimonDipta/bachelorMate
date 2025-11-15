// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      // not required if using Firebase/Google only
    },
    phone: {
      type: String,
    },
    provider: {
      type: String,
      enum: ["local", "google", "firebase"],
      default: "local",
    },
    firebaseUid: {
      type: String,
      // for linking with Firebase Auth later
    },
  },
  { timestamps: true }
);

// Helper method for setting password
userSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

// Helper method for validating password
userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
