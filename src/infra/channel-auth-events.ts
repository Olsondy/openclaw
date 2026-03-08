// Lightweight in-process event bus for channel authorization state signals.
// Signals carry no payload to WS clients by design; runtime state is queryable via method.

export type ChannelAuthRequiredEvent = void;
export type ChannelAuthResolvedEvent = void;

export type ChannelAuthStatusSnapshot = {
  required: boolean;
  updatedAt: number | null;
};

export type ChannelAuthStatusQuery = {
  channelId?: string;
  accountId?: string;
};

export type ChannelAuthKey = {
  channelId: string;
  accountId?: string;
};

type NormalizedChannelAuthKey = {
  channelId: string;
  accountId: string;
};

const authRequiredListeners = new Set<() => void>();
const authResolvedListeners = new Set<() => void>();
const pendingByKey = new Map<string, NormalizedChannelAuthKey>();
let updatedAtMs: number | null = null;

function normalizeChannelId(channelId: string | undefined): string {
  const trimmed = channelId?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : "unknown";
}

function normalizeAccountId(accountId: string | undefined): string {
  const trimmed = accountId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "default";
}

function normalizeKey(key: ChannelAuthKey | undefined): NormalizedChannelAuthKey {
  return {
    channelId: normalizeChannelId(key?.channelId),
    accountId: normalizeAccountId(key?.accountId),
  };
}

function toPendingKey(key: NormalizedChannelAuthKey): string {
  return `${key.channelId}::${key.accountId}`;
}

function matchesQuery(
  entry: NormalizedChannelAuthKey,
  query: ChannelAuthStatusQuery | undefined,
): boolean {
  if (!query) {
    return true;
  }
  const queryChannelId = query.channelId?.trim().toLowerCase();
  if (queryChannelId && entry.channelId !== queryChannelId) {
    return false;
  }
  const queryAccountId = query.accountId?.trim();
  if (queryAccountId && entry.accountId !== queryAccountId) {
    return false;
  }
  return true;
}

export function emitChannelAuthRequired(key: ChannelAuthKey): void {
  const normalized = normalizeKey(key);
  pendingByKey.set(toPendingKey(normalized), normalized);
  updatedAtMs = Date.now();
  for (const listener of authRequiredListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function emitChannelAuthResolved(key: ChannelAuthKey): void {
  const normalized = normalizeKey(key);
  const removed = pendingByKey.delete(toPendingKey(normalized));
  if (!removed) {
    return;
  }
  updatedAtMs = Date.now();
  if (pendingByKey.size > 0) {
    return;
  }
  for (const listener of authResolvedListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function getChannelAuthStatus(query?: ChannelAuthStatusQuery): ChannelAuthStatusSnapshot {
  const required = Array.from(pendingByKey.values()).some((entry) => matchesQuery(entry, query));
  return {
    required,
    updatedAt: updatedAtMs,
  };
}

export function onChannelAuthRequired(listener: () => void): () => void {
  authRequiredListeners.add(listener);
  return () => authRequiredListeners.delete(listener);
}

export function onChannelAuthResolved(listener: () => void): () => void {
  authResolvedListeners.add(listener);
  return () => authResolvedListeners.delete(listener);
}

export function resetChannelAuthEventsForTest(): void {
  authRequiredListeners.clear();
  authResolvedListeners.clear();
  pendingByKey.clear();
  updatedAtMs = null;
}
