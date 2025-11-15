// models/Family.js
const mongoose = require("mongoose");

const billConfigSchema = new mongoose.Schema(
  {
    homeRent: { type: Number, default: 0 },
    wifiBill: { type: Number, default: 0 },
    waterBill: { type: Number, default: 0 },
    dustBill: { type: Number, default: 0 },
    electricityBill: { type: Number, default: 0 }, // can change month to month
  },
  { _id: false }
);

const familySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteCode: {
      type: String, // could be a random string/uuid
      unique: true,
    },
    familyCode: {
      type: String, // 6-digit unique number as string
      unique: true,
      required: true,
    },
    billConfig: {
      type: billConfigSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const Family = mongoose.model("Family", familySchema);

module.exports = Family;
