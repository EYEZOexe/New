import { describe, expect, it } from "bun:test";
import { getAdminNavState } from "../lib/adminRoutes";

describe("admin route navigation", () => {
  it("marks mappings route active", () => {
    const state = getAdminNavState("/mappings");
    expect(state.activeItem).toBe("mappings");
  });

  it("marks shop group active for nested routes", () => {
    const state = getAdminNavState("/shop/catalog");
    expect(state.activeGroup).toBe("shop");
  });
});
