import fs from 'fs/promises';
import path from 'path';

export interface StoredCreds {
  gelbooruApiFragment?: string; // "&api_key=...&user_id=..." or similar
  e621Login?: string;
  e621ApiKey?: string;
  // Per-session choices for various consents; keys are site hostnames
  tagPrefetchConsents?: Record<string, 'accepted' | 'declined'>;
}

interface FileShape {
  // sid -> StoredCreds
  entries: Record<string, StoredCreds>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'creds.json');

let memory = new Map<string, StoredCreds>();
let loaded = false;

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadOnce() {
  if (loaded) return;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf-8');
    const parsed: FileShape = JSON.parse(raw);
    memory = new Map<string, StoredCreds>(Object.entries(parsed.entries || {}));
  } catch {
    memory = new Map();
  } finally {
    loaded = true;
  }
}

async function persist() {
  const entries: Record<string, StoredCreds> = {};
  for (const [k, v] of memory.entries()) entries[k] = v;
  const tmp = FILE_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify({ entries }), 'utf-8');
  await fs.rename(tmp, FILE_PATH);
}

export async function getCreds(sid: string): Promise<StoredCreds | undefined> {
  await loadOnce();
  return memory.get(sid);
}

export async function setCreds(sid: string, partial: StoredCreds): Promise<void> {
  await loadOnce();
  const current = memory.get(sid) || {};
  const next: StoredCreds = { ...current, ...partial };
  memory.set(sid, next);
  await persist();
}

export async function clearCreds(sid: string): Promise<void> {
  await loadOnce();
  memory.delete(sid);
  await persist();
}

export function parseGelbooruUserId(fragment?: string): string | undefined {
  if (!fragment) return undefined;
  try {
    const params = new URLSearchParams(fragment.startsWith('&') ? fragment.slice(1) : fragment);
    const uid = params.get('user_id') || undefined;
    return uid || undefined;
  } catch {
    return undefined;
  }
}
