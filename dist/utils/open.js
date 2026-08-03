import { spawn } from "node:child_process";
export function openBrowser(url) {
    const cmd = process.platform === "darwin" ? "open"
        : process.platform === "win32" ? "start"
            : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}
//# sourceMappingURL=open.js.map