export function jsonResult(value) {
    return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    };
}
export function errorResult(message) {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
/**
 * Run `fn` over `items` with at most `limit` in flight.
 * Gmail bills messages.get at 5 quota units and caps a user at 250 units/sec, so an
 * unbounded fan-out over a 100-result page reliably trips the quota before it starts.
 */
export async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length)
                return;
            out[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return out;
}
//# sourceMappingURL=helpers.js.map