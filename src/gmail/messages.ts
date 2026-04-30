import type { gmail_v1 } from "googleapis";

type Part = gmail_v1.Schema$MessagePart;

export type ParsedMessage = {
  id: string;
  threadId: string | null;
  labelIds: string[];
  snippet: string;
  historyId: string | null;
  internalDate: string | null;
  headers: Record<string, string>;
  from: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  date: string | null;
  textBody: string | null;
  htmlBody: string | null;
  attachments: AttachmentMeta[];
};

export type AttachmentMeta = {
  partId: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

function decodeBase64Url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function flattenParts(part: Part | undefined, acc: Part[] = []): Part[] {
  if (!part) return acc;
  acc.push(part);
  if (part.parts) for (const p of part.parts) flattenParts(p, acc);
  return acc;
}

function pickHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const lc = name.toLowerCase();
  const h = headers.find((x) => (x.name ?? "").toLowerCase() === lc);
  return h?.value ?? null;
}

export function parseMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
  const parts = flattenParts(msg.payload);
  const headers = msg.payload?.headers ?? [];

  let textBody: string | null = null;
  let htmlBody: string | null = null;
  const attachments: AttachmentMeta[] = [];

  for (const p of parts) {
    const mime = p.mimeType ?? "";
    const data = p.body?.data;
    const attachmentId = p.body?.attachmentId;
    const filename = p.filename ?? "";

    if (filename && attachmentId) {
      attachments.push({
        partId: p.partId ?? "",
        filename,
        mimeType: mime,
        size: p.body?.size ?? 0,
        attachmentId,
      });
      continue;
    }
    if (data && mime === "text/plain" && !textBody) textBody = decodeBase64Url(data);
    else if (data && mime === "text/html" && !htmlBody) htmlBody = decodeBase64Url(data);
  }

  const headerMap: Record<string, string> = {};
  for (const h of headers) if (h.name && h.value) headerMap[h.name] = h.value;

  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? null,
    labelIds: msg.labelIds ?? [],
    snippet: msg.snippet ?? "",
    historyId: msg.historyId ?? null,
    internalDate: msg.internalDate ?? null,
    headers: headerMap,
    from: pickHeader(headers, "From"),
    to: pickHeader(headers, "To"),
    cc: pickHeader(headers, "Cc"),
    subject: pickHeader(headers, "Subject"),
    date: pickHeader(headers, "Date"),
    textBody,
    htmlBody,
    attachments,
  };
}
