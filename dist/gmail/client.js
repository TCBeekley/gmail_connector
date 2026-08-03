import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { loadOAuthKeys } from "../auth/oauth.js";
import { getAccount, listAccounts, updateTokens } from "../auth/token-store.js";
const cache = new Map();
export async function getGmailFor(aliasOrEmail) {
    const account = await getAccount(aliasOrEmail);
    if (!account)
        throw new Error(`unknown account: ${aliasOrEmail}`);
    const hit = cache.get(account.alias);
    if (hit)
        return { gmail: hit.gmail, account };
    const keys = await loadOAuthKeys();
    const client = new OAuth2Client({
        clientId: keys.client_id,
        clientSecret: keys.client_secret,
    });
    client.setCredentials(account.tokens);
    client.on("tokens", (next) => {
        void updateTokens(account.alias, next);
    });
    const gmail = google.gmail({ version: "v1", auth: client });
    cache.set(account.alias, { gmail, client });
    return { gmail, account };
}
export async function resolveTargets(account) {
    if (account === "all")
        return listAccounts();
    const acc = await getAccount(account);
    if (!acc)
        throw new Error(`unknown account: ${account}`);
    return [acc];
}
//# sourceMappingURL=client.js.map