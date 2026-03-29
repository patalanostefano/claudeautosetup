import { execSync, spawnSync } from 'child_process';

export function isGitRepo() {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' });
  return result.status === 0;
}

export function createWorktree(name) {
  const worktreePath = `.claude/worktrees/${name}`;
  const branchName = `worktree-${name}`;
  execSync(`mkdir -p .claude/worktrees`, { stdio: 'pipe' });
  execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, { stdio: 'pipe' });
  return worktreePath;
}

export function worktreeExists(name) {
  const list = listWorktrees();
  return list.some(wt => wt.branch === `worktree-${name}` || wt.path.endsWith(name));
}

export function removeWorktree(name) {
  const worktreePath = `.claude/worktrees/${name}`;
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function listWorktrees() {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    return parseWorktreeList(output);
  } catch {
    return [];
  }
}

function parseWorktreeList(output) {
  const worktrees = [];
  const blocks = output.trim().split('\n\n');
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const wt = {};
    for (const line of lines) {
      if (line.startsWith('worktree ')) wt.path = line.slice(9);
      else if (line.startsWith('HEAD ')) wt.head = line.slice(5);
      else if (line.startsWith('branch ')) wt.branch = line.slice(7).replace('refs/heads/', '');
      else if (line === 'bare') wt.bare = true;
      else if (line === 'detached') wt.detached = true;
    }
    if (wt.path) worktrees.push(wt);
  }
  return worktrees;
}

export function branchExists(branchName) {
  const result = spawnSync('git', ['branch', '--list', branchName], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}
