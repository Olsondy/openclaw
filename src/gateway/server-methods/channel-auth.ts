import { getChannelAuthStatus } from "../../infra/channel-auth-events.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateChannelAuthStatusParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const channelAuthHandlers: GatewayRequestHandlers = {
  "channel.auth.status": async ({ params, respond }) => {
    if (!validateChannelAuthStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid channel.auth.status params: ${formatValidationErrors(validateChannelAuthStatusParams.errors)}`,
        ),
      );
      return;
    }
    const channelId =
      typeof (params as { channelId?: unknown }).channelId === "string"
        ? (params as { channelId?: string }).channelId
        : undefined;
    const accountId =
      typeof (params as { accountId?: unknown }).accountId === "string"
        ? (params as { accountId?: string }).accountId
        : undefined;
    const status = getChannelAuthStatus({ channelId, accountId });
    respond(true, status, undefined);
  },
};
