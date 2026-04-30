import { readFile } from "node:fs/promises";
import { OAuth2Client } from "google-auth-library";
import { OAUTH_KEYS_PATH } from "../config.js";

type DesktopKeys = {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

let cached: DesktopKeys["installed"] | null = null;

export async function loadOAuthKeys(): Promise<DesktopKeys["installed"]> {
  if (cached) return cached;
  const raw = await readFile(OAUTH_KEYS_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<DesktopKeys>;
  if (!parsed.installed?.client_id || !parsed.installed.client_secret) {
    throw new Error(
      `${OAUTH_KEYS_PATH} is not a Desktop-app OAuth client JSON ` +
        `(missing 'installed.client_id' / 'client_secret')`,
    );
  }
  cached = parsed.installed;
  return cached;
}

export async function makeOAuthClient(redirectUri: string): Promise<OAuth2Client> {
  const keys = await loadOAuthKeys();
  return new OAuth2Client({
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri,
  });
}
