import { describe, expect, it } from "bun:test";

import * as signals from "../../convex/signals";
import * as workspace from "../../convex/workspace";

describe("convex workspace callback exports", () => {
  it("exposes new workspace landing snapshot query", () => {
    expect(workspace.publicLandingSnapshot).toBeDefined();
    expect(typeof workspace.publicLandingSnapshot).toBe("function");
  });

  it("exposes viewer connector options query", () => {
    expect(signals.listViewerConnectorOptions).toBeDefined();
    expect(typeof signals.listViewerConnectorOptions).toBe("function");
  });
});
