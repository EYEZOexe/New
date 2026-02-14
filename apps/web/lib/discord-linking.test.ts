import test from "node:test";
import assert from "node:assert/strict";

import { makeOAuthState, verifyOAuthState } from "./discord-linking";

test("verifyOAuthState accepts exact match", () => {
  assert.equal(verifyOAuthState("abc", "abc"), true);
});

test("verifyOAuthState rejects mismatch", () => {
  assert.equal(verifyOAuthState("abc", "abd"), false);
});

test("makeOAuthState produces a stable-length string", () => {
  const s1 = makeOAuthState();
  const s2 = makeOAuthState();
  assert.ok(typeof s1 === "string" && s1.length >= 16);
  assert.notEqual(s1, s2);
});

