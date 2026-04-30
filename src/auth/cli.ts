import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { AddressInfo } from "node:net";
import { google } from "googleapis";
import { makeOAuthClient } from "./oauth.js";
import {
  getAccount,
  listAccounts,
  putAccount,
  removeAccount,
  renameAccount,
  type Account,
} from "./token-store.js";
import { resolveMode, scopesFor, type Mode } from "../config.js";

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}

async function pickFreePort(): Promise<{ port: number; close: () => void; server: ReturnType<typeof createServer> }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ port, close: () => server.close(), server });
    });
  });
}

async function waitForCode(server: ReturnType<typeof createServer>): Promise<string> {
  return new Promise((resolve, reject) => {
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Auth failed</h1><p>${error}</p>`);
        reject(new Error(`OAuth denied: ${error}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("missing code");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html><meta charset="utf-8"><title>gmail-connector</title>
<style>body{font:16px system-ui;margin:4em auto;max-width:30em;text-align:center}</style>
<h1>Authenticated</h1><p>You can close this tab and return to your terminal.</p>`);
      resolve(code);
    });
  });
}

export async function authCommand(alias: string | undefined): Promise<void> {
  if (!alias) {
    console.error("usage: gmail-connector auth <alias>");
    process.exit(2);
  }
  const mode: Mode = resolveMode();
  const scopes = scopesFor(mode);

  const { port, server } = await pickFreePort();
  const redirectUri = `http://127.0.0.1:${port}`;
  const client = await makeOAuthClient(redirectUri);

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  console.error(`[${alias}] mode=${mode} scopes=${scopes.length}`);
  console.error("Opening browser. If it doesn't open, paste this URL:");
  console.error(authUrl);
  openBrowser(authUrl);

  const code = await waitForCode(server);
  server.close();

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token. Revoke prior consent at https://myaccount.google.com/permissions and retry.");
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: info } = await oauth2.userinfo.get();
  if (!info.email) throw new Error("could not resolve account email from userinfo");

  const account: Account = {
    alias,
    email: info.email,
    scopes,
    mode,
    tokens,
    addedAt: new Date().toISOString(),
  };
  await putAccount(account);
  console.error(`Saved ${alias} (${info.email}) — mode=${mode}`);
}

export async function accountsCommand(args: string[]): Promise<void> {
  const [sub, a, b] = args;
  if (!sub || sub === "list") {
    const accounts = await listAccounts();
    if (accounts.length === 0) {
      console.error("No accounts. Run: gmail-connector auth <alias>");
      return;
    }
    for (const acc of accounts) {
      console.log(`${acc.alias}\t${acc.email}\t${acc.mode}\t${acc.addedAt}`);
    }
    return;
  }
  if (sub === "remove" || sub === "rm") {
    if (!a) {
      console.error("usage: gmail-connector accounts remove <alias>");
      process.exit(2);
    }
    const found = await getAccount(a);
    if (!found) {
      console.error(`no account: ${a}`);
      process.exit(1);
    }
    await removeAccount(found.alias);
    console.error(`removed ${found.alias} (${found.email})`);
    return;
  }
  if (sub === "rename" || sub === "mv") {
    if (!a || !b) {
      console.error("usage: gmail-connector accounts rename <old> <new>");
      process.exit(2);
    }
    const ok = await renameAccount(a, b);
    if (!ok) {
      console.error(`no account: ${a}`);
      process.exit(1);
    }
    console.error(`renamed ${a} -> ${b}`);
    return;
  }
  console.error(`unknown subcommand: ${sub}`);
  process.exit(2);
}
