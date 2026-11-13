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
      mode: { type: String, enum: ["meal_pool", "equal", "selected", "custom", "none"], required: true },
      memberships: [{ type: mongoose.Schema.Types.ObjectId, ref: "Membership" }],
      // custom mode: an exact amount (minor units) per member; sums to the total.
      shares: [{ membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership" }, amount: { type: Number, min: 0 }, _id: false }],
    },
    // Set when the expense was posted automatically from a recurring cost.
    recurring: {
      template: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringExpense" },
      day: { type: String },
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
// One posted expense per recurring occurrence, which makes auto-posting idempotent.
expenseSchema.index(
  { "recurring.template": 1, "recurring.day": 1 },
  { unique: true, partialFilterExpression: { "recurring.template": { $exists: true } } }
);

// A cost that repeats (rent, internet, cleaner…) and how it is divided.
const shareSchema = new mongoose.Schema(
  { membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true }, amount: { type: Number, min: 0, required: true } },
  { _id: false }
);
const recurringSchema = new mongoose.Schema(
  {
    home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    frequency: { type: String, enum: ["monthly", "weekly"], default: "monthly" },
    dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },
    weekday: { type: Number, min: 0, max: 6, default: 0 }, // 0 = Sunday
    startDay: { type: String, required: true },
    endDay: { type: String },
    // Who pays the provider. null = home fund; a member gets credited the full amount.
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", default: null },
    allocation: {
      // equal  → split equally between everyone (allMembers) or the chosen members
      // custom → a fixed amount per member (0 = doesn't pay), must sum to the total
      // none   → nobody is charged (paid from the fund)
      mode: { type: String, enum: ["equal", "custom", "none"], required: true },
      allMembers: { type: Boolean, default: true },
      memberships: [{ type: mongoose.Schema.Types.ObjectId, ref: "Membership" }],
      shares: { type: [shareSchema], default: [] },
    },
    notes: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
    lastPostedDay: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = {
  LedgerEntry: mongoose.model("LedgerEntry", ledgerSchema, "ledger_entries"),
  Expense: mongoose.model("Expense", expenseSchema, "home_expenses"),
  RecurringExpense: mongoose.model("RecurringExpense", recurringSchema, "recurring_expenses"),
  ENTRY_TYPES,
  EXPENSE_CATEGORIES,
  MEAL_CATEGORIES,
};
