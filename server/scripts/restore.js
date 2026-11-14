// Restores an encrypted backup made by scripts/backup.js.
//   MONGO_URI=... BACKUP_PASSPHRASE=... node scripts/restore.js <file> [--dry-run] [--replace]
//
// Safe by default: it refuses to write into a database that already has data.
// --dry-run  only decrypts the file and lists what it contains.
// --replace  EMPTIES each collection in the backup before restoring it. Destructive —
//            take a fresh backup of the target first.
const fs = require("fs");
const mongoose = require("mongoose");
const env = require("../config/env");
const { readBackup, restoreBackup } = require("../lib/backup");

(async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: node scripts/restore.js <backup-file> [--dry-run] [--replace]");
  const backup = readBackup(fs.readFileSync(file), process.env.BACKUP_PASSPHRASE);
  console.log(`Backup from ${backup.header.createdAt}:`);
  for (const [name, n] of Object.entries(backup.header.collections)) console.log(`  ${name}: ${n}`);
  if (args.includes("--dry-run")) return;

  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`Restoring into database "${mongoose.connection.db.databaseName}"${args.includes("--replace") ? " (replacing existing data)" : ""}…`);
  const restored = await restoreBackup(mongoose.connection.db, backup, { replace: args.includes("--replace") });
  console.log(`Restored ${Object.values(restored).reduce((a, n) => a + n, 0)} documents.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("Restore failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
