import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { loadOAuthKeys } from "../auth/oauth.js";
import { getAccount, listAccounts, updateTokens, type Account } from "../auth/token-store.js";

type Cached = { gmail: gmail_v1.Gmail; client: OAuth2Client };

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

  const gmail = google.gmail({ version: "v1", auth: client });
  cache.set(account.alias, { gmail, client });
  return { gmail, account };
}

export async function resolveTargets(account: string): Promise<Account[]> {
  if (account === "all") return listAccounts();
  const acc = await getAccount(account);
  if (!acc) throw new Error(`unknown account: ${account}`);
  return [acc];
}
