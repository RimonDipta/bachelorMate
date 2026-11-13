const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true, index: true },
    kind: { type: String, enum: ["link", "direct"], required: true },
    // link invitations: only the hash is stored; the raw token is shown once.
    tokenHash: { type: String, unique: true, sparse: true },
    tokenHint: { type: String },
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, trim: true, maxlength: 60 },
    message: { type: String, trim: true, maxlength: 300 },
    expiresAt: { type: Date },
    maxUses: { type: Number, min: 1 },
    uses: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "accepted", "declined", "revoked"],
      default: "active",
    },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

invitationSchema.methods.isUsable = function () {
  if (this.status !== "active") return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  if (this.maxUses && this.uses >= this.maxUses) return false;
  return true;
};

module.exports = mongoose.model("Invitation", invitationSchema, "home_invitations");
