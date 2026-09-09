import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
export declare function jsonResult(value: unknown): CallToolResult;
export declare function errorResult(message: string): CallToolResult;
/**
 * Run `fn` over `items` with at most `limit` in flight.
 * Gmail bills messages.get at 5 quota units and caps a user at 250 units/sec, so an
 * unbounded fan-out over a 100-result page reliably trips the quota before it starts.
 */
export declare function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
