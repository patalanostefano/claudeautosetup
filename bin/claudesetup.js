#!/usr/bin/env node
import { Command } from 'commander';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';

import {
  createLock,
  getLock,
  listLocks,
  updateLock,
  deleteLock,
} from '../lib/lock.js';

import {
  isGitRepo,
  createWorktree,
  worktreeExists,
  removeWorktree,
  listWorktrees,
  branchExists,
} from '../lib/worktree.js';

import {
  buildExclusionList,
  getDiff,
  applyMerge,
  applySquash,
} from '../lib/export.js';

import {
  readSettings,
  writeSettings,
} from '../lib/settings.js';

// Allow bare intent: `claudesetup "build X"` → treated as `claudesetup setup "build X"`
const knownSubcommands = new Set([
  'setup', 'list', 'resume', 'export', 'erase', 'status',
  'worktree-create', '_record-file', '_record-session-end',
  '--help', '-h', '--version', '-V',
]);
const firstArg = process.argv[2];
if (firstArg && !knownSubcommands.has(firstArg) && !firstArg.startsWith('-')) {
  process.argv.splice(2, 0, 'setup');
}

const program = new Command();

program
  .name('claudesetup')
  .description('AI-guided Claude Code session setup with worktree isolation')
  .version('0.1.0');

// ─── setup ────────────────────────────────────────────────────────────────────

program
  .command('setup [intent]')
  .description('Create a new setup session for a task')
  .action(async (intent) => {
    if (!intent) {
      intent = await prompt('What do you want to build or configure? ');
    }
    if (!intent.trim()) {
      console.error('Error: intent is required.');
      process.exit(1);
    }

    const id = createLock(intent.trim());
    const lock = getLock(id);

    // Snapshot current settings.json if it exists
    const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      updateLock(id, {
        snapshot: { '.claude/settings.json': fs.readFileSync(settingsPath, 'utf8') },
      });
    }

    console.log(`\nSession created: ${id}`);
    console.log(`Intent: ${lock.intent}`);
    console.log(`Worktree: ${lock.worktreeName}\n`);

    if (isGitRepo()) {
      console.log(`Next step:`);
      console.log(`  claude --worktree ${lock.worktreeName}`);
      console.log(`\nInside Claude Code, the claude-auto-setup skill will trigger automatically.`);
      console.log(`\nOr to create the worktree now and then open Claude Code:`);
      console.log(`  claudesetup worktree-create ${lock.worktreeName}`);
      console.log(`  claude --worktree ${lock.worktreePath}`);
    } else {
      console.log(`Run \`claude\` in this directory.`);
      console.log(`The claude-auto-setup skill will trigger automatically.`);
    }
  });

// ─── list ─────────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List all setup sessions')
  .action(() => {
    const locks = listLocks();
    if (locks.length === 0) {
      console.log('No sessions found.');
      return;
    }
    console.log('\n  ID                        INTENT                            CREATED               WORKTREE           STATUS');
    console.log('  ' + '─'.repeat(110));
    for (const l of locks) {
      const created = new Date(l.createdAt).toLocaleString();
      const id = l.id.padEnd(26);
      const intent = (l.intent || '').slice(0, 32).padEnd(34);
      const wt = (l.worktreeName || '').padEnd(18);
      const status = l.status || 'active';
      console.log(`  ${id} ${intent} ${created.padEnd(22)} ${wt} ${status}`);
    }
    console.log();
  });

// ─── resume ───────────────────────────────────────────────────────────────────

program
  .command('resume <name>')
  .description('Resume an existing setup session')
  .action(async (name) => {
    const lock = getLock(name);
    if (!lock) {
      console.error(`Session not found: ${name}`);
      process.exit(1);
    }

    console.log(`\nSession: ${lock.id}`);
    console.log(`Intent:  ${lock.intent}`);

    if (isGitRepo()) {
      const exists = worktreeExists(lock.worktreeName);
      if (!exists) {
        if (branchExists(lock.branchName)) {
          console.log(`Worktree gone but branch exists — recreating...`);
          try {
            execSync(`git worktree add "${lock.worktreePath}" "${lock.branchName}"`, { stdio: 'pipe' });
            console.log(`Worktree recreated at ${lock.worktreePath}`);
          } catch (err) {
            console.warn(`Warning: could not recreate worktree: ${err.message}`);
          }
        } else {
          console.warn(`Warning: worktree and branch both missing.`);
        }
      }

      // Check drift
      const skipsInstalled = (lock.filesWritten || []).filter(f => !fs.existsSync(f));
      if (skipsInstalled.length > 0) {
        console.warn(`\nWarning: these tracked files are missing:`);
        skipsInstalled.forEach(f => console.warn(`  - ${f}`));
      }

      console.log(`\nRun: claude --worktree ${lock.worktreePath}`);
    } else {
      console.log(`\nRun: claude`);
    }
  });

// ─── export ───────────────────────────────────────────────────────────────────

