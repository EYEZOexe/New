import { describe, expect, it } from "bun:test";

import { getWorkspaceNavState, normalizeWorkspacePath } from "../lib/workspaceRoutes";

describe("workspaceRoutes", () => {
  it("marks each workspace page with its active nav key", () => {
    expect(getWorkspaceNavState("/workspace/overview").activeKey).toBe("overview");
    expect(getWorkspaceNavState("/workspace/markets").activeKey).toBe("markets");
    expect(getWorkspaceNavState("/workspace/live-intel").activeKey).toBe("live-intel");
    expect(getWorkspaceNavState("/workspace/signals").activeKey).toBe("signals");
    expect(getWorkspaceNavState("/workspace/indicators").activeKey).toBe("indicators");
    expect(getWorkspaceNavState("/workspace/strategies").activeKey).toBe("strategies");
    expect(getWorkspaceNavState("/workspace/journal").activeKey).toBe("journal");
    expect(getWorkspaceNavState("/workspace/news").activeKey).toBe("news");
  });

  it("normalizes dashboard compatibility path to workspace overview", () => {
    expect(normalizeWorkspacePath("/dashboard")).toBe("/workspace/overview");
    expect(getWorkspaceNavState("/dashboard").activeKey).toBe("overview");
  });
});

