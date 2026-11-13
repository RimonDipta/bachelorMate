// Ledger service: the single place where money moves. All amounts are integer
// minor units. Entries are append-only; corrections use reversal entries.
const mongoose = require("mongoose");
const { LedgerEntry } = require("../models/Finance");
const Membership = require("../models/Membership");
const { allocate } = require("../lib/money");
const { badRequest, conflict } = require("../lib/http");

const CREDIT_TYPES = new Set(["payment", "reimbursement"]);

async function postEntries(entries, session) {
  const docs = entries.filter((e) => e.amount > 0);
  if (!docs.length) return [];
  return LedgerEntry.create(docs, { session, ordered: true });
}

/** Per-membership balances for a home: { [membershipId]: {credits, debits, balance, byType} } */
async function balances(homeId, membershipIds) {
  const match = { home: new mongoose.Types.ObjectId(String(homeId)), status: "posted" };
  if (membershipIds) match.membership = { $in: membershipIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: { m: "$membership", type: "$type", dir: "$direction" }, total: { $sum: "$amount" } } },
  ]);
  const out = {};
  for (const r of rows) {
    const id = String(r._id.m);
    const acc = (out[id] ||= { credits: 0, debits: 0, balance: 0, byType: {} });
    const signed = r._id.dir === "credit" ? r.total : -r.total;
    if (r._id.dir === "credit") acc.credits += r.total;
    else acc.debits += r.total;
    acc.balance += signed;
    acc.byType[r._id.type] = (acc.byType[r._id.type] || 0) + signed;
  }
  return out;
}

const emptyBalance = () => ({ credits: 0, debits: 0, balance: 0, byType: {} });

async function balanceOf(homeId, membershipId) {
  const all = await balances(homeId, [membershipId]);
  return all[String(membershipId)] || emptyBalance();
}

/** Create a reversal for an entry (never deletes the original). */
async function reverseEntry(entry, userId, reason, session) {
  if (entry.status !== "posted") throw badRequest("Only posted entries can be reversed");
  if (entry.reversedBy) throw conflict("This entry has already been reversed");
  if (entry.type === "reversal") throw badRequest("A reversal cannot itself be reversed");
  const [rev] = await LedgerEntry.create(
    [
      {
        home: entry.home,
        membership: entry.membership,
        type: "reversal",
        direction: entry.direction === "credit" ? "debit" : "credit",
        amount: entry.amount,
        day: entry.day,
        description: `Reversal: ${entry.description || entry.type}${reason ? ` — ${reason}` : ""}`,
        recordedBy: userId,
        reversalOf: entry._id,
        refKind: entry.refKind,
        refId: entry.refId,
      },
    ],
    { session }
  );
  entry.reversedBy = rev._id;
  await entry.save({ session });
  return rev;
}

async function reverseByRef(refKind, refId, userId, reason, session) {
  const entries = await LedgerEntry.find({
    refKind,
    refId,
    status: "posted",
    type: { $ne: "reversal" },
    reversedBy: { $exists: false },
  }).session(session || null);
  for (const e of entries) await reverseEntry(e, userId, reason, session);
  return entries.length;
}

/**
 * Posts the ledger effect of an expense:
 *  - paidBy member gets a reimbursement credit (they fronted the money)
 *  - equal / selected allocation debits each member's share
 *  - meal_pool expenses are charged later when the meal period closes
 */
async function postExpense(expense, userId, session) {
  const entries = [];
  const base = { home: expense.home, day: expense.day, recordedBy: userId, refKind: "expense", refId: expense._id };
  if (expense.paidBy) {
    entries.push({
      ...base,
      membership: expense.paidBy,
      type: "reimbursement",
      direction: "credit",
      amount: expense.amount,
      description: `Paid for: ${expense.title}`,
    });
  }
  const mode = expense.allocation.mode;
  if (mode === "equal" || mode === "selected") {
    let ids = expense.allocation.memberships || [];
    if (mode === "equal") {
      const members = await Membership.find({ home: expense.home, status: "active" }).select("_id").session(session || null);
      ids = members.map((m) => m._id);
      expense.allocation.memberships = ids;
    }
    if (!ids.length) throw badRequest("No members to split this expense between");
    const shares = allocate(expense.amount, ids.map(() => 1));
    ids.forEach((id, i) =>
      entries.push({
        ...base,
        membership: id,
        type: "expense_share",
        direction: "debit",
        amount: shares[i],
        description: `Share of: ${expense.title}`,
      })
    );
  }
  return postEntries(entries, session);
}

module.exports = { postEntries, balances, balanceOf, emptyBalance, reverseEntry, reverseByRef, postExpense, CREDIT_TYPES };
