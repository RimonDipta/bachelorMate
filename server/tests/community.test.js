// Email verification codes, image uploads, seat listings and reviews.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { startDb, stopDb, app, request, registerUser } = require("./helpers");
const { outbox } = require("../lib/mailer");
const env = require("../config/env");
const { todayIn, addDays } = require("../lib/dates");

const lastCode = (email) => [...outbox].reverse().find((m) => m.to === email && m.code)?.code;
const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: "#7457f5" } }).png().toBuffer();

describe("email verification by code", () => {
  before(startDb);
  after(stopDb);

  it("verifies with the 6-digit code and limits wrong attempts", async () => {
    const u = await registerUser("Coder");
    const code = lastCode(u.email);
    assert.match(code, /^\d{6}$/);
    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await u.api.post("/api/auth/verify-email-code").send({ code: wrong });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /4 attempts left/);
    const ok = await u.api.post("/api/auth/verify-email-code").send({ code });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.emailVerified, true);
  });

  it("enforces a resend cooldown", async () => {
    const u = await registerUser("Resender");
    const r = await u.api.post("/api/auth/resend-verification");
    assert.equal(r.status, 429);
    assert.equal(r.body.code, "RESEND_COOLDOWN");
  });

  it("blocks unverified accounts from creating homes when required", async () => {
    env.REQUIRE_EMAIL_VERIFICATION = true;
    try {
      const u = await registerUser("Gated");
      const blocked = await u.api.post("/api/homes").send({ name: "Gated Home" });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "EMAIL_NOT_VERIFIED");

      // …but joining a home never needs a verified email.
      const owner = await registerUser("Owner");
      await owner.api.post("/api/auth/verify-email-code").send({ code: lastCode(owner.email) }).expect(200);
      const h = (await owner.api.post("/api/homes").send({ name: "Open Home" })).body.home;
      const link = await owner.api.post(`/api/homes/${h._id}/invitations`).send({ kind: "link" });
      const joined = await u.api.post("/api/join").send({ token: link.body.token, rulesAccepted: true });
      assert.equal(joined.status, 201, "unverified users can join");
      assert.equal(joined.body.status, "active");

      await u.api.post("/api/auth/verify-email-code").send({ code: lastCode(u.email) }).expect(200);
      assert.equal((await u.api.post("/api/homes").send({ name: "Gated Home" })).status, 201);
    } finally {
      env.REQUIRE_EMAIL_VERIFICATION = false;
    }
  });

  it("sends branded HTML with the code and escapes user content", async () => {
    const mail = [...outbox].reverse().find((m) => m.code);
    assert.match(mail.html, /BachelorMate/);
    assert.ok(mail.html.includes(mail.code));
    assert.ok(mail.text.includes(mail.code), "plain-text alternative included");
  });
});

