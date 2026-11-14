// Creates an encrypted backup of the whole database.
//   MONGO_URI=... BACKUP_PASSPHRASE=... node scripts/backup.js [output-file]
// Default output: backups/bachelormate-<timestamp>.bmbak (git-ignored).
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../config/env");
const { createBackup } = require("../lib/backup");

(async () => {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = path.resolve(process.argv[2] || path.join(__dirname, "..", "backups", `bachelormate-${stamp}.bmbak`));
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const { file, counts } = await createBackup(mongoose.connection.db, passphrase);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, file);
  const total = Object.values(counts).reduce((a, n) => a + n, 0);
  console.log(`Backed up ${total} documents from ${Object.keys(counts).length} collections (${(file.length / 1024).toFixed(0)} KB, encrypted) → ${out}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("Backup failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
