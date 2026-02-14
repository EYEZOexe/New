import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeEnvValue } from "./env";

test("sanitizeEnvValue strips wrapping quotes and trims whitespace", () => {
  assert.equal(sanitizeEnvValue(" https://appwrite.example/v1 "), "https://appwrite.example/v1");
  assert.equal(sanitizeEnvValue("\"https://appwrite.example/v1\""), "https://appwrite.example/v1");
  assert.equal(sanitizeEnvValue("'https://appwrite.example/v1'"), "https://appwrite.example/v1");
});

