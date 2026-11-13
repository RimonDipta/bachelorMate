const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["home", "direct", "listing"], required: true },
    home: { type: ObjectId, ref: "Home" },
    listing: { type: ObjectId, ref: "Listing" }, // listing inquiries: poster + inquirer
    participants: [{ type: ObjectId, ref: "User" }], // direct + listing chats
    directKey: { type: String, unique: true, sparse: true }, // "<minId>:<maxId>" or "listing:<id>:<userId>"
    lastMessageAt: { type: Date },
    lastMessage: { body: String, sender: { type: ObjectId, ref: "User" } },
  },
  { timestamps: true }
);
conversationSchema.index({ home: 1 }, { unique: true, partialFilterExpression: { kind: "home" } });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: "Conversation", required: true },
    sender: { type: ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 4000 },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    // Previous versions are kept for audit purposes, never returned to clients.
    edits: { type: [{ body: String, at: Date, _id: false }], select: false },
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: -1 });

const readSchema = new mongoose.Schema({
  conversation: { type: ObjectId, ref: "Conversation", required: true },
  user: { type: ObjectId, ref: "User", required: true },
  lastReadAt: { type: Date, default: () => new Date(0) },
});
readSchema.index({ conversation: 1, user: 1 }, { unique: true });

const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: ObjectId, ref: "User", required: true },
    recipient: { type: ObjectId, ref: "User", required: true },
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

module.exports = {
  Conversation: mongoose.model("Conversation", conversationSchema, "chat_conversations"),
  Message: mongoose.model("Message", messageSchema, "chat_messages"),
  ConversationRead: mongoose.model("ConversationRead", readSchema, "chat_reads"),
  Friendship: mongoose.model("Friendship", friendshipSchema, "friendships"),
  pairKey,
};
