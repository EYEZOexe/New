import test from "node:test";
import assert from "node:assert/strict";

import { pickDiscordIdentity, validateDiscordOAuthComplete } from "./discord-oauth";

test("validateDiscordOAuthComplete rejects state mismatch", () => {
  const res = validateDiscordOAuthComplete({
    expectedState: "a",
    actualState: "b",
    currentUserId: "u1",
    tokenUserId: "u1"
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid_state");
});

test("validateDiscordOAuthComplete rejects user mismatch", () => {
  const res = validateDiscordOAuthComplete({
    expectedState: "a",
    actualState: "a",
    currentUserId: "u1",
    tokenUserId: "u2"
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "user_mismatch");
});

test("validateDiscordOAuthComplete accepts valid request", () => {
  const res = validateDiscordOAuthComplete({
    expectedState: "a",
    actualState: "a",
    currentUserId: "u1",
    tokenUserId: "u1"
  });
  assert.deepEqual(res, { ok: true });
});

test("pickDiscordIdentity returns provider uid for discord identity", () => {
  const uid = pickDiscordIdentity([
    { provider: "github", providerUid: "g1" },
    { provider: "discord", providerUid: "d1" }
  ]);
  assert.equal(uid, "d1");
});

