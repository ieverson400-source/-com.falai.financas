import { test } from "node:test";
import { strict as assert } from "node:assert";
import { assertBankOwner, stripeEnvironment, stripePlanKeys, subscriptionUsable } from "./billing-rules";
test("bank connection belongs only to its authenticated user", () => {
  assert.doesNotThrow(() => assertBankOwner("account-a", "account-a"));
  assert.throws(() => assertBankOwner("account-a", "account-b"));
  assert.throws(() => assertBankOwner(undefined, "account-a"));
});
test("only configured Stripe plans and environments are accepted", () => {
  assert.deepEqual(stripePlanKeys, ["pro_monthly", "premium_monthly", "familia_monthly"]);
  assert.equal(stripeEnvironment.safeParse("production").success, false);
});
test("canceled subscriptions retain paid access until expiry", () => {
  assert.equal(subscriptionUsable("canceled", "2026-11-09T00:00:00Z", Date.parse("2026-11-08T00:00:00Z")), true);
  assert.equal(subscriptionUsable("canceled", "2026-11-07T00:00:00Z", Date.parse("2026-11-08T00:00:00Z")), false);
});