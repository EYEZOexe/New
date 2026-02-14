import test from "node:test";
import assert from "node:assert/strict";

import { computeDesiredRoleIds, parseRoleIdsJson } from "./role-sync";

test("parseRoleIdsJson returns empty array on invalid JSON", () => {
  assert.deepEqual(parseRoleIdsJson("not-json"), []);
});

test("parseRoleIdsJson returns only string entries", () => {
  assert.deepEqual(parseRoleIdsJson("[\"1\",2,null,\"3\"]"), ["1", "3"]);
});

test("computeDesiredRoleIds returns empty for inactive subscription", () => {
  assert.deepEqual(
    computeDesiredRoleIds({
      subscriptionStatus: "inactive",
      plan: "pro",
      mappingDocs: [{ plan: "pro", roleIdsJson: "[\"1\"]" }]
    }),
    []
  );
});

test("computeDesiredRoleIds returns empty if plan missing", () => {
  assert.deepEqual(
    computeDesiredRoleIds({
      subscriptionStatus: "active",
      plan: null,
      mappingDocs: [{ plan: "pro", roleIdsJson: "[\"1\"]" }]
    }),
    []
  );
});

test("computeDesiredRoleIds returns roles for mapped plan", () => {
  assert.deepEqual(
    computeDesiredRoleIds({
      subscriptionStatus: "active",
      plan: "pro",
      mappingDocs: [{ plan: "pro", roleIdsJson: "[\"1\",\"2\"]" }]
    }),
    ["1", "2"]
  );
});

