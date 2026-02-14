import test from "node:test";
import assert from "node:assert/strict";

import { hmacSha256Hex, verifySellappSignature } from "./sellapp.js";

test("verifySellappSignature rejects invalid signature", () => {
  const secret = "secret";
  const bodyText = "{\"hello\":\"world\"}";

  assert.equal(
    verifySellappSignature({ secret, bodyText, signatureHeader: "deadbeef" }),
    false
  );
});

test("verifySellappSignature accepts valid signature", () => {
  const secret = "secret";
  const bodyText = "{\"hello\":\"world\"}";
  const sig = hmacSha256Hex(secret, bodyText);

  assert.equal(
    verifySellappSignature({ secret, bodyText, signatureHeader: sig }),
    true
  );
});

