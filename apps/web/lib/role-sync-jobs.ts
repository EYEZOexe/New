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

  return {
    userId: opts.userId,
    discordUserId: opts.discordUserId,
    guildId: opts.guildId,
    desiredRoleIdsJson: JSON.stringify(desiredRoleIds),
    status: "pending",
    attempts: 0,
    lastError: null,
    lastAttemptAt: null
  };
}

