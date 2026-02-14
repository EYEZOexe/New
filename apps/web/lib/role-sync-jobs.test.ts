import test from "node:test";
import assert from "node:assert/strict";

import { buildRoleSyncJobDoc } from "./role-sync-jobs";

test("buildRoleSyncJobDoc sets desiredRoleIdsJson based on inputs", () => {
  const doc = buildRoleSyncJobDoc({
    userId: "u1",
    discordUserId: "d1",
    guildId: "g1",
    subscriptionStatus: "active",
    plan: "pro",
    mappingDocs: [{ plan: "pro", roleIdsJson: "[\"r1\"]" }]
  });

  assert.equal(doc.userId, "u1");
  assert.equal(doc.discordUserId, "d1");
  assert.equal(doc.guildId, "g1");
  assert.equal(doc.status, "pending");
  assert.equal(doc.desiredRoleIdsJson, "[\"r1\"]");
});

test("buildRoleSyncJobDoc yields empty desiredRoleIdsJson when discordUserId missing", () => {
  const doc = buildRoleSyncJobDoc({
    userId: "u1",
    discordUserId: null,
    guildId: "g1",
    subscriptionStatus: "active",
    plan: "pro",
    mappingDocs: [{ plan: "pro", roleIdsJson: "[\"r1\"]" }]
  });

  assert.equal(doc.desiredRoleIdsJson, "[]");
});

