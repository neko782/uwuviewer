import fs from 'fs/promises';
import path from 'path';

export interface GlobalCreds {
  gelbooruApiFragment?: string; // "&api_key=...&user_id=..."
  e621Login?: string;
  e621ApiKey?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'global_creds.json');

let cache: GlobalCreds | null = null;
let loaded = false;

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadOnce() {
  if (loaded) return;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf-8');
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  } finally {
    loaded = true;
  }
}

async function persist() {
  await ensureDataDir();
  const tmp = FILE_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(cache || {}), 'utf-8');
  await fs.rename(tmp, FILE_PATH);
}

export async function getGlobalCreds(): Promise<GlobalCreds> {
  await loadOnce();
  return cache || {};
}

export async function setGlobalCreds(partial: GlobalCreds): Promise<void> {
  await loadOnce();
  cache = { ...(cache || {}), ...partial };
  await persist();
}

export async function clearGlobalCreds(): Promise<void> {
  await loadOnce();
  cache = {};
  await persist();
}
