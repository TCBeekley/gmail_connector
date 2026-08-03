import type { gmail_v1 } from "googleapis";
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
export declare function parseMessage(msg: gmail_v1.Schema$Message): ParsedMessage;
