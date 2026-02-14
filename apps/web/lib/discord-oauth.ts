import { verifyOAuthState } from "./discord-linking";

export function validateDiscordOAuthComplete(opts: {
  expectedState: string | null;
  actualState: string | null;
  currentUserId: string;
  tokenUserId: string;
}): { ok: true } | { ok: false; error: "invalid_state" | "user_mismatch" } {
  if (!opts.expectedState || !opts.actualState || !verifyOAuthState(opts.expectedState, opts.actualState)) {
    return { ok: false, error: "invalid_state" };
  }
  if (opts.currentUserId !== opts.tokenUserId) {
    return { ok: false, error: "user_mismatch" };
  }
  return { ok: true };
}

export function pickDiscordIdentity(identities: Array<{ provider?: string; providerUid?: string }>): string | null {
  for (const id of identities) {
    if (id?.provider === "discord" && typeof id.providerUid === "string" && id.providerUid.length) {
      return id.providerUid;
    }
  }
  return null;
}

