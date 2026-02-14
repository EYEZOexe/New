import { computeDesiredRoleIds } from "./role-sync";

export type RoleMappingDoc = { plan?: string | null; roleIdsJson?: string | null };

export function buildRoleSyncJobDoc(opts: {
  userId: string;
  discordUserId: string | null;
  guildId: string;
  subscriptionStatus: string | null;
  plan: string | null;
  mappingDocs: RoleMappingDoc[];
}) {
  const desiredRoleIds =
    opts.discordUserId && opts.guildId
      ? computeDesiredRoleIds({
          subscriptionStatus: opts.subscriptionStatus,
          plan: opts.plan,
          mappingDocs: opts.mappingDocs
        })
      : [];

  const doc: Record<string, unknown> = {
    userId: opts.userId,
    guildId: opts.guildId,
    desiredRoleIdsJson: JSON.stringify(desiredRoleIds),
    status: "pending",
    attempts: 0
  };

  // Avoid writing explicit nulls; Appwrite versions differ on nullable behavior.
  if (opts.discordUserId) doc.discordUserId = opts.discordUserId;

  return doc;
}

