import { type Mode } from "../config.js";
import type { Credentials } from "google-auth-library";
export type Account = {
    alias: string;
    email: string;
    scopes: string[];
    mode: Mode;
    tokens: Credentials;
    addedAt: string;
};
export declare function listAccounts(): Promise<Account[]>;
export declare function getAccount(aliasOrEmail: string): Promise<Account | null>;
export declare function putAccount(account: Account): Promise<void>;
export declare function updateTokens(alias: string, tokens: Credentials): Promise<void>;
export declare function removeAccount(alias: string): Promise<boolean>;
export declare function renameAccount(oldAlias: string, newAlias: string): Promise<boolean>;
