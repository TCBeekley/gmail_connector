function decodeBase64Url(s) {
    return Buffer.from(s, "base64url").toString("utf8");
}
function flattenParts(part, acc = []) {
    if (!part)
        return acc;
    acc.push(part);
    if (part.parts)
        for (const p of part.parts)
            flattenParts(p, acc);
    return acc;
}
function pickHeader(headers, name) {
    if (!headers)
        return null;
    const lc = name.toLowerCase();
    const h = headers.find((x) => (x.name ?? "").toLowerCase() === lc);
    return h?.value ?? null;
}
export function parseMessage(msg) {
    const parts = flattenParts(msg.payload);
    const headers = msg.payload?.headers ?? [];
    let textBody = null;
    let htmlBody = null;
    const attachments = [];
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
        if (data && mime === "text/plain" && !textBody)
            textBody = decodeBase64Url(data);
        else if (data && mime === "text/html" && !htmlBody)
            htmlBody = decodeBase64Url(data);
    }
    const headerMap = {};
    for (const h of headers)
        if (h.name && h.value)
            headerMap[h.name] = h.value;
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
//# sourceMappingURL=messages.js.map