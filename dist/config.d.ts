export type Mode = "readonly" | "full";
export declare const CONFIG_DIR: string;
export declare const OAUTH_KEYS_PATH: string;
export declare const ACCOUNTS_PATH: string;
export declare const KEY_PATH: string;
export declare const READONLY_SCOPES: string[];
export declare const FULL_SCOPES: string[];
export declare function resolveMode(): Mode;
export declare function scopesFor(mode: Mode): string[];
