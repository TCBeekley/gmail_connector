import { listAccounts } from "../auth/token-store.js";
import { jsonResult } from "./helpers.js";
export function registerAccountsTool(server) {
    server.registerTool("list_accounts", {
        description: "List Gmail accounts connected to this server. Use this first to learn which aliases / emails can be passed as the `account` parameter to other tools.",
        inputSchema: {},
    }, async () => {
        const accounts = await listAccounts();
        return jsonResult(accounts.map((a) => ({
            alias: a.alias,
            email: a.email,
            mode: a.mode,
            addedAt: a.addedAt,
        })));
    });
}
//# sourceMappingURL=accounts.js.map