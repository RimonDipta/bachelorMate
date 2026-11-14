const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ACCENTS = ["violet", "indigo", "blue", "teal", "emerald", "rose", "amber"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    phone: { type: String, trim: true, maxlength: 30 },
    bio: { type: String, trim: true, maxlength: 280 },
    avatarUrl: { type: String },
    provider: { type: String, enum: ["local", "google", "firebase"], default: "local" },
    firebaseUid: { type: String },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    // 6-digit code alternative to the link (hashed, limited attempts).
    emailVerifyCodeHash: { type: String, select: false },
    emailVerifyAttempts: { type: Number, default: 0, select: false },
    emailVerifySentAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    // Incrementing this invalidates every outstanding access token.
    tokenVersion: { type: Number, default: 0 },
    discoverable: { type: Boolean, default: true },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      muted: { type: [String], default: [] },
    },
    appearance: {
      mode: { type: String, enum: ["light", "dark", "system"], default: "system" },
      accent: { type: String, enum: ACCENTS, default: "violet" },
      preset: { type: String, enum: ["default", "slate", "warm", "contrast"], default: "default" },
      density: { type: String, enum: ["comfortable", "compact"], default: "comfortable" },
    },
    lastActiveHome: { type: mongoose.Schema.Types.ObjectId, ref: "Home" },
    lastSeenAt: { type: Date },
    // Set when the person deletes their account; the record stays (anonymised)
    // so shared money history in their old homes still adds up.
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ name: "text", email: "text" });

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.validatePassword = async function (password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// Safe public profile for other users.
userSchema.methods.toPublic = function () {
  return { _id: this._id, name: this.name, avatarUrl: this.avatarUrl, bio: this.bio };
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.emailVerifyTokenHash;
    delete ret.emailVerifyExpires;
    delete ret.emailVerifyCodeHash;
    delete ret.emailVerifyAttempts;
    delete ret.emailVerifySentAt;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpires;
    delete ret.tokenVersion;
    delete ret.firebaseUid;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
module.exports.ACCENTS = ACCENTS;
