#!/usr/bin/env node
import { authCommand, accountsCommand } from "./auth/cli.js";
import { initCommand } from "./setup/init.js";
import { runServer } from "./server.js";

const HELP = `gmail-connector — multi-account Gmail MCP server

Usage:
  gmail-connector                          run the MCP server (stdio)
  gmail-connector init                     guided Google OAuth setup
  gmail-connector auth <alias>             add or re-auth an account
  gmail-connector accounts [list]          list connected accounts
  gmail-connector accounts rename <a> <b>  rename an alias
  gmail-connector accounts remove <alias>  remove an account

Env:
  GMAIL_MCP_MODE          'readonly' (default) or 'full'
  GMAIL_MCP_DIR           override config dir (default ~/.gmail-connector)
  GOOGLE_OAUTH_KEYS_PATH  override path to oauth-keys.json
`;

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    await runServer();
    return;
  }
  if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === "init") {
    await initCommand();
    return;
  }
  if (cmd === "auth") {
    await authCommand(rest[0]);
    return;
  }
  if (cmd === "accounts") {
    await accountsCommand(rest);
    return;
  }
  console.error(`unknown command: ${cmd}\n`);
  process.stderr.write(HELP);
  process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