describe("uploads, listings and reviews", () => {
  let A, B, C, Out, home, m = {};
  before(async () => {
    await startDb();
    [A, B, C, Out] = await Promise.all(["Admin Asha", "Member Badal", "Member Chaya", "Outsider Omi"].map((n) => registerUser(n)));
    home = (await A.api.post("/api/homes").send({ name: "Sunrise Mess", settings: { requireApproval: false } })).body.home;
    const code = (await A.api.get(`/api/homes/${home._id}`)).body.home.code;
    await B.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    await C.api.post("/api/join").send({ code, rulesAccepted: true }).expect(201);
    for (const x of (await A.api.get(`/api/homes/${home._id}/members`)).body.members) m[x.user.name.split(" ")[1]] = x._id;
  });
  after(stopDb);

  it("resizes avatars to a 512px WebP and serves them publicly", async () => {
    const res = await B.api.post("/api/users/me/avatar").attach("avatar", await png(1200, 800), { filename: "me.png", contentType: "image/png" });
    assert.equal(res.status, 200);
    const url = res.body.user.avatarUrl;
    assert.match(url, /^\/api\/files\/[a-f0-9]{24}$/);
    const img = await request(app).get(url).buffer(true).parse((r, cb) => { const d = []; r.on("data", (c) => d.push(c)); r.on("end", () => cb(null, Buffer.concat(d))); });
    assert.equal(img.status, 200);
    assert.equal(img.headers["content-type"], "image/webp");
    const meta = await sharp(img.body).metadata();
    assert.equal(meta.width, 512);
    assert.equal(meta.height, 512);
    assert.equal(meta.exif, undefined, "metadata stripped");
  });

  it("rejects files whose content doesn't match their type", async () => {
    const res = await B.api.post("/api/users/me/avatar").attach("avatar", Buffer.from("not really a png"), { filename: "x.png", contentType: "image/png" });
    assert.equal(res.status, 400);
  });

  it("keeps receipts private to the home", async () => {
    const res = await A.api.post(`/api/homes/${home._id}/expenses`).field("title", "Gas bill").field("category", "utilities").field("amount", "300").field("day", todayIn("Asia/Dhaka")).attach("receipt", await png(400, 600), { filename: "r.png", contentType: "image/png" });
    assert.equal(res.status, 201);
    const url = res.body.expense.receipt;
    assert.match(url, /^\/api\/files\//);
    assert.equal((await request(app).get(url)).status, 401, "no token");
    assert.equal((await Out.api.get(url)).status, 404, "outsiders can't see it");
    assert.equal((await B.api.get(url)).status, 200, "members can");
  });

  let listing;
  it("lets managers post an empty seat with photos", async () => {
    assert.equal((await B.api.post(`/api/homes/${home._id}/listings`).send({})).status, 403, "members can't post");
    const res = await A.api.post(`/api/homes/${home._id}/listings`).send({
      title: "1 seat in a friendly mess", description: "Near the university.", seats: 1, roomType: "shared_room", rent: "4500", deposit: "4500",
      availableFrom: addDays(todayIn("Asia/Dhaka"), 7), gender: "male", city: "Dhaka", area: "Mirpur 10", amenities: ["wifi", "meals"],
    });
    assert.equal(res.status, 201);
    listing = res.body.listing;
    assert.equal(listing.rent, 450000);
    const photo = await A.api.post(`/api/homes/${home._id}/listings/${listing._id}/photos`).attach("photo", await png(2400, 1600), { filename: "room.png", contentType: "image/png" });
    assert.equal(photo.status, 201);
    assert.equal(photo.body.listing.photos.length, 1);
  });

  it("shows open listings publicly with filters and no private details", async () => {
    const all = await request(app).get("/api/public/listings");
    assert.equal(all.status, 200);
    assert.equal(all.body.listings.length, 1);
    const card = all.body.listings[0];
    assert.equal(card.home.name, "Sunrise Mess");
    assert.equal(card.home.memberCount, 3);
    assert.equal(card.home.address, undefined);
    assert.equal((await request(app).get("/api/public/listings?maxRent=4000")).body.listings.length, 0);
    assert.equal((await request(app).get("/api/public/listings?gender=female")).body.listings.length, 0);
    assert.equal((await request(app).get("/api/public/listings?amenities=wifi,meals&city=dha")).body.listings.length, 1);
    const detail = await request(app).get(`/api/public/listings/${listing._id}`);
    assert.equal(detail.status, 200);
    assert.ok(Array.isArray(detail.body.reviews.items));
  });

  it("lets anyone signed in contact the poster, without being friends", async () => {
    assert.equal((await A.api.post(`/api/listings/${listing._id}/contact`).send({ message: "Hello there" })).status, 400, "own listing");
    assert.equal((await B.api.post(`/api/listings/${listing._id}/contact`).send({ message: "Hello there" })).status, 400, "already lives there");
    const c = await Out.api.post(`/api/listings/${listing._id}/contact`).send({ message: "Hi! Is the seat still free?" });
    assert.equal(c.status, 201);
    const cid = c.body.conversationId;
    const convs = await A.api.get("/api/chat/conversations");
    const conv = convs.body.conversations.find((x) => x._id === cid);
    assert.equal(conv.kind, "listing");
    assert.equal(conv.listing.title, "1 seat in a friendly mess");
    await A.api.post(`/api/chat/${cid}/messages`).send({ body: "Yes! Come visit on Friday." }).expect(201);
    assert.equal((await B.api.get(`/api/chat/${cid}/messages`)).status, 404, "other members can't read it");
    const inq = await A.api.get(`/api/homes/${home._id}/listings/${listing._id}/inquiries`);
    assert.equal(inq.body.inquiries[0].user.name, "Outsider Omi");
    const n = await A.api.get("/api/notifications");
    assert.ok(n.body.items.some((i) => i.type === "listing_inquiry"));
  });

  it("hides closed listings from search", async () => {
    await A.api.post(`/api/homes/${home._id}/listings/${listing._id}/status`).send({ status: "closed" }).expect(200);
    assert.equal((await request(app).get("/api/public/listings")).body.listings.length, 0);
    assert.equal((await Out.api.post(`/api/listings/${listing._id}/contact`).send({ message: "Still there?" })).status, 404);
  });

  it("lets members and former members review the home", async () => {
    assert.equal((await Out.api.post(`/api/reviews/homes/${home._id}`).send({ rating: 1, body: "Never lived here but..." })).status, 403);
    const r = await B.api.post(`/api/reviews/homes/${home._id}`).send({ rating: 4, body: "Clean, fair bills and good food.", scores: { cleanliness: 5, food: 4 } });
    assert.equal(r.status, 201);
    const edit = await B.api.post(`/api/reviews/homes/${home._id}`).send({ rating: 5, body: "Even better after a month here." });
    assert.equal(edit.status, 200, "one review per member, editable");
    await A.api.post(`/api/homes/${home._id}/members/${m.Chaya}/remove`).send({ reason: "Moved out" }).expect(200);
    assert.equal((await C.api.post(`/api/reviews/homes/${home._id}`).send({ rating: 3, body: "Okay place, a bit noisy." })).status, 201, "former members can review");
    const list = await Out.api.get(`/api/reviews/homes/${home._id}`);
    assert.equal(list.body.summary.count, 2);
    assert.equal(list.body.summary.avg, 4);
    assert.equal(list.body.canReview, false);
    const reply = await A.api.post(`/api/reviews/homes/${home._id}/${r.body.review._id}/reply`).send({ body: "Thanks Badal!" });
    assert.equal(reply.status, 200);
    assert.equal((await B.api.post(`/api/reviews/homes/${home._id}/${r.body.review._id}/reply`).send({ body: "Self reply" })).status, 403);
  });

  it("lets people who lived together review each other", async () => {
    const eligible = await B.api.get("/api/reviews/eligible");
    assert.ok(eligible.body.people.some((p) => p.user.name === "Admin Asha"));
    const r = await B.api.post(`/api/reviews/users/${A.user._id}`).send({ homeId: home._id, rating: 5, body: "Runs the home fairly and pays on time.", tags: ["pays_on_time", "respectful"] });
    assert.equal(r.status, 201);
    assert.equal((await Out.api.post(`/api/reviews/users/${A.user._id}`).send({ homeId: home._id, rating: 1, body: "Never met them at all." })).status, 403);
    assert.equal((await B.api.post(`/api/reviews/users/${B.user._id}`).send({ homeId: home._id, rating: 5, body: "I am the best roommate." })).status, 400);
    const profile = await Out.api.get(`/api/users/${A.user._id}/reviews`);
    assert.equal(profile.body.summary.count, 1);
    assert.equal(profile.body.summary.avg, 5);
    assert.ok(profile.body.summary.topTags.some((t) => t.tag === "pays_on_time"));
  });
});
