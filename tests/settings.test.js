import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  readSettings,
  writeSettings,
  mergeHooks,
  removeHooks,
  mergePermissions,
  removePermissions,
} from '../lib/settings.js';

const TEST_DIR = path.join(os.tmpdir(), `cas-settings-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(path.join(TEST_DIR, '.claude'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('settings', () => {
  it('readSettings returns {} for missing file', () => {
    const result = readSettings(TEST_DIR);
    expect(result).toEqual({});
  });

  it('readSettings parses existing file', () => {
    const settingsPath = path.join(TEST_DIR, '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: ['Bash'] } }));
    const result = readSettings(TEST_DIR);
    expect(result.permissions.allow).toContain('Bash');
  });

  it('writeSettings creates the file with 2-space indent', () => {
    const obj = { permissions: { allow: ['Bash(dbt *)'] } };
    writeSettings(TEST_DIR, obj);
    const settingsPath = path.join(TEST_DIR, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
    const content = fs.readFileSync(settingsPath, 'utf8');
    expect(content).toContain('  ');
    expect(JSON.parse(content)).toEqual(obj);
  });

  describe('mergeHooks', () => {
    it('adds new hooks without overwriting existing', () => {
      const existing = {
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }],
        },
      };
      const newHooks = {
        Stop: [{ hooks: [{ type: 'command', command: 'echo new' }] }],
        PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo post' }] }],
      };
      const result = mergeHooks(existing, newHooks);
      expect(result.hooks.Stop).toHaveLength(2);
      expect(result.hooks.PostToolUse).toHaveLength(1);
    });

    it('does not add duplicate hooks', () => {
      const entry = { hooks: [{ type: 'command', command: 'echo dup' }] };
      const settings = { hooks: { Stop: [entry] } };
      const result = mergeHooks(settings, { Stop: [entry] });
      expect(result.hooks.Stop).toHaveLength(1);
    });

    it('creates hooks key if missing', () => {
      const result = mergeHooks({}, { Stop: [{ hooks: [] }] });
      expect(result.hooks).toBeTruthy();
      expect(result.hooks.Stop).toHaveLength(1);
    });
  });

  describe('removeHooks', () => {
    it('removes only specified entries', () => {
      const entryA = { hooks: [{ type: 'command', command: 'echo a' }] };
      const entryB = { hooks: [{ type: 'command', command: 'echo b' }] };
      const settings = { hooks: { Stop: [entryA, entryB] } };
      const result = removeHooks(settings, { Stop: [entryA] });
      expect(result.hooks.Stop).toHaveLength(1);
      expect(result.hooks.Stop[0]).toEqual(entryB);
    });

    it('cleans up empty event arrays', () => {
      const entry = { hooks: [{ type: 'command', command: 'echo x' }] };
      const settings = { hooks: { Stop: [entry] } };
      const result = removeHooks(settings, { Stop: [entry] });
      expect(result.hooks).toBeUndefined();
    });
  });

  describe('mergePermissions', () => {
    it('appends to allow array', () => {
      const settings = { permissions: { allow: ['Bash'] } };
      const result = mergePermissions(settings, ['Bash(dbt *)'], []);
      expect(result.permissions.allow).toContain('Bash');
      expect(result.permissions.allow).toContain('Bash(dbt *)');
    });

    it('deduplicates allow entries', () => {
      const settings = { permissions: { allow: ['Bash'] } };
      const result = mergePermissions(settings, ['Bash'], []);
      expect(result.permissions.allow.filter(p => p === 'Bash')).toHaveLength(1);
    });

    it('creates permissions if missing', () => {
      const result = mergePermissions({}, ['Bash(dbt *)'], []);
      expect(result.permissions.allow).toContain('Bash(dbt *)');
    });
  });

  describe('removePermissions', () => {
    it('removes specified allow entries', () => {
      const settings = { permissions: { allow: ['Bash', 'Bash(dbt *)'] } };
      const result = removePermissions(settings, ['Bash(dbt *)'], []);
      expect(result.permissions.allow).not.toContain('Bash(dbt *)');
      expect(result.permissions.allow).toContain('Bash');
    });
  });
});
