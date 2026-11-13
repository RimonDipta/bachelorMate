// Serves stored files. Public files (avatars, listing photos) need no auth so
// <img> tags work; private files (receipts, payment proofs) require a valid
// token from an ACTIVE member of the home that owns them.
const express = require("express");
const Membership = require("../models/Membership");
const { authenticateToken } = require("../middleware/auth");
const { findFile, streamFile } = require("../services/storage");
const { notFound, unauthorized } = require("../lib/http");

const router = express.Router();

router.get("/files/:id", async (req, res) => {
  const file = await findFile(req.params.id);
  if (file.metadata?.private) {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) throw unauthorized();
    const user = await authenticateToken(header.slice(7));
    const ok = file.metadata.home && (await Membership.exists({ home: file.metadata.home, user: user._id, status: "active" }));
    if (!ok) throw notFound("File not found"); // don't reveal that it exists
  }
  await streamFile(file, res);
});

module.exports = router;
