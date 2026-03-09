import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureEnv } from "../test-utils/env.js";
import { sanitizeBinaryOutput } from "./shell-utils.js";

const isWin = process.platform === "win32";

vi.mock("./tools/nodes-utils.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./tools/nodes-utils.js")>();
  return {
    ...mod,
    listNodes: vi.fn(async () => []),
  };
});

vi.mock("../infra/shell-env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../infra/shell-env.js")>();
  return {
    ...mod,
    getShellPathFromLoginShell: vi.fn(() => "/login/bin:/opt/bin"),
    resolveShellEnvFallbackTimeoutMs: vi.fn(() => 1000),
  };
});

const { createExecTool } = await import("./bash-tools.exec.js");
const { getShellPathFromLoginShell } = await import("../infra/shell-env.js");

const normalizeText = (value?: string) =>
  sanitizeBinaryOutput(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

describe("exec host=node fallback", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;

  beforeEach(() => {
    envSnapshot = captureEnv(["PATH", "SHELL"]);
  });

  afterEach(() => {
    envSnapshot.restore();
  });

  it("falls back to gateway host behavior when no node is paired", async () => {
    if (isWin) {
      return;
    }
    process.env.PATH = "/usr/bin";

    const shellPathMock = vi.mocked(getShellPathFromLoginShell);
    shellPathMock.mockClear();
    shellPathMock.mockReturnValue("/login/bin:/opt/bin");

    const tool = createExecTool({
      host: "node",
      security: "full",
      ask: "off",
      pathPrepend: ["/prepended/bin"],
    });
    const result = await tool.execute("call-node-fallback", {
      command: 'printf "%s" "$PATH"',
    });
    const text = normalizeText(result.content.find((c) => c.type === "text")?.text);
    const lastLine = text.split("\n").filter(Boolean).at(-1);

    expect(text).toContain("No paired node available, running locally in container.");
    expect(text).not.toContain("pathPrepend is ignored for host=node");
    expect(lastLine).toBe("/prepended/bin:/login/bin:/opt/bin:/usr/bin");
    expect(shellPathMock).toHaveBeenCalledTimes(1);
  });
});

