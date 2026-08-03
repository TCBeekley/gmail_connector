import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdir, readdir, copyFile, stat, readFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR, OAUTH_KEYS_PATH } from "../config.js";
import { openBrowser } from "../utils/open.js";
const STEPS = [
    {
        title: "Create or pick a Google Cloud project",
        url: "https://console.cloud.google.com/projectcreate",
        note: 'Name it (e.g. "gmail-connector") and click Create. Skip this step if you already have a project — just switch to it in the top-left dropdown.',
    },
    {
        title: "Enable the Gmail API on that project",
        url: "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
        note: 'Click Enable. Takes a few seconds.',
    },
    {
        title: "Configure the OAuth consent screen / Google Auth Platform",
        url: "https://console.cloud.google.com/auth/overview",
        note: 'Click "Get started" → User type: External → fill the form (app name, support email, dev email). Then on the Audience tab: Test users → "+ Add users" → enter every Gmail you intend to connect (you can come back and add more later). Leave Publishing status: Testing.',
    },
    {
        title: "Create a Desktop OAuth client",
        url: "https://console.cloud.google.com/auth/clients",
        note: 'Click "Create Client" → Application type: **Desktop app** (NOT Web application — Desktop allows the loopback redirect we need) → name it → Create. On the success modal click "Download JSON".',
    },
];
async function findDownloadedJson() {
    const dir = join(homedir(), "Downloads");
    try {
        const entries = await readdir(dir);
        const matches = entries.filter((n) => n.startsWith("client_secret_") && n.endsWith(".json"));
        if (matches.length === 0)
            return null;
        const stats = await Promise.all(matches.map(async (n) => ({ n, mtime: (await stat(join(dir, n))).mtimeMs })));
        stats.sort((a, b) => b.mtime - a.mtime);
        return join(dir, stats[0].n);
    }
    catch {
        return null;
    }
}
async function validateKeysFile(path) {
    let raw;
    try {
        raw = await readFile(path, "utf8");
    }
    catch (e) {
        return { ok: false, reason: `cannot read ${path}: ${e.message}` };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        return { ok: false, reason: `not valid JSON: ${e.message}` };
    }
    if (!parsed.installed?.client_id || !parsed.installed.client_secret) {
        return {
            ok: false,
            reason: 'missing "installed.client_id" / "installed.client_secret" — looks like a Web client. Re-create with Application type: Desktop app.',
        };
    }
    return { ok: true };
}
export async function initCommand() {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    const existing = await validateKeysFile(OAUTH_KEYS_PATH);
    if (existing.ok) {
        console.log(`✓ ${OAUTH_KEYS_PATH} is in place and looks valid.`);
        console.log(`  Next: gmail-connector auth <alias>`);
        return;
    }
    if (!stdin.isTTY) {
        console.error("init is interactive — run from a terminal.");
        console.error(`Or: drop your Desktop OAuth client JSON at ${OAUTH_KEYS_PATH} manually.`);
        process.exit(2);
    }
    const rl = createInterface({ input: stdin, output: stdout });
    console.log("");
    console.log("gmail-connector setup");
    console.log("");
    console.log("Walk through 4 Google Cloud Console pages to create an OAuth Desktop client.");
    console.log("I'll open each one at the right moment. ~3 minutes total.");
    console.log("");
    for (let i = 0; i < STEPS.length; i++) {
        const s = STEPS[i];
        console.log(`[${i + 1}/${STEPS.length + 1}] ${s.title}`);
        console.log(`        ${s.note}`);
        await rl.question(`        Press Enter to open ${s.url} `);
        openBrowser(s.url);
        await rl.question(`        Press Enter when done `);
        console.log("");
    }
    console.log(`[${STEPS.length + 1}/${STEPS.length + 1}] Place the downloaded JSON`);
    const downloaded = await findDownloadedJson();
    if (!downloaded) {
        console.log("        Couldn't find client_secret_*.json in ~/Downloads.");
        console.log(`        After downloading, run:`);
        console.log(`          mv ~/Downloads/client_secret_*.json ${OAUTH_KEYS_PATH}`);
        console.log(`          chmod 600 ${OAUTH_KEYS_PATH}`);
        console.log(`        Then re-run gmail-connector init to verify.`);
        rl.close();
        return;
    }
    console.log(`        Found: ${downloaded}`);
    const ans = (await rl.question(`        Move it to ${OAUTH_KEYS_PATH}? [Y/n] `)).trim().toLowerCase();
    rl.close();
    if (ans === "n" || ans === "no") {
        console.log("        OK — move it manually when you're ready, then re-run gmail-connector init.");
        return;
    }
    await copyFile(downloaded, OAUTH_KEYS_PATH);
    await chmod(OAUTH_KEYS_PATH, 0o600);
    const v = await validateKeysFile(OAUTH_KEYS_PATH);
    if (!v.ok) {
        console.error(`✗ Placed but validation failed: ${v.reason}`);
        process.exit(1);
    }
    console.log(`✓ Placed at ${OAUTH_KEYS_PATH}`);
    console.log("");
    console.log("Next: gmail-connector auth <alias>");
    console.log("  e.g. gmail-connector auth personal");
}
//# sourceMappingURL=init.js.map