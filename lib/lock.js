import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const LOCKS_DIR = path.join(os.homedir(), '.claude-auto-setup');

function ensureLocksDir() {
  if (!fs.existsSync(LOCKS_DIR)) {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  }
}

function lockPath(id) {
  return path.join(LOCKS_DIR, `${id}.lock.json`);
}

function generateId(intent) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(3).toString('hex');
  return `cas-${date}-${hash}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createLock(intent) {
  ensureLocksDir();
  const id = generateId(intent);
  const worktreeName = slugify(intent);
  const lock = {
    id,
    intent,
    createdAt: new Date().toISOString(),
    worktreeName,
    worktreePath: `.claude/worktrees/${worktreeName}`,
    branchName: `worktree-${worktreeName}`,
    filesWritten: [],
    mcpServersAdded: [],
    settingsPatches: {},
    packagesInstalled: [],
    snapshot: {},
  };
  fs.writeFileSync(lockPath(id), JSON.stringify(lock, null, 2));
  return id;
}

export function getLock(nameOrId) {
  ensureLocksDir();
  const files = fs.readdirSync(LOCKS_DIR).filter(f => f.endsWith('.lock.json'));
  for (const file of files) {
    const lock = JSON.parse(fs.readFileSync(path.join(LOCKS_DIR, file), 'utf8'));
    if (
      lock.id === nameOrId ||
      lock.id.startsWith(nameOrId) ||
      lock.worktreeName === nameOrId ||
      lock.intent.toLowerCase().includes(nameOrId.toLowerCase())
    ) {
      return lock;
    }
  }
  return null;
}

export function updateLock(id, updates) {
  const p = lockPath(id);
  if (!fs.existsSync(p)) throw new Error(`Lock not found: ${id}`);
  const lock = JSON.parse(fs.readFileSync(p, 'utf8'));
  const merged = deepMerge(lock, updates);
  fs.writeFileSync(p, JSON.stringify(merged, null, 2));
  return merged;
}

export function listLocks() {
  ensureLocksDir();
  const files = fs.readdirSync(LOCKS_DIR).filter(f => f.endsWith('.lock.json'));
  return files.map(file => {
    return JSON.parse(fs.readFileSync(path.join(LOCKS_DIR, file), 'utf8'));
  });
}

export function deleteLock(id) {
  const p = lockPath(id);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      result[key] = [...target[key], ...source[key]];
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
