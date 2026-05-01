# gmail-connector

Multi-account Gmail MCP server. Read across multiple Gmail inboxes from one Claude Code, Claude Desktop, or Cowork session.

## Why

Anthropic's official Gmail connector binds to one account per workspace. If you have personal + work + school Gmail, you can't ask Claude to look at all of them. This server fixes that. Every tool takes an `account` parameter, and `account: "all"` fans out across every connected inbox in parallel.

Read-only by default. Full CRUD (send, drafts, labels, archive, trash) is gated behind `GMAIL_MCP_MODE=full`.

## Install

Requires Node 20+.

```bash
npm install -g github:jwlutz/gmail_connector
```

Or clone and link:

```bash
git clone https://github.com/jwlutz/gmail_connector
cd gmail_connector
npm install && npm link
```

## Setup

You need a Google Cloud project with Gmail API enabled and a Desktop OAuth client. Two paths.

### Path A: guided wizard (recommended)

```bash
gmail-connector init
```

Walks through the four Cloud Console pages (project, Gmail API, Auth Platform, OAuth client), opening each one at the right moment. Auto-detects the `client_secret_*.json` you download and moves it to `~/.gmail-connector/oauth-keys.json`. About 3 minutes.

### Path B: borrow someone else's OAuth client

If a friend running gmail-connector shares their `oauth-keys.json` with you, drop it into `~/.gmail-connector/oauth-keys.json` and skip the Cloud Console entirely. They have to add your Gmail to their project's Test users list. See [Sharing](#sharing-oauth-credentials) below for caveats.

### Path C: manual

If `init` doesn't suit you, see [Manual setup](#manual-google-cloud-setup) at the bottom.

## Authenticate accounts

```bash
gmail-connector auth personal       # opens browser, sign in to your personal Gmail
gmail-connector auth work           # repeat per account, any alias you want
gmail-connector accounts            # list connected accounts
```

`auth <alias>` opens Google's OAuth flow. Sign in to whichever Gmail you want under that alias, click through the "unverified app" warning (Advanced → Continue), grant the read-only scope, done.

> **7-day token expiry:** while your app is in Testing mode (the default), refresh tokens expire after 7 days. You'll re-run `gmail-connector auth <alias>` once a week. To make it permanent, submit the app for Google verification — multi-week process for Gmail scopes.

## Wire into Claude

### Claude Code

```bash
claude mcp add --scope user gmail-connector $(which gmail-connector)
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gmail-connector": {
      "command": "/absolute/path/to/gmail-connector"
    }
  }
}
```

Use absolute paths. Claude Desktop launches with a minimal PATH. Get the absolute path with `which gmail-connector`. Restart Claude Desktop.

### Verify

```bash
claude mcp list      # should show: gmail-connector ... ✓ Connected
```

## Modes

### Read-only (default)

Tools: `list_accounts`, `search_emails`, `get_email`, `get_thread`, `list_labels`, `get_attachment`. OAuth scope: `gmail.readonly`.

### Full CRUD

Set `GMAIL_MCP_MODE=full` in the env where the server runs. Adds: `send_email`, `create_draft`, `delete_draft`, `modify_labels`, `archive_email`, `trash_email`, `create_label`, `delete_label`. OAuth scopes: `gmail.modify` + `gmail.send`.

After flipping to full, **re-run `gmail-connector auth <alias>` for each account** so Google grants the broader scopes. Read-only tokens won't be upgraded automatically.

```json
{
  "mcpServers": {
    "gmail-connector": {
      "command": "/absolute/path/to/gmail-connector",
      "env": { "GMAIL_MCP_MODE": "full" }
    }
  }
}
```

## Tools

All tools take `account: string` as the first argument. Read tools accept `"all"` to fan out across every connected account.

