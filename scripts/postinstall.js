#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const src = path.join(__dirname, '..', 'plugin', 'skills', 'claude-auto-setup', 'SKILL.md');
const dest = path.join(os.homedir(), '.claude', 'skills', 'claude-auto-setup', 'SKILL.md');
const destDir = path.dirname(dest);

try {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`claude-auto-setup: skill installed → ${dest}`);
} catch (err) {
  // Non-fatal: skill can still be installed manually
  console.warn(`claude-auto-setup: could not install skill (${err.message})`);
  console.warn(`  Manual install: cp ${src} ${dest}`);
}
