import "server-only";

import { cookies } from "next/headers";
import { createAdminAppwriteClient, createSessionAppwriteClient, getAppwriteServerConfig } from "./appwrite-server";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  /** user is in `paid` team */
  paid: boolean;
  /** user is in `admins` team */
  admin: boolean;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const cfg = getAppwriteServerConfig();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(cfg.sessionCookieName)?.value;
  if (!sessionToken) return null;

  // Get the logged-in user using the session secret.
  let user;
  try {
    const { account } = createSessionAppwriteClient(sessionToken);
    user = await account.get();
  } catch {
    return null;
  }

  // List team memberships using API key (admin) so we can reliably check gates.
  const { users } = createAdminAppwriteClient();
  const memberships = await users.listMemberships(user.$id);
  const confirmedTeamIds = new Set(
    memberships.memberships.filter((m) => m.confirm).map((m) => m.teamId)
  );

  const paidTeamId = process.env.APPWRITE_TEAM_PAID_ID ?? "paid";
  const adminsTeamId = process.env.APPWRITE_TEAM_ADMINS_ID ?? "admins";

  return {
    userId: user.$id,
    email: user.email,
    name: user.name,
    paid: confirmedTeamIds.has(paidTeamId),
    admin: confirmedTeamIds.has(adminsTeamId)
  };
}
