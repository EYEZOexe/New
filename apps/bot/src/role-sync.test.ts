import test from "node:test";
import assert from "node:assert/strict";

import { diffRoles } from "./role-sync";

test("diffRoles returns roles to add/remove", () => {
  const res = diffRoles({ desired: ["a", "b"], current: ["b", "c"] });
  assert.deepEqual(res.toAdd.sort(), ["a"]);
  assert.deepEqual(res.toRemove.sort(), ["c"]);
});

