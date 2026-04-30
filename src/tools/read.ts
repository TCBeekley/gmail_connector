import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGmailFor, resolveTargets } from "../gmail/client.js";
import { parseMessage } from "../gmail/messages.js";
import { jsonResult } from "./helpers.js";

const ACCOUNT_DESC =
  "Account alias, email address, or 'all' to fan out across every connected account. Run list_accounts to discover available aliases.";

type AccountResult<T> = {
  account: string;
  alias: string;
} & ({ result: T } | { error: string });

async function fanOut<T>(
  account: string,
  fn: (alias: string) => Promise<T>,
): Promise<AccountResult<T>[]> {
  const targets = await resolveTargets(account);
  const settled = await Promise.allSettled(
    targets.map(async (a) => ({ alias: a.alias, email: a.email, value: await fn(a.alias) })),
  );
  return settled.map((s, i) => {
    const t = targets[i]!;
    if (s.status === "fulfilled") {
      return { account: t.email, alias: t.alias, result: s.value.value };
    }
    return { account: t.email, alias: t.alias, error: String(s.reason instanceof Error ? s.reason.message : s.reason) };
  });
}

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "search_emails",
    {
      description:
        "Search for messages using Gmail's search syntax (e.g. 'from:foo subject:bar after:2025/01/01 has:attachment'). Returns metadata only — call get_email for the full body.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        query: z.string().describe("Gmail search query. Empty string returns recent inbox messages."),
        max_results: z.number().int().min(1).max(100).default(20).optional()
          .describe("Maximum messages per account (1-100, default 20)."),
        label_ids: z.array(z.string()).optional()
          .describe("Restrict to messages with all of these label IDs."),
      },
    },
    async ({ account, query, max_results, label_ids }) => {
      const accounts = await fanOut(account, async (alias) => {
        const { gmail } = await getGmailFor(alias);
        const list = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: max_results ?? 20,
          labelIds: label_ids,
        });
        const ids = list.data.messages ?? [];
        const detailed = await Promise.all(
          ids.map(async (m) => {
            const r = await gmail.users.messages.get({
              userId: "me",
              id: m.id!,
              format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            });
            const parsed = parseMessage(r.data);
            return {
              id: parsed.id,
              threadId: parsed.threadId,
              labelIds: parsed.labelIds,
              snippet: parsed.snippet,
              from: parsed.from,
              to: parsed.to,
              subject: parsed.subject,
              date: parsed.date,
            };
          }),
        );
        return { messages: detailed };
      });
      return jsonResult({ accounts });
    },
  );

  server.registerTool(
    "get_email",
    {
      description:
        "Fetch a single message by ID, including headers and parsed text/HTML body. Returns attachment metadata; use get_attachment to download the bytes.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        id: z.string().describe("Gmail message ID."),
        format: z.enum(["full", "metadata", "minimal"]).default("full").optional(),
      },
    },
    async ({ account, id, format }) => {
      const accounts = await fanOut(account, async (alias) => {
        const { gmail } = await getGmailFor(alias);
        const r = await gmail.users.messages.get({
          userId: "me",
          id,
          format: format ?? "full",
        });
        return parseMessage(r.data);
      });
      return jsonResult({ accounts });
    },
  );

  server.registerTool(
    "get_thread",
    {
      description:
        "Fetch all messages in a thread by thread ID. Returns parsed messages in order.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        id: z.string().describe("Gmail thread ID."),
      },
    },
    async ({ account, id }) => {
      const accounts = await fanOut(account, async (alias) => {
        const { gmail } = await getGmailFor(alias);
        const r = await gmail.users.threads.get({
          userId: "me",
          id,
          format: "full",
        });
        return {
          id: r.data.id,
          historyId: r.data.historyId,
          messages: (r.data.messages ?? []).map(parseMessage),
        };
      });
      return jsonResult({ accounts });
    },
  );

  server.registerTool(
    "list_labels",
    {
      description: "List all labels (system + user) on an account. Returns ID, name, and type.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
      },
    },
    async ({ account }) => {
      const accounts = await fanOut(account, async (alias) => {
        const { gmail } = await getGmailFor(alias);
        const r = await gmail.users.labels.list({ userId: "me" });
        return (r.data.labels ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          messagesUnread: l.messagesUnread ?? null,
          messagesTotal: l.messagesTotal ?? null,
        }));
      });
      return jsonResult({ accounts });
    },
  );

  server.registerTool(
    "get_attachment",
    {
      description: "Download an attachment's bytes. Returns base64-encoded content.",
      inputSchema: {
        account: z.string().describe("Account alias or email. 'all' is not allowed for this tool."),
        message_id: z.string().describe("Gmail message ID containing the attachment."),
        attachment_id: z.string().describe("Attachment ID (from parsed message attachments)."),
      },
    },
    async ({ account, message_id, attachment_id }) => {
      if (account === "all") {
        return jsonResult({ error: "'all' is not supported for get_attachment; pass a specific account." });
      }
      const { gmail } = await getGmailFor(account);
      const r = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: message_id,
        id: attachment_id,
      });
      return jsonResult({
        size: r.data.size,
        data_base64: r.data.data,
      });
    },
  );
}
