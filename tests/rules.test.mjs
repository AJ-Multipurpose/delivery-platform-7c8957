import { test } from "node:test";
import assert from "node:assert/strict";
import {
  experience,
  csvCell,
  eta,
  DELIVERY_FEE,
  MIN_WITHDRAWAL,
  transitions,
} from "../shared/rules.mjs";
import { products, menu, shops, money } from "../shared/catalog.mjs";
test("all four hostnames are isolated, preview defaults to customer", () => {
  for (const [sub, app] of [
    ["app", "customer"],
    ["driver", "driver"],
    ["partner", "partner"],
    ["admin", "admin"],
  ])
    assert.equal(experience(sub + ".dailybasicdelivery.com"), app);
  assert.equal(experience("delivery-platform-7c8957.netlify.app"), "customer");
  assert.equal(experience("dailybasicdelivery.com"), "customer");
  assert.equal(experience("DRIVER.dailybasicdelivery.com:443"), "driver");
  for (const sub of ["driver", "partner", "admin"]) {
    assert.equal(
      experience(`${sub}--delivery-platform-7c8957.netlify.app`),
      "customer",
    );
    assert.equal(experience(`${sub}.dailybasicdelivery.com.evil.test`), "customer");
  }
  assert.equal(
    experience("admin.dailybasicdelivery.com.evil.test"),
    "customer",
  );
});
test("money uses integer TSh and fixed fee/minimum", () => {
  assert.equal(DELIVERY_FEE, 2000);
  assert.equal(MIN_WITHDRAWAL, 1000);
  assert.equal(money(2500), "TSh 2,500");
  for (const p of [...products, ...menu])
    assert(Number.isInteger(p.price) && p.price >= 0);
});
test("CSV neutralises formulas, whitespace and quote escaping", () => {
  for (const input of [
    '=HYPERLINK("evil")',
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    "  =1+1",
    "\t=1",
    "\r=1",
  ])
    assert(csvCell(input).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell("Masaki, Dar"), '"Masaki, Dar"');
});
test("ETA uses real coordinates, road factor and configurable speed", () => {
  const a = { lat: -6.77, lng: 39.24 },
    b = { lat: -6.79, lng: 39.28 };
  const slow = eta(a, b, 11),
    fast = eta(a, b, 22);
  assert(slow.km > 5 && slow.km < 10);
  assert(slow.minutes > fast.minutes);
  assert.equal(eta(a, a).minutes, 1);
});
test("delivery cannot skip pickup, terminal statuses cannot transition", () => {
  assert.deepEqual(transitions.delivered, []);
  assert.deepEqual(transitions.cancelled, []);
  assert(!transitions.ready.includes("delivered"));
  assert(!transitions.picked_up.includes("cancelled"));
  assert(transitions.picked_up.includes("delivered"));
});
test("catalog references existing shops and stable unique IDs", () => {
  const all = [...products, ...menu];
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  for (const p of all) {
    assert(shops.some((s) => s.id === p.shopId));
    assert(p.name && p.sw && p.unit);
    assert(p.stock >= 0);
  }
});
