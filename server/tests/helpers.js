process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret";
process.env.UPLOAD_DIR = require("path").join(require("os").tmpdir(), "bm-test-uploads");

const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const { connectDB, disconnectDB } = require("../config/db");

let replSet;
async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await connectDB(replSet.getUri("bachelormate-test"));
  const mongoose = require("mongoose");
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}
async function stopDb() {
  await disconnectDB();
  await replSet?.stop();
}

const app = require("../app");

/** Authenticated request helper bound to a bearer token. */
const as = (token) => {
  const wrap = (method) => (url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
  return { get: wrap("get"), post: wrap("post"), patch: wrap("patch"), put: wrap("put"), delete: wrap("delete") };
};

let n = 0;
async function registerUser(name = `User${++n}`) {
  const email = `${name.toLowerCase().replace(/\W/g, "")}${n}${Date.now()}@example.com`;
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "Passw0rd!" });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, user: res.body.user, email, api: as(res.body.accessToken), cookie: res.headers["set-cookie"] };
}

module.exports = { startDb, stopDb, app, request, as, registerUser };
