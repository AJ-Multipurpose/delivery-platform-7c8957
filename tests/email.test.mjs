import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_SENDER,
  AUTH_EMAIL_SENDER,
  orderEmail,
} from "../shared/email.mjs";
test("auth and transactional configuration share the verified sender", () => {
  assert.equal(EMAIL_SENDER, AUTH_EMAIL_SENDER);
  assert(EMAIL_SENDER.includes("notify@dailybasicdelivery.com"));
});
test("order email uses server totals and contains only customer links", () => {
  const mail = orderEmail("delivery_confirmation", {
    id: 42,
    subtotal: 9000,
    delivery_fee: 2000,
  });
  assert(mail.subject.includes("arrived"));
  assert(mail.text.includes("TSh 11,000"));
  for (const forbidden of ["driver.", "partner.", "admin."])
    assert(!mail.text.includes(forbidden));
});
