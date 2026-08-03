import { type gmail_v1 } from "googleapis";
import { type Account } from "../auth/token-store.js";
export declare function getGmailFor(aliasOrEmail: string): Promise<{
    gmail: gmail_v1.Gmail;
    account: Account;
}>;
export declare function resolveTargets(account: string): Promise<Account[]>;
