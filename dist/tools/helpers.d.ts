import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
export declare function jsonResult(value: unknown): CallToolResult;
export declare function errorResult(message: string): CallToolResult;
