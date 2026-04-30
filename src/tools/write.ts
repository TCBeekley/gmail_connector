import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGmailFor } from "../gmail/client.js";
import { jsonResult, errorResult } from "./helpers.js";

const ACCOUNT_DESC = "Account alias or email. 'all' is not allowed for write tools.";

function rejectAll(account: string) {
  return account === "all" ? errorResult("'all' is not allowed for write tools — specify one account.") : null;
}

function encodeSubject(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function buildRaw(opts: {
  from?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers: string[] = [];
  if (opts.from) headers.push(`From: ${opts.from}`);
  headers.push(`To: ${opts.to}`);
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  headers.push(`Subject: ${encodeSubject(opts.subject)}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=utf-8");
  headers.push("Content-Transfer-Encoding: base64");
  const body = Buffer.from(opts.body, "utf8").toString("base64");
  return Buffer.from(headers.join("\r\n") + "\r\n\r\n" + body, "utf8").toString("base64url");
}

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    "send_email",
    {
      description:
        "Send a plain-text email from the specified account. For replies, pass thread_id, in_reply_to (Message-Id of the parent), and references.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        to: z.string().describe("Comma-separated recipient list."),
        subject: z.string(),
        body: z.string().describe("Plain-text body."),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        thread_id: z.string().optional().describe("Gmail thread ID for replies."),
        in_reply_to: z.string().optional().describe("Message-Id header of the message being replied to."),
        references: z.string().optional().describe("References header for threading."),
      },
    },
    async ({ account, to, subject, body, cc, bcc, thread_id, in_reply_to, references }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail, account: acc } = await getGmailFor(account);
      const raw = buildRaw({ from: acc.email, to, cc, bcc, subject, body, inReplyTo: in_reply_to, references });
      const r = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw, threadId: thread_id },
      });
      return jsonResult({ id: r.data.id, threadId: r.data.threadId, labelIds: r.data.labelIds });
    },
  );

  server.registerTool(
    "create_draft",
    {
      description: "Create a draft email. Same fields as send_email but stored, not sent.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        to: z.string(),
        subject: z.string(),
        body: z.string(),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        thread_id: z.string().optional(),
        in_reply_to: z.string().optional(),
        references: z.string().optional(),
      },
    },
    async ({ account, to, subject, body, cc, bcc, thread_id, in_reply_to, references }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail, account: acc } = await getGmailFor(account);
      const raw = buildRaw({ from: acc.email, to, cc, bcc, subject, body, inReplyTo: in_reply_to, references });
      const r = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw, threadId: thread_id } },
      });
      return jsonResult({ id: r.data.id, message_id: r.data.message?.id });
    },
  );

  server.registerTool(
    "delete_draft",
    {
      description: "Delete a draft by draft ID.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        draft_id: z.string(),
      },
    },
    async ({ account, draft_id }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      await gmail.users.drafts.delete({ userId: "me", id: draft_id });
      return jsonResult({ deleted: draft_id });
    },
  );

  server.registerTool(
    "modify_labels",
    {
      description:
        "Add and/or remove labels on a message. Use list_labels to find label IDs. System labels include INBOX, UNREAD, STARRED, IMPORTANT, SPAM, TRASH.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        message_id: z.string(),
        add: z.array(z.string()).optional().describe("Label IDs to add."),
        remove: z.array(z.string()).optional().describe("Label IDs to remove."),
      },
    },
    async ({ account, message_id, add, remove }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      const r = await gmail.users.messages.modify({
        userId: "me",
        id: message_id,
        requestBody: { addLabelIds: add, removeLabelIds: remove },
      });
      return jsonResult({ id: r.data.id, labelIds: r.data.labelIds });
    },
  );

  server.registerTool(
    "archive_email",
    {
      description: "Archive a message (removes the INBOX label).",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        message_id: z.string(),
      },
    },
    async ({ account, message_id }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      const r = await gmail.users.messages.modify({
        userId: "me",
        id: message_id,
        requestBody: { removeLabelIds: ["INBOX"] },
      });
      return jsonResult({ id: r.data.id, labelIds: r.data.labelIds });
    },
  );

  server.registerTool(
    "trash_email",
    {
      description: "Move a message to trash (recoverable for 30 days).",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        message_id: z.string(),
      },
    },
    async ({ account, message_id }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      const r = await gmail.users.messages.trash({ userId: "me", id: message_id });
      return jsonResult({ id: r.data.id, labelIds: r.data.labelIds });
    },
  );

  server.registerTool(
    "create_label",
    {
      description: "Create a user label.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        name: z.string(),
      },
    },
    async ({ account, name }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      const r = await gmail.users.labels.create({
        userId: "me",
        requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
      });
      return jsonResult({ id: r.data.id, name: r.data.name });
    },
  );

  server.registerTool(
    "delete_label",
    {
      description: "Delete a user label by ID.",
      inputSchema: {
        account: z.string().describe(ACCOUNT_DESC),
        label_id: z.string(),
      },
    },
    async ({ account, label_id }) => {
      const guard = rejectAll(account);
      if (guard) return guard;
      const { gmail } = await getGmailFor(account);
      await gmail.users.labels.delete({ userId: "me", id: label_id });
      return jsonResult({ deleted: label_id });
    },
  );
}
