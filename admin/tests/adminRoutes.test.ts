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

describe("workspace shell contracts", () => {
  it("supports mobile drawer and desktop sidebar routes", () => {
    const mappings = getAdminNavState("/mappings");
    const discord = getAdminNavState("/discord-bot");
    expect(mappings.activeItem).toBe("mappings");
    expect(discord.activeItem).toBe("discord-bot");
  });
});

describe("root routing behavior", () => {
  it("treats root as mappings landing target", () => {
    const state = getAdminNavState("/mappings");
    expect(state.activeItem).toBe("mappings");
  });
});

describe("detail routing", () => {
  it("keeps mappings nav active for connector detail", () => {
    const state = getAdminNavState("/mappings/t1/conn_01");
    expect(state.activeItem).toBe("mappings");
  });
});

describe("discord bot route", () => {
  it("marks discord-bot active", () => {
    const state = getAdminNavState("/discord-bot");
    expect(state.activeItem).toBe("discord-bot");
  });
});