| Tool | Mode | Purpose |
|---|---|---|
| `list_accounts` | both | List connected aliases. Call this first. |
| `search_emails` | both | Gmail search syntax, returns metadata |
| `get_email` | both | Full message including body |
| `get_thread` | both | All messages in a thread |
| `list_labels` | both | Labels (system + user) |
| `get_attachment` | both | Download attachment bytes (base64) |
| `send_email` | full | Plain-text send |
| `create_draft` | full | Create a draft (not sent) |
| `delete_draft` | full | Delete a draft |
| `modify_labels` | full | Add/remove labels on a message |
| `archive_email` | full | Remove INBOX label |
| `trash_email` | full | Move to trash (recoverable 30d) |
| `create_label`, `delete_label` | full | Manage user labels |

## CLI reference

```
gmail-connector                          run the MCP server (stdio)
gmail-connector init                     guided OAuth setup
gmail-connector auth <alias>             add or re-auth an account
gmail-connector accounts                 list connected accounts
gmail-connector accounts rename <a> <b>  rename an alias
gmail-connector accounts remove <alias>  remove an account
```

Env:
- `GMAIL_MCP_MODE` — `readonly` (default) or `full`
- `GMAIL_MCP_DIR` — config dir override (default `~/.gmail-connector`)
- `GOOGLE_OAUTH_KEYS_PATH` — override path to `oauth-keys.json`

## Token storage

Tokens are AES-256-GCM encrypted at rest. Encryption key (`~/.gmail-connector/.key`) and accounts file (`~/.gmail-connector/accounts.json`) are both `0600` perms. The `oauth2Client.on("tokens", ...)` handler persists rotated refresh tokens, so accounts survive Google's token rotation without re-auth.

Nothing leaves your machine except the OAuth flow itself (which goes directly between you and Google).

## Sharing OAuth credentials

For tight-knit groups (≤ 100 people), you can share `~/.gmail-connector/oauth-keys.json` privately. Google designs Desktop OAuth clients for distribution, so the secret in those credentials is not really a secret.

Recipients drop your JSON into their `~/.gmail-connector/oauth-keys.json` and skip the entire Cloud Console setup. Each user authenticates Google directly; their tokens stay on their own machine. **You never see their email content** — you're just the developer-of-record on the OAuth app.

Caveats:
- Each user must be added to your project's Test users list (limit 100 in Testing mode)
- All API calls hit your project's quota
- You see aggregate API metrics, never user content

To go beyond 100 users, submit the app for Google verification.

## Manual Google Cloud setup

If you don't want to use `gmail-connector init`:

1. **Create a project**: https://console.cloud.google.com/projectcreate
2. **Enable Gmail API**: https://console.cloud.google.com/apis/library/gmail.googleapis.com → Enable
3. **OAuth consent / Auth Platform**: https://console.cloud.google.com/auth/overview
   - "Get started" → User type: External
   - Fill in app name, support email, dev email
   - Skip the scope screen
   - Audience tab → Test users → "+ Add users" → your Gmail (and any others you'll connect)
   - Leave Publishing status: Testing
4. **Create OAuth client**: https://console.cloud.google.com/auth/clients
   - "Create Client" → Application type: **Desktop app** (not Web — Desktop allows the loopback redirect we need)
   - Name → Create → "Download JSON" on the success modal
5. **Place the JSON**:
   ```bash
   mkdir -p ~/.gmail-connector && chmod 700 ~/.gmail-connector
   mv ~/Downloads/client_secret_*.json ~/.gmail-connector/oauth-keys.json
   chmod 600 ~/.gmail-connector/oauth-keys.json
   ```

## Troubleshooting

**`Access blocked: gmail-connector has not completed the Google verification process`**
Add the email you're signing in as to your project's Test users list (Google Auth Platform → Audience → Test users).

**`Google did not return a refresh_token`**
You've previously consented and Google didn't reissue the refresh token. Visit https://myaccount.google.com/permissions, revoke "gmail-connector," then re-run `gmail-connector auth <alias>`.

**`✓ Connected` from `claude mcp list` but tools not appearing in Claude**
For Claude Desktop, make sure you used absolute paths in `claude_desktop_config.json` and restarted the app. Note: `claude -p` (print mode) does not surface user-scope MCP tools to the model. Use interactive `claude` instead, or rely on the scheduled-task / Cowork harness which uses a different code path.

**Tokens expired after 7 days**
Expected during Testing mode. Re-run `gmail-connector auth <alias>` per account.
