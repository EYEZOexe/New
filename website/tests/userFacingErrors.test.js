import { describe, expect, it } from "bun:test";

import {
  toUserFacingAuthError,
  toUserFacingDiscordError,
} from "../lib/userFacingErrors";

describe("userFacingErrors", () => {
  it("maps login invalid credential errors", () => {
    expect(toUserFacingAuthError("Invalid credentials", "login")).toBe(
      "Incorrect email or password.",
    );
  });

  it("maps signup existing account errors", () => {
    expect(toUserFacingAuthError("User already exists", "signup")).toBe(
      "An account with this email already exists. Try logging in instead.",
    );
  });

  it("maps discord account conflict errors", () => {
    expect(
      toUserFacingDiscordError("[CONVEX M(discord:linkViewerDiscord)] discord_account_already_linked"),
    ).toBe("This Discord account is already linked to another account.");
  });

  it("maps discord callback errors", () => {
    expect(toUserFacingDiscordError("state_expired")).toBe(
      "Discord linking session expired. Please try again.",
    );
  });
});