program
  .command('export <name>')
  .description('Export code changes (excluding setup files) back to main')
  .action(async (name) => {
    const lock = getLock(name);
    if (!lock) {
      console.error(`Session not found: ${name}`);
      process.exit(1);
    }

    const exclusionList = buildExclusionList(lock);
    console.log(`\nBuilding diff for: ${lock.intent}`);
    console.log(`Excluding: ${exclusionList.join(', ')}\n`);

    let stat;
    try {
      const result = getDiff(lock.worktreeName, exclusionList);
      stat = result.stat;
    } catch (err) {
      console.error(`Error computing diff: ${err.message}`);
      process.exit(1);
    }

    if (!stat) {
      console.log('No source file changes to export.');
      return;
    }

    console.log('Changes to export:');
    console.log(stat);
    console.log();

    const choice = await prompt('[m]erge / [s]quash / [c]ancel? ');
    const c = choice.trim().toLowerCase();

    if (c === 'c' || c === 'cancel') {
      console.log('Cancelled.');
      return;
    }

    try {
      if (c === 'm' || c === 'merge') {
        applyMerge(lock.worktreeName);
        console.log('Merged successfully.');
      } else if (c === 's' || c === 'squash') {
        applySquash(lock.worktreeName, exclusionList, `feat: ${lock.intent}`);
        console.log('Squash-merged successfully.');
      } else {
        console.log('Unknown option. Cancelled.');
        return;
      }
    } catch (err) {
      console.error(`Export failed: ${err.message}`);
      process.exit(1);
    }

    const erase = await prompt('\nErase session now? (y/N) ');
    if (erase.trim().toLowerCase() === 'y') {
      await eraseSession(lock);
    }
  });

// ─── erase ────────────────────────────────────────────────────────────────────

program
  .command('erase <name>')
  .description('Erase a session: delete files, restore settings, remove worktree')
  .action(async (name) => {
    const lock = getLock(name);
    if (!lock) {
      console.error(`Session not found: ${name}`);
      process.exit(1);
    }
    await eraseSession(lock);
  });

// ─── status ───────────────────────────────────────────────────────────────────

program
  .command('status <name>')
  .description('Show full session details')
  .action((name) => {
    const lock = getLock(name);
    if (!lock) {
      console.error(`Session not found: ${name}`);
      process.exit(1);
    }
    console.log('\n' + JSON.stringify(lock, null, 2));
  });

// ─── worktree-create ──────────────────────────────────────────────────────────

program
  .command('worktree-create <name>')
  .description('Create a git worktree for a session')
  .action((name) => {
    if (!isGitRepo()) {
      console.error('Not a git repository.');
      process.exit(1);
    }
    try {
      const worktreePath = createWorktree(name);
      console.log(`Worktree created at: ${worktreePath}`);
      console.log(`Branch: worktree-${name}`);
    } catch (err) {
      console.error(`Failed to create worktree: ${err.message}`);
      process.exit(1);
    }
  });

// ─── _record-file (internal) ──────────────────────────────────────────────────

program
  .command('_record-file <filePath>')
  .description('(Internal) Record a file as written in the active session')
  .option('--session <id>', 'Session ID')
  .action((filePath, opts) => {
    const sessionId = opts.session || process.env.CLAUDE_SESSION_ID;
    if (!sessionId) {
      // silently succeed — not fatal
      process.exit(0);
    }
    const lock = getLock(sessionId);
    if (!lock) process.exit(0);
    if (!lock.filesWritten.includes(filePath)) {
      updateLock(lock.id, { filesWritten: [filePath] });
    }
    process.exit(0);
  });

// ─── _record-session-end (internal) ──────────────────────────────────────────

program
  .command('_record-session-end <sessionId>')
  .description('(Internal) Record session end timestamp')
  .action((sessionId) => {
    const lock = getLock(sessionId);
    if (!lock) process.exit(0);
    updateLock(lock.id, { lastSessionEnd: new Date().toISOString() });
    process.exit(0);
  });

// ─── helpers ──────────────────────────────────────────────────────────────────

async function eraseSession(lock) {
  console.log(`\nErasing session: ${lock.id}`);

  // Delete tracked files
  for (const f of lock.filesWritten || []) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`  Deleted: ${f}`);
    }
  }

  // Restore settings.json from snapshot
  if (lock.snapshot && lock.snapshot['.claude/settings.json']) {
    const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, lock.snapshot['.claude/settings.json']);
    console.log(`  Restored: .claude/settings.json`);
  }

  // Remove MCP servers
  for (const mcpName of lock.mcpServersAdded || []) {
    try {
      execSync(`claude mcp remove ${mcpName}`, { stdio: 'pipe' });
      console.log(`  Removed MCP: ${mcpName}`);
    } catch {
      console.warn(`  Warning: could not remove MCP ${mcpName}`);
    }
  }

  // Remove worktree
  if (isGitRepo() && lock.worktreeName) {
    const removed = removeWorktree(lock.worktreeName);
    if (removed) {
      console.log(`  Removed worktree: ${lock.worktreePath}`);
    }
  }

  // Delete lock
  deleteLock(lock.id);
  console.log(`\nSession erased: ${lock.id}`);
}

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

program.parse(process.argv);
