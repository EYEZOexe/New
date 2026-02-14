import test from "node:test";
import assert from "node:assert/strict";

import { extractCookieValue } from "./appwrite-cookies";

test("extractCookieValue returns value for a_session cookie", () => {
  const sc = "a_session_proj=SECRET; Path=/; HttpOnly; Secure; SameSite=None";
  assert.equal(extractCookieValue(sc, "a_session"), "SECRET");
});

test("extractCookieValue returns null when name does not match", () => {
  const sc = "other=SECRET; Path=/";
  assert.equal(extractCookieValue(sc, "a_session"), null);
});

