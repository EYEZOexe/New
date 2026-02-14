type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string;
};

export function getDiscordOAuthConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId) throw new Error("Missing env: DISCORD_CLIENT_ID");
  if (!clientSecret) throw new Error("Missing env: DISCORD_CLIENT_SECRET");
  return { clientId, clientSecret };
}

export async function exchangeDiscordCodeForToken(opts: {
  code: string;
  redirectUri: string;
}): Promise<DiscordTokenResponse> {
  const { clientId, clientSecret } = getDiscordOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri
  });

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const err: any = new Error(
      data?.error_description || data?.message || `Discord token exchange failed (${res.status})`
    );
    err.code = res.status;
    err.response = data;
    throw err;
  }

  return data as DiscordTokenResponse;
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const err: any = new Error(data?.message || `Discord /users/@me failed (${res.status})`);
    err.code = res.status;
    err.response = data;
    throw err;
  }

  if (!data?.id || typeof data.id !== "string") {
    throw new Error("Discord user response missing id");
  }
  return data as DiscordUser;
}

