import { describe, expect, it } from "bun:test";

import {
  parseConnectorSelection,
  resolvePreferredConnectorSelection,
  serializeConnectorSelection,
} from "../app/workspace/lib/connectorSelection";

describe("connector selection utils", () => {
  it("serializes and parses connector selection values", () => {
    const serialized = serializeConnectorSelection({
      tenantKey: "tenant-a",
      connectorId: "conn-1",
    });
    expect(serialized).toBe("tenant-a::conn-1");
    expect(parseConnectorSelection(serialized)).toEqual({
      tenantKey: "tenant-a",
      connectorId: "conn-1",
    });
  });

  it("rejects malformed connector selection values", () => {
    expect(parseConnectorSelection("")).toBeNull();
    expect(parseConnectorSelection("tenant-only")).toBeNull();
    expect(parseConnectorSelection("::connector")).toBeNull();
    expect(parseConnectorSelection("tenant::")).toBeNull();
  });

  it("keeps current selection when still available and falls back to first option", () => {
    const options = [
      {
        tenantKey: "tenant-a",
        connectorId: "conn-1",
        configuredChannelCount: 2,
        visibleChannelCount: 2,
      },
      {
        tenantKey: "tenant-b",
        connectorId: "conn-2",
        configuredChannelCount: 1,
        visibleChannelCount: 1,
      },
    ];

    expect(
      resolvePreferredConnectorSelection({
        options,
        currentSelection: {
          tenantKey: "tenant-b",
          connectorId: "conn-2",
        },
      }),
    ).toEqual({
      tenantKey: "tenant-b",
      connectorId: "conn-2",
    });

    expect(
      resolvePreferredConnectorSelection({
        options,
        currentSelection: {
          tenantKey: "tenant-c",
          connectorId: "conn-3",
        },
      }),
    ).toEqual({
      tenantKey: "tenant-a",
      connectorId: "conn-1",
    });
  });
});
