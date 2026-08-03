import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveMode } from "./config.js";
import { registerAccountsTool } from "./tools/accounts.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
export async function runServer() {
    const mode = resolveMode();
    const server = new McpServer({ name: "gmail-connector", version: "0.0.1" }, { capabilities: { tools: {} } });
    registerAccountsTool(server);
    registerReadTools(server);
    if (mode === "full")
        registerWriteTools(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`gmail-connector ready (mode=${mode})`);
}
//# sourceMappingURL=server.js.map