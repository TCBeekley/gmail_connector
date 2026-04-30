import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { ACCOUNTS_PATH, CONFIG_DIR, KEY_PATH, type Mode } from "../config.js";
import type { Credentials } from "google-auth-library";

export type Account = {
  alias: string;
  email: string;
  scopes: string[];
  mode: Mode;
  tokens: Credentials;
  addedAt: string;
};

type Stored = { version: 1; data: string };
type Decrypted = { accounts: Record<string, Account> };

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

async function ensureDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

async function loadKey(): Promise<Buffer> {
  await ensureDir();
  try {
    const buf = await readFile(KEY_PATH);
    if (buf.length !== 32) throw new Error(`corrupt key at ${KEY_PATH}`);
    return buf;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const key = randomBytes(32);
    await writeFile(KEY_PATH, key, { mode: 0o600 });
    return key;
  }
}

function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decrypt(key: Buffer, blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

async function loadAll(): Promise<Decrypted> {
  const key = await loadKey();
  try {
    const raw = await readFile(ACCOUNTS_PATH, "utf8");
    const parsed: Stored = JSON.parse(raw);
    const plain = decrypt(key, parsed.data);
    return JSON.parse(plain) as Decrypted;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return { accounts: {} };
  }
}

async function saveAll(state: Decrypted): Promise<void> {
  const key = await loadKey();
  await mkdir(dirname(ACCOUNTS_PATH), { recursive: true, mode: 0o700 });
  const stored: Stored = { version: 1, data: encrypt(key, JSON.stringify(state)) };
  await writeFile(ACCOUNTS_PATH, JSON.stringify(stored), { mode: 0o600 });
  await chmod(ACCOUNTS_PATH, 0o600);
}

export async function listAccounts(): Promise<Account[]> {
  const { accounts } = await loadAll();
  return Object.values(accounts).sort((a, b) => a.alias.localeCompare(b.alias));
}

export async function getAccount(aliasOrEmail: string): Promise<Account | null> {
  const { accounts } = await loadAll();
  if (accounts[aliasOrEmail]) return accounts[aliasOrEmail];
  for (const acc of Object.values(accounts)) {
    if (acc.email.toLowerCase() === aliasOrEmail.toLowerCase()) return acc;
  }
  return null;
}

export async function putAccount(account: Account): Promise<void> {
  const state = await loadAll();
  state.accounts[account.alias] = account;
  await saveAll(state);
}

export async function updateTokens(alias: string, tokens: Credentials): Promise<void> {
  const state = await loadAll();
  const current = state.accounts[alias];
  if (!current) return;
  state.accounts[alias] = {
    ...current,
    tokens: {
      ...current.tokens,
      ...tokens,
      refresh_token: tokens.refresh_token ?? current.tokens.refresh_token,
    },
  };
  await saveAll(state);
}

export async function removeAccount(alias: string): Promise<boolean> {
  const state = await loadAll();
  if (!state.accounts[alias]) return false;
  delete state.accounts[alias];
  await saveAll(state);
  return true;
}

export async function renameAccount(oldAlias: string, newAlias: string): Promise<boolean> {
  const state = await loadAll();
  const acc = state.accounts[oldAlias];
  if (!acc) return false;
  if (state.accounts[newAlias]) throw new Error(`alias '${newAlias}' already exists`);
  state.accounts[newAlias] = { ...acc, alias: newAlias };
  delete state.accounts[oldAlias];
  await saveAll(state);
  return true;
}
