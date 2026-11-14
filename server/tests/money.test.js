const test = require("node:test");
const assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
const { toMinor, allocate } = require("../lib/money");
const { addDays, monthRange, isValidDay } = require("../lib/dates");

test("toMinor parses decimals exactly", () => {
  assert.equal(toMinor("120.50"), 12050);
  assert.equal(toMinor(0.1), 10);
  assert.equal(toMinor("1,200.05"), 120005);
  assert.equal(toMinor("0.29"), 29); // 0.29*100 = 28.999… in floating point
  assert.throws(() => toMinor("1.234"));
  assert.throws(() => toMinor("-5"));
  assert.throws(() => toMinor("0"));
  assert.equal(toMinor("-5", { allowNegative: true }), -500);
});

test("toMinor accepts amounts typed on a Bangla keyboard", () => {
  assert.equal(toMinor("১২০"), 12000);
  assert.equal(toMinor("১,২০০.৫০"), 120050);
  assert.equal(toMinor("৳ ৪৫০০"), 450000);
  assert.equal(toMinor("12০.5"), 12050); // mixed scripts
  assert.throws(() => toMinor("৳"), /required/);
  assert.throws(() => toMinor("১.২৩৪"));
});

test("allocate always sums to the total", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(allocate(1000, [0.5, 1, 2.5]).reduce((a, b) => a + b), 1000);
  assert.deepEqual(allocate(500, [0, 0]), [0, 0]);
  for (let i = 0; i < 200; i++) {
    const total = Math.floor(Math.random() * 1e7);
    const w = [...Array(1 + (i % 9))].map(() => Math.random() * 10);
    assert.equal(allocate(total, w).reduce((a, b) => a + b, 0), total);
  }
});

test("date helpers", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-12-31", 1), "2025-01-01");
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.equal(isValidDay("2023-02-29"), false);
});
