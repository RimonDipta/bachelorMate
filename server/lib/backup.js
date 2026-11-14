// Encrypted, portable database backups (no mongodump needed).
//
// File layout:  "BMBK1" | salt(16) | iv(12) | authTag(16) | AES-256-GCM( gzip( NDJSON ) )
// NDJSON lines: first a header { format, version, createdAt, collections: { name: count } },
// then one { c: <collection>, d: <Extended JSON document> } per document.
// The key is derived from a passphrase with scrypt, so a stolen file is useless without it.
const crypto = require("crypto");
const zlib = require("zlib");
// The BSON library bundled with the MongoDB driver (same one mongoose uses).
const { EJSON } = require("mongoose").mongo.BSON;

const MAGIC = Buffer.from("BMBK1");
const FORMAT = "bachelormate-backup";

const deriveKey = (passphrase, salt) => crypto.scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function assertPassphrase(passphrase) {
  if (!passphrase || passphrase.length < 12) throw new Error("Backup passphrase must be at least 12 characters (BACKUP_PASSPHRASE).");
}

function encrypt(plain, passphrase) {
  assertPassphrase(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

function decrypt(file, passphrase) {
  assertPassphrase(passphrase);
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Not a BachelorMate backup file.");
  let o = MAGIC.length;
  const salt = file.subarray(o, (o += 16));
  const iv = file.subarray(o, (o += 12));
  const tag = file.subarray(o, (o += 16));
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(file.subarray(o)), decipher.final()]);
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.");
  }
}

/** Dumps every collection of `db` (a native MongoDB Db) into an encrypted Buffer. */
async function createBackup(db, passphrase) {
  assertPassphrase(passphrase);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();
  const lines = [];
  const counts = {};
  for (const name of names) {
    counts[name] = 0;
    for await (const doc of db.collection(name).find({})) {
      lines.push(EJSON.stringify({ c: name, d: doc }, { relaxed: false }));
      counts[name] += 1;
    }
  }
  const header = JSON.stringify({ format: FORMAT, version: 1, createdAt: new Date().toISOString(), collections: counts });
  const gz = zlib.gzipSync(Buffer.from([header, ...lines].join("\n"), "utf8"), { level: 9 });
  return { file: encrypt(gz, passphrase), counts };
}

/** Decrypts and parses a backup. Returns { header, docs: Map<collection, doc[]> }. */
function readBackup(file, passphrase) {
  const text = zlib.gunzipSync(decrypt(file, passphrase)).toString("utf8");
  const [first, ...rest] = text.split("\n");
  const header = JSON.parse(first);
  if (header.format !== FORMAT) throw new Error("Unrecognised backup format.");
  const docs = new Map(Object.keys(header.collections).map((n) => [n, []]));
  for (const line of rest) {
    if (!line) continue;
    const { c, d } = EJSON.parse(line, { relaxed: false });
    docs.get(c).push(d);
  }
  return { header, docs };
}

/**
 * Restores a parsed backup into `db`. Refuses to touch a database that already
 * has data unless `replace` is true, in which case each backed-up collection is
 * emptied first (collections not in the backup are left alone).
 */
async function restoreBackup(db, { docs }, { replace = false } = {}) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  if (!replace) {
    for (const name of docs.keys()) {
      if (existing.has(name) && (await db.collection(name).estimatedDocumentCount()) > 0) {
        throw new Error(`Collection "${name}" already has data. Restore into an empty database, or pass --replace to overwrite.`);
      }
    }
  }
  const restored = {};
  for (const [name, list] of docs) {
    if (replace && existing.has(name)) await db.collection(name).deleteMany({});
    for (let i = 0; i < list.length; i += 1000) await db.collection(name).insertMany(list.slice(i, i + 1000), { ordered: false });
    restored[name] = list.length;
  }
  return restored;
}

module.exports = { createBackup, readBackup, restoreBackup, encrypt, decrypt };
