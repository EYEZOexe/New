export type GuildRoleOwnershipSnapshot = {
  guildId: string;
  roleIds: string[];
};

export class DiscordMirrorOwnershipCache {
  private knownGuildIds = new Set<string>();
  private knownRoleIds = new Set<string>();
  private roleIdsByGuild = new Map<string, Set<string>>();
  private lastUpdatedAt: number | null = null;

  applySnapshots(args: {
    allGuildIds: string[];
    roleSnapshots: GuildRoleOwnershipSnapshot[];
  }) {
    const guildSet = new Set(
      args.allGuildIds.map((guildId) => guildId.trim()).filter((guildId) => guildId.length > 0),
    );
    const snapshotByGuild = new Map<string, Set<string>>();
    for (const snapshot of args.roleSnapshots) {
      const guildId = snapshot.guildId.trim();
      if (!guildId || !guildSet.has(guildId)) continue;
      const roleIdSet = new Set(
        snapshot.roleIds
          .map((roleId) => roleId.trim())
          .filter((roleId) => roleId.length > 0),
      );
      snapshotByGuild.set(guildId, roleIdSet);
    }

    for (const guildId of [...this.roleIdsByGuild.keys()]) {
      if (!guildSet.has(guildId)) {
        this.roleIdsByGuild.delete(guildId);
      }
    }

    for (const guildId of guildSet) {
      const snapshot = snapshotByGuild.get(guildId);
      if (snapshot) {
        this.roleIdsByGuild.set(guildId, snapshot);
      }
    }

    this.knownGuildIds = guildSet;
    const allRoleIds = new Set<string>();
    for (const [guildId, roleIds] of this.roleIdsByGuild.entries()) {
      if (!this.knownGuildIds.has(guildId)) continue;
      for (const roleId of roleIds) {
        allRoleIds.add(roleId);
      }
    }
    this.knownRoleIds = allRoleIds;
    this.lastUpdatedAt = Date.now();
  }

  hasGuild(guildId: string): boolean {
    return this.knownGuildIds.has(guildId);
  }

  hasRole(roleId: string): boolean {
    return this.knownRoleIds.has(roleId);
  }

  hasRoleInGuild(guildId: string, roleId: string): boolean {
    const guildRoles = this.roleIdsByGuild.get(guildId);
    if (!guildRoles) return false;
    return guildRoles.has(roleId);
  }

  isReady(): boolean {
    return this.lastUpdatedAt !== null;
  }

  getStats() {
    return {
      knownGuildCount: this.knownGuildIds.size,
      knownRoleCount: this.knownRoleIds.size,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }
}
