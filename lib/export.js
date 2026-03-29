import { execSync, spawnSync } from 'child_process';

const ALWAYS_EXCLUDE = ['.claude/', '.mcp.json', 'CLAUDE.md'];

export function buildExclusionList(lock) {
  const fromLock = (lock.filesWritten || []).filter(p =>
    p.startsWith('.claude/') || p === '.mcp.json' || p === 'CLAUDE.md'
  );
  const all = [...new Set([...ALWAYS_EXCLUDE, ...fromLock])];
  return all;
}

export function getDiff(worktreeName, exclusionList) {
  const branch = `worktree-${worktreeName}`;
  const excludeArgs = exclusionList.map(p => `:(exclude)${p}`).join(' ');
  try {
    const stat = execSync(
      `git diff --stat main..${branch} -- . ${exclusionList.map(p => `':(exclude)${p}'`).join(' ')}`,
      { encoding: 'utf8', shell: true }
    );
    const full = execSync(
      `git diff main..${branch} -- . ${exclusionList.map(p => `':(exclude)${p}'`).join(' ')}`,
      { encoding: 'utf8', shell: true }
    );
    return { stat: stat.trim(), diff: full };
  } catch (err) {
    throw new Error(`git diff failed: ${err.message}`);
  }
}

export function applyMerge(worktreeName) {
  const branch = `worktree-${worktreeName}`;
  execSync(`git merge ${branch}`, { stdio: 'inherit' });
}

export function applyPatch(worktreeName, exclusionList) {
  const branch = `worktree-${worktreeName}`;
  const excludeArgs = exclusionList.map(p => `':(exclude)${p}'`).join(' ');
  const patch = execSync(
    `git diff main..${branch} -- . ${excludeArgs}`,
    { encoding: 'utf8', shell: true }
  );
  if (!patch.trim()) {
    console.log('No changes to apply.');
    return;
  }
  const proc = spawnSync('git', ['apply', '--index'], {
    input: patch,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (proc.status !== 0) throw new Error('git apply failed');
}

export function applySquash(worktreeName, exclusionList, commitMessage) {
  const branch = `worktree-${worktreeName}`;
  execSync(`git merge --squash ${branch}`, { stdio: 'pipe' });
  // Unstage and restore excluded files
  for (const p of exclusionList) {
    try {
      execSync(`git reset HEAD -- "${p}"`, { stdio: 'pipe' });
      execSync(`git checkout -- "${p}"`, { stdio: 'pipe' });
    } catch {
      // file may not exist, that's fine
    }
  }
  const msg = commitMessage || `feat: ${worktreeName} (claude-auto-setup)`;
  execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
}
