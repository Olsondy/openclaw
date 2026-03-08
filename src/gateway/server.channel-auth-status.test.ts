import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  emitChannelAuthRequired,
  emitChannelAuthResolved,
  resetChannelAuthEventsForTest,
} from "../infra/channel-auth-events.js";
import {
  connectOk,
  installGatewayTestHooks,
  rpcReq,
  startServerWithClient,
} from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

let server: Awaited<ReturnType<typeof startServerWithClient>>["server"];
let ws: Awaited<ReturnType<typeof startServerWithClient>>["ws"];

beforeAll(async () => {
  const started = await startServerWithClient();
  server = started.server;
  ws = started.ws;
  await connectOk(ws, { role: "node" });
});

beforeEach(() => {
  resetChannelAuthEventsForTest();
});

afterAll(async () => {
  ws.close();
  await server.close();
});

describe("gateway channel auth status", () => {
  test("returns default status", async () => {
    const res = await rpcReq<{ required?: boolean; updatedAt?: number | null }>(
      ws,
      "channel.auth.status",
      {},
    );
    expect(res.ok).toBe(true);
    expect(res.payload).toEqual({
      required: false,
      updatedAt: null,
    });
  });

  test("returns pending status and clears after resolve", async () => {
    emitChannelAuthRequired({ channelId: "feishu", accountId: "main" });

    const pending = await rpcReq<{ required?: boolean; updatedAt?: number | null }>(
      ws,
      "channel.auth.status",
      {},
    );
    expect(pending.ok).toBe(true);
    expect(pending.payload?.required).toBe(true);
    expect(typeof pending.payload?.updatedAt).toBe("number");

    emitChannelAuthResolved({ channelId: "feishu", accountId: "main" });

    const cleared = await rpcReq<{ required?: boolean; updatedAt?: number | null }>(
      ws,
      "channel.auth.status",
      {},
    );
    expect(cleared.ok).toBe(true);
    expect(cleared.payload?.required).toBe(false);
    expect(typeof cleared.payload?.updatedAt).toBe("number");
  });

  test("supports channel/account scoped query", async () => {
    emitChannelAuthRequired({ channelId: "feishu", accountId: "alpha" });
    emitChannelAuthRequired({ channelId: "whatsapp", accountId: "default" });

    const feishuScoped = await rpcReq<{ required?: boolean; updatedAt?: number | null }>(
      ws,
      "channel.auth.status",
      { channelId: "feishu", accountId: "alpha" },
    );
    expect(feishuScoped.ok).toBe(true);
    expect(feishuScoped.payload?.required).toBe(true);

    const telegramScoped = await rpcReq<{ required?: boolean; updatedAt?: number | null }>(
      ws,
      "channel.auth.status",
      { channelId: "telegram" },
    );
    expect(telegramScoped.ok).toBe(true);
    expect(telegramScoped.payload?.required).toBe(false);
  });
});
