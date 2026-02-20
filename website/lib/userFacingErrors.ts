type AuthMode = "login" | "signup";

function normalizeErrorText(value: unknown): string {
  if (value instanceof Error) {
    return value.message.trim();
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function toUserFacingAuthError(error: unknown, mode: AuthMode): string {
  const raw = normalizeErrorText(error);
  const message = raw.toLowerCase();

  if (
    includesAny(message, [
      "invalid password",
      "incorrect password",
      "wrong password",
      "invalid credentials",
      "invalid login",
      "user not found",
      "account not found",
      "invalid email or password",
      "login failed",
      "sign in failed",
    ])
  ) {
    return "Incorrect email or password.";
  }

  if (
    includesAny(message, [
      "already exists",
      "already registered",
      "account exists",
      "email in use",
      "email already",
      "user already",
    ])
  ) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (includesAny(message, ["invalid email", "email_required", "email required"])) {
    return "Please enter a valid email address.";
  }

  if (includesAny(message, ["password_required", "password required"])) {
    return "Please enter your password.";
  }

  if (
    includesAny(message, [
      "password too short",
      "minimum",
      "min length",
      "weak password",
    ])
  ) {
    return "Password is too weak. Use at least 8 characters.";
  }

  if (
    includesAny(message, [
      "too many requests",
      "rate limit",
      "too many attempts",
    ])
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (
    includesAny(message, [
      "network error",
      "fetch failed",
      "failed to fetch",
      "timed out",
      "timeout",
      "connection",
    ])
  ) {
    return "Network issue. Please check your connection and try again.";
  }

  if (mode === "signup") {
    return "Unable to create your account right now. Please try again.";
  }
  return "Unable to log in right now. Please try again.";
}

export function toUserFacingDiscordError(error: unknown): string {
  const raw = normalizeErrorText(error);
  const message = raw.toLowerCase();

  if (includesAny(message, ["discord_account_already_linked"])) {
    return "This Discord account is already linked to another account.";
  }
  if (includesAny(message, ["discord_user_id_required"])) {
    return "Discord did not return a valid user id. Please try linking again.";
  }
  if (includesAny(message, ["unauthenticated"])) {
    return "Your session expired. Please log in and try again.";
  }

  if (
    includesAny(message, [
      "oauth_result_missing",
      "oauth result missing",
      "state_missing",
      "state_mismatch",
      "missing_code",
    ])
  ) {
    return "Discord linking session is invalid. Start the link flow again.";
  }

  if (includesAny(message, ["oauth_result_expired", "state_expired"])) {
    return "Discord linking session expired. Please try again.";
  }

  if (
    includesAny(message, [
      "provider_not_configured",
      "token_exchange_failed",
      "token_request_failed",
      "token_invalid",
      "profile_fetch_failed",
      "profile_request_failed",
      "profile_invalid",
    ])
  ) {
    return "Discord linking is temporarily unavailable. Please try again shortly.";
  }

  if (
    includesAny(message, [
      "failed to fetch",
      "fetch failed",
      "network",
      "timeout",
      "timed out",
    ])
  ) {
    return "Network issue while linking Discord. Please try again.";
  }

  if (includesAny(message, ["server error"])) {
    return "Discord linking failed on the server. Please try again.";
  }

  return raw || "Discord linking failed. Please try again.";
}

export function toUserFacingDiscordCallbackError(code: string): string {
  return toUserFacingDiscordError(code);
}

