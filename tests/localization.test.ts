import { test } from "node:test";
import assert from "node:assert/strict";
import { strings, locationErrorLabel } from "../src/i18n.ts";
test("English and Kiswahili have identical complete keys", () => {
  assert.deepEqual(
    Object.keys(strings.en).sort(),
    Object.keys(strings.sw).sort(),
  );
  for (const locale of Object.values(strings))
    for (const value of Object.values(locale)) assert(value.trim().length > 0);
});

test("workflow labels translate statuses and wallet entries", async () => {
  const { recordLabel } = await import("../src/i18n.ts");
  for (const value of [
    "all",
    "placed",
    "accepted",
    "ready",
    "picked_up",
    "delivered",
    "cancelled",
    "pending",
    "approved",
    "rejected",
    "paid",
    "suspended",
    "delivery",
    "sale",
    "expense",
    "withdrawal",
  ]) {
    assert.notEqual(recordLabel(value, "sw"), value);
    assert.notEqual(recordLabel(value, "sw"), recordLabel(value, "en"));
  }
  assert.equal(recordLabel("unknown", "sw"), "unknown");
});

test("location errors distinguish permission, position and timeout failures in both languages", () => {
  for (const lang of ["en", "sw"] as const) {
    const t = strings[lang];
    assert.equal(locationErrorLabel(1, lang), t.locationDenied);
    assert.equal(locationErrorLabel(2, lang), t.locationNotFound);
    assert.equal(locationErrorLabel(3, lang), t.locationTimeout);
    assert.equal(locationErrorLabel(99, lang), t.locationUnavailable);
    assert.equal(new Set([1, 2, 3].map(code => locationErrorLabel(code, lang))).size, 3);
  }
  assert.equal(locationErrorLabel(1, "unknown"), strings.en.locationDenied);
});
