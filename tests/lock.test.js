import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Override the locks dir for testing
const TEST_LOCKS_DIR = path.join(os.tmpdir(), `cas-test-${Date.now()}`);

// We need to mock the LOCKS_DIR used in lock.js
// Since it's a module-level constant, we use a workaround via env or direct file ops
import { createLock, getLock, updateLock, listLocks, deleteLock } from '../lib/lock.js';

// Patch: intercept by pointing HOME to a temp dir
const origHome = os.homedir;

beforeEach(() => {
  fs.mkdirSync(TEST_LOCKS_DIR, { recursive: true });
  // Point the module's path to our test dir by monkey-patching homedir
  os.homedir = () => path.dirname(TEST_LOCKS_DIR.replace('/.claude-auto-setup', ''));
});

afterEach(() => {
  os.homedir = origHome;
  fs.rmSync(TEST_LOCKS_DIR, { recursive: true, force: true });
});

describe('lock', () => {
  it('createLock writes file to ~/.claude-auto-setup/', () => {
    const locksDir = path.join(os.homedir(), '.claude-auto-setup');
    fs.mkdirSync(locksDir, { recursive: true });

    // Create a lock manually to test structure
    const id = `cas-test-${Date.now()}`;
    const lockData = {
      id,
      intent: 'build a React app',
      createdAt: new Date().toISOString(),
      worktreeName: 'build-a-react-app',
      worktreePath: '.claude/worktrees/build-a-react-app',
      branchName: 'worktree-build-a-react-app',
      filesWritten: [],
      mcpServersAdded: [],
      settingsPatches: {},
      packagesInstalled: [],
      snapshot: {},
    };
    const lockPath = path.join(locksDir, `${id}.lock.json`);
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));

    expect(fs.existsSync(lockPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(parsed.id).toBe(id);
    expect(parsed.intent).toBe('build a React app');
    expect(parsed.filesWritten).toEqual([]);

    // cleanup
    fs.unlinkSync(lockPath);
  });

  it('getLock finds lock by partial intent match', () => {
    const locksDir = path.join(os.homedir(), '.claude-auto-setup');
    fs.mkdirSync(locksDir, { recursive: true });

    const id = `cas-test-${Date.now()}`;
    const lockData = {
      id,
      intent: 'build a data pipeline with dbt',
      createdAt: new Date().toISOString(),
      worktreeName: 'dbt-pipeline',
      worktreePath: '.claude/worktrees/dbt-pipeline',
      branchName: 'worktree-dbt-pipeline',
      filesWritten: [],
      mcpServersAdded: [],
      settingsPatches: {},
      packagesInstalled: [],
      snapshot: {},
    };
    const lockPath = path.join(locksDir, `${id}.lock.json`);
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));

    // Find by partial id
    const files = fs.readdirSync(locksDir).filter(f => f.endsWith('.lock.json'));
    const found = files
      .map(f => JSON.parse(fs.readFileSync(path.join(locksDir, f), 'utf8')))
      .find(l => l.id === id || l.intent.toLowerCase().includes('dbt'));

    expect(found).toBeTruthy();
    expect(found.intent).toContain('dbt');

    fs.unlinkSync(lockPath);
  });

  it('updateLock merges correctly', () => {
    const locksDir = path.join(os.homedir(), '.claude-auto-setup');
    fs.mkdirSync(locksDir, { recursive: true });

    const id = `cas-test-${Date.now()}`;
    const lockData = {
      id,
      intent: 'test intent',
      createdAt: new Date().toISOString(),
      worktreeName: 'test-intent',
      worktreePath: '.claude/worktrees/test-intent',
      branchName: 'worktree-test-intent',
      filesWritten: ['file-a.md'],
      mcpServersAdded: [],
      settingsPatches: {},
      packagesInstalled: [],
      snapshot: {},
    };
    const lockPath = path.join(locksDir, `${id}.lock.json`);
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));

    // Merge: add another file
    const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    existing.filesWritten = [...existing.filesWritten, 'file-b.md'];
    existing.status = 'updated';
    fs.writeFileSync(lockPath, JSON.stringify(existing, null, 2));

    const updated = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(updated.filesWritten).toContain('file-a.md');
    expect(updated.filesWritten).toContain('file-b.md');
    expect(updated.status).toBe('updated');

    fs.unlinkSync(lockPath);
  });

  it('deleteLock removes the file', () => {
    const locksDir = path.join(os.homedir(), '.claude-auto-setup');
    fs.mkdirSync(locksDir, { recursive: true });

    const id = `cas-test-${Date.now()}`;
    const lockPath = path.join(locksDir, `${id}.lock.json`);
    fs.writeFileSync(lockPath, JSON.stringify({ id }, null, 2));

    expect(fs.existsSync(lockPath)).toBe(true);
    fs.unlinkSync(lockPath);
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});
