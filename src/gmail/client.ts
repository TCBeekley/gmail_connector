import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { loadOAuthKeys } from "../auth/oauth.js";
import { getAccount, listAccounts, updateTokens, type Account } from "../auth/token-store.js";

type Cached = { gmail: gmail_v1.Gmail; client: OAuth2Client };

/**
 * Gmail signals a tripped per-minute quota as HTTP *403* with reason `rateLimitExceeded`,
 * not 429 — so neither gaxios's defaults nor a plain status-code list will retry it.
 * These are the reasons that mean "slow down" rather than "you may not do this".
 */
const RATE_LIMIT_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "backendError",
]);

function isRateLimit(err: unknown): boolean {
  const e = err as {
    status?: number;
    response?: { status?: number; data?: { error?: { errors?: { reason?: string }[] } } };
    errors?: { reason?: string }[];
  };
  const status = e?.status ?? e?.response?.status;
  if (status !== 403) return false;
  const reasons = e?.errors ?? e?.response?.data?.error?.errors ?? [];
  return reasons.some((r) => r?.reason && RATE_LIMIT_REASONS.has(r.reason));
}

/**
 * gaxios already implements exponential backoff; it just needs to be switched on and
 * taught about Gmail's 403-flavoured rate limit. The quota that trips here is billed
 * per minute, so the retry budget has to outlast a full window: 8 attempts with
 * multiplier 2, capped at 32s each, spans ~2min of waiting.
 * ponytail: fixed budget. If a workload legitimately needs longer, make it an env knob
 * rather than raising this — past ~2min the caller should be batching less, not waiting more.
 */
export const RETRY_CONFIG = {
  retry: 8,
  retryDelay: 1000,
  retryDelayMultiplier: 2,
  maxRetryDelay: 32_000,
  shouldRetry(err: unknown): boolean {
    const e = err as { config?: { retryConfig?: { currentRetryAttempt?: number; retry?: number } }; status?: number; response?: { status?: number }; code?: string };
    const cfg = e?.config?.retryConfig;
    if ((cfg?.currentRetryAttempt ?? 0) >= (cfg?.retry ?? 8)) return false;
    const status = e?.status ?? e?.response?.status;
    if (status === 408 || status === 429) return true;
    if (typeof status === "number" && status >= 500 && status < 600) return true;
    return isRateLimit(e);
  },
};

const cache = new Map<string, Cached>();

export async function getGmailFor(aliasOrEmail: string): Promise<{ gmail: gmail_v1.Gmail; account: Account }> {
  const account = await getAccount(aliasOrEmail);
  if (!account) throw new Error(`unknown account: ${aliasOrEmail}`);

  const hit = cache.get(account.alias);
  if (hit) return { gmail: hit.gmail, account };

  const keys = await loadOAuthKeys();
  const client = new OAuth2Client({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
  });
  client.setCredentials(account.tokens);

  client.on("tokens", (next) => {
    void updateTokens(account.alias, next);
  });

  const gmail = google.gmail({ version: "v1", auth: client, retryConfig: RETRY_CONFIG });
  cache.set(account.alias, { gmail, client });
  return { gmail, account };
}

export async function resolveTargets(account: string): Promise<Account[]> {
  if (account === "all") return listAccounts();
  const acc = await getAccount(account);
  if (!acc) throw new Error(`unknown account: ${account}`);
  return [acc];
}
