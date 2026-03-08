import { beforeEach, describe, expect, test } from "vitest";
import {
  emitChannelAuthRequired,
  emitChannelAuthResolved,
  getChannelAuthStatus,
  resetChannelAuthEventsForTest,
} from "./channel-auth-events.js";

describe("channel auth events state", () => {
  beforeEach(() => {
    resetChannelAuthEventsForTest();
  });

  test("defaults to not required", () => {
    expect(getChannelAuthStatus()).toEqual({
      required: false,
      updatedAt: null,
    });
  });

  test("tracks required/resolved by channel and account", () => {
    emitChannelAuthRequired({ channelId: "feishu", accountId: "app-a" });
    expect(getChannelAuthStatus().required).toBe(true);

    emitChannelAuthRequired({ channelId: "feishu", accountId: "app-b" });
    emitChannelAuthResolved({ channelId: "feishu", accountId: "app-a" });
    expect(getChannelAuthStatus().required).toBe(true);

    emitChannelAuthResolved({ channelId: "feishu", accountId: "app-b" });
    expect(getChannelAuthStatus().required).toBe(false);
    expect(getChannelAuthStatus().updatedAt).not.toBeNull();
  });

  test("supports querying status by channel/account", () => {
    emitChannelAuthRequired({ channelId: "feishu", accountId: "main" });
    emitChannelAuthRequired({ channelId: "whatsapp", accountId: "default" });

    expect(getChannelAuthStatus({ channelId: "feishu" }).required).toBe(true);
    expect(getChannelAuthStatus({ channelId: "feishu", accountId: "main" }).required).toBe(true);
    expect(getChannelAuthStatus({ channelId: "telegram" }).required).toBe(false);

    emitChannelAuthResolved({ channelId: "feishu", accountId: "main" });
    expect(getChannelAuthStatus({ channelId: "feishu" }).required).toBe(false);
    expect(getChannelAuthStatus().required).toBe(true);
  });
});
