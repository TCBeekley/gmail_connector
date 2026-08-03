import { readFile } from "node:fs/promises";
import { OAuth2Client } from "google-auth-library";
import { OAUTH_KEYS_PATH } from "../config.js";
let cached = null;
export async function loadOAuthKeys() {
    if (cached)
        return cached;
    let raw;
    try {
        raw = await readFile(OAUTH_KEYS_PATH, "utf8");
    }
    catch (e) {
        if (e.code === "ENOENT") {
            throw new Error(`No OAuth keys at ${OAUTH_KEYS_PATH}.\n` +
                `Run \`gmail-connector init\` to set up Google OAuth, or set GOOGLE_OAUTH_KEYS_PATH.`);
        }
        throw e;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.installed?.client_id || !parsed.installed.client_secret) {
        throw new Error(`${OAUTH_KEYS_PATH} is not a Desktop-app OAuth client JSON ` +
            `(missing 'installed.client_id' / 'client_secret'). ` +
            `Re-create credentials with Application type "Desktop app".`);
    }
    cached = parsed.installed;
    return cached;
}
export async function makeOAuthClient(redirectUri) {
    const keys = await loadOAuthKeys();
    return new OAuth2Client({
        clientId: keys.client_id,
        clientSecret: keys.client_secret,
        redirectUri,
    });
}
//# sourceMappingURL=oauth.js.map