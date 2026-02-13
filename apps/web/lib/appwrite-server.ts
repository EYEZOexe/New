import "server-only";

import { Account, Client, Teams, Users } from "node-appwrite";
import { cookies } from "next/headers";

export type AppwriteServerConfig = {
  endpoint: string;
  projectId: string;
  apiKey: string;
  sessionCookieName: string;
  cookieDomain?: string;
};

export type AppwritePublicConfig = {
  endpoint: string;
  projectId: string;
  sessionCookieName: string;
  cookieDomain?: string;
};

export function getAppwritePublicConfig(): AppwritePublicConfig {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!endpoint) throw new Error("Missing env: NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!projectId) throw new Error("Missing env: NEXT_PUBLIC_APPWRITE_PROJECT_ID");

  return {
    endpoint,
    projectId,
    sessionCookieName: process.env.APPWRITE_SESSION_COOKIE ?? "g3netic_session",
    cookieDomain: process.env.APP_COOKIE_DOMAIN
  };
}

export function getAppwriteServerConfig(): AppwriteServerConfig {
  const { endpoint, projectId, sessionCookieName, cookieDomain } = getAppwritePublicConfig();
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) throw new Error("Missing env: APPWRITE_API_KEY");

  return {
    endpoint,
    projectId,
    apiKey,
    sessionCookieName,
    cookieDomain
  };
}

export function createPublicAppwriteClient() {
  const cfg = getAppwritePublicConfig();
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId);

  return {
    client,
    account: new Account(client)
  };
}

export function createAdminAppwriteClient() {
  const cfg = getAppwriteServerConfig();
  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId).setKey(cfg.apiKey);

  return {
    client,
    account: new Account(client),
    teams: new Teams(client),
    users: new Users(client)
  };
}

export function createSessionAppwriteClient(sessionSecret?: string) {
  const cfg = getAppwritePublicConfig();

  const secret = sessionSecret ?? "";
  if (!secret) throw new Error("No session");

  const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId).setSession(secret);

  return {
    client,
    account: new Account(client),
    teams: new Teams(client)
  };
}

export async function getLoggedInUser() {
  try {
    const cookieStore = await cookies();
    const cfg = getAppwriteServerConfig();
    const secret = cookieStore.get(cfg.sessionCookieName)?.value;
    if (!secret) return null;

    const { account } = createSessionAppwriteClient(secret);
    return await account.get();
  } catch {
    return null;
  }
}

export async function listCurrentUserTeams() {
  const cookieStore = await cookies();
  const cfg = getAppwriteServerConfig();
  const secret = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!secret) throw new Error("No session");

  const { teams } = createSessionAppwriteClient(secret);
  const res = await teams.list();
  return res.teams;
}
