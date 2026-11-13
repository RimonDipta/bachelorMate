const mongoose = require("mongoose");

/*
 * Ledger convention:
 *   balance = Σ credits − Σ debits  (posted entries only)
 *   positive balance = advance credit, negative balance = outstanding dues.
 * Entries are never deleted; corrections are made with reversal entries.
 */
const ENTRY_TYPES = [
  "opening_balance",
  "payment", // money a member paid into the home fund (credit)
  "reimbursement", // member paid a home expense from their own pocket (credit)
  "expense_share", // share of a non-meal expense (debit)
  "meal_charge", // meal cost from a closed meal period (debit)
  "adjustment",
  "reversal",
];

const ledgerSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
    type: { type: String, enum: ENTRY_TYPES, required: true },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Amount must be integer minor units" },
    },
    day: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 300 },
    method: { type: String, enum: ["cash", "bkash", "nagad", "rocket", "bank", "card", "other"] },
    status: { type: String, enum: ["pending", "posted", "rejected"], default: "posted" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    attachment: { type: String },
    refKind: { type: String, enum: ["expense", "meal_period", "entry"] },
    refId: { type: mongoose.Schema.Types.ObjectId },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerEntry" },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerEntry" },
  },
  { timestamps: true }
);
ledgerSchema.index({ home: 1, membership: 1, status: 1 });
ledgerSchema.index({ home: 1, day: -1 });
ledgerSchema.index({ refKind: 1, refId: 1 });

const EXPENSE_CATEGORIES = [
  "groceries",
  "meal_other",
  "utilities",
  "rent",
  "internet",
  "cleaning",
  "maintenance",
  "other",
];
const MEAL_CATEGORIES = ["groceries", "meal_other"];

const expenseSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    day: { type: String, required: true },
    // Who paid. null means it was paid from the home fund.
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    allocation: {
      mode: { type: String, enum: ["meal_pool", "equal", "selected", "none"], required: true },
      memberships: [{ type: mongoose.Schema.Types.ObjectId, ref: "Membership" }],
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    receipt: { type: String },
    status: { type: String, enum: ["active", "void"], default: "active" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    history: [
      {
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        action: String,
        changes: mongoose.Schema.Types.Mixed,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);
expenseSchema.index({ home: 1, day: -1 });
expenseSchema.index({ home: 1, category: 1, status: 1 });

module.exports = {
  LedgerEntry: mongoose.model("LedgerEntry", ledgerSchema, "ledger_entries"),
  Expense: mongoose.model("Expense", expenseSchema, "home_expenses"),
  ENTRY_TYPES,
  EXPENSE_CATEGORIES,
  MEAL_CATEGORIES,
};
