import { type gmail_v1 } from "googleapis";
import { type Account } from "../auth/token-store.js";
/**
 * gaxios already implements exponential backoff; it just needs to be switched on and
 * taught about Gmail's 403-flavoured rate limit. The quota that trips here is billed
 * per minute, so the retry budget has to outlast a full window: 8 attempts with
 * multiplier 2, capped at 32s each, spans ~2min of waiting.
 * ponytail: fixed budget. If a workload legitimately needs longer, make it an env knob
 * rather than raising this — past ~2min the caller should be batching less, not waiting more.
 */
export declare const RETRY_CONFIG: {
    retry: number;
    retryDelay: number;
    retryDelayMultiplier: number;
    maxRetryDelay: number;
    shouldRetry(err: unknown): boolean;
};
export declare function getGmailFor(aliasOrEmail: string): Promise<{
    gmail: gmail_v1.Gmail;
    account: Account;
}>;
export declare function resolveTargets(account: string): Promise<Account[]>;
