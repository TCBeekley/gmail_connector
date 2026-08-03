import { homedir } from "node:os";
import { join } from "node:path";
export const CONFIG_DIR = process.env.GMAIL_MCP_DIR ?? join(homedir(), ".gmail-connector");
export const OAUTH_KEYS_PATH = process.env.GOOGLE_OAUTH_KEYS_PATH ?? join(CONFIG_DIR, "oauth-keys.json");
export const ACCOUNTS_PATH = join(CONFIG_DIR, "accounts.json");
export const KEY_PATH = join(CONFIG_DIR, ".key");
export const READONLY_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.readonly",
];
export const FULL_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
];
export function resolveMode() {
    const raw = (process.env.GMAIL_MCP_MODE ?? "readonly").toLowerCase();
    if (raw === "full")
        return "full";
    if (raw === "readonly" || raw === "read-only" || raw === "read")
        return "readonly";
    throw new Error(`GMAIL_MCP_MODE must be 'readonly' or 'full', got '${raw}'`);
}
export function scopesFor(mode) {
    return mode === "full" ? FULL_SCOPES : READONLY_SCOPES;
}
//# sourceMappingURL=config.js.map