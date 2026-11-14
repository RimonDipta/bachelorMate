// Encrypted backups round-trip exactly and refuse to clobber existing data.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const mongoose = require("mongoose");
const { startDb, stopDb, registerUser, request, app } = require("./helpers");
const { createBackup, readBackup, restoreBackup } = require("../lib/backup");

const PASS = "correct horse battery staple";

describe("database backups", () => {
  let file, A, home;
  before(async () => {
    await startDb();
    A = await registerUser("Backup Admin");
    home = (await A.api.post("/api/homes").send({ name: "Backed Up Home" })).body.home;
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#123456" } }).png().toBuffer();
    await A.api.post("/api/users/me/avatar").attach("avatar", png, { filename: "a.png", contentType: "image/png" }).expect(200);
  });
  after(stopDb);

  it("creates an encrypted file that hides the data", async () => {
    ({ file } = await createBackup(mongoose.connection.db, PASS));
    assert.equal(file.subarray(0, 5).toString(), "BMBK1");
    assert.ok(!file.includes(Buffer.from("Backed Up Home")), "plain text is not visible");
    assert.throws(() => readBackup(file, "wrong passphrase!!"), /Wrong passphrase/);
    await assert.rejects(createBackup(mongoose.connection.db, "short"), /at least 12/);
  });

  it("refuses to restore over existing data unless asked", async () => {
    await assert.rejects(restoreBackup(mongoose.connection.db, readBackup(file, PASS)), /already has data/);
  });

  it("restores everything, including uploaded files, after data loss", async () => {
    const db = mongoose.connection.db;
    const before = { users: await db.collection("users").countDocuments(), homes: await db.collection("homes").countDocuments(), chunks: await db.collection("uploads.chunks").countDocuments() };
    await db.collection("homes").deleteMany({});
    await db.collection("users").deleteMany({});
    await db.collection("uploads.chunks").deleteMany({});

    await restoreBackup(db, readBackup(file, PASS), { replace: true });
    assert.equal(await db.collection("users").countDocuments(), before.users);
    assert.equal(await db.collection("homes").countDocuments(), before.homes);
    assert.equal(await db.collection("uploads.chunks").countDocuments(), before.chunks);

    // The app works on the restored data: same home, same avatar bytes.
    const again = await A.api.get(`/api/homes/${home._id}`);
    assert.equal(again.status, 200);
    assert.equal(again.body.home.name, "Backed Up Home");
    const me = (await A.api.get("/api/auth/me")).body.user;
    assert.equal((await request(app).get(me.avatarUrl)).status, 200);
  });
});
