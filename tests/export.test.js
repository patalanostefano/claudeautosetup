import { describe, it, expect } from 'vitest';
import { buildExclusionList } from '../lib/export.js';

describe('export', () => {
  it('buildExclusionList always includes .claude/ pattern', () => {
    const lock = { filesWritten: [] };
    const list = buildExclusionList(lock);
    expect(list.some(p => p === '.claude/' || p.startsWith('.claude/'))).toBe(true);
  });

  it('buildExclusionList includes paths from lock.filesWritten that are .claude/ paths', () => {
    const lock = {
      filesWritten: [
        '.claude/skills/dbt/SKILL.md',
        '.claude/agents/pipeline.md',
        'src/main.py',
      ],
    };
    const list = buildExclusionList(lock);
    expect(list).toContain('.claude/skills/dbt/SKILL.md');
    expect(list).toContain('.claude/agents/pipeline.md');
  });

  it('buildExclusionList never includes src/ paths', () => {
    const lock = {
      filesWritten: [
        '.claude/skills/foo/SKILL.md',
        'src/index.js',
        'lib/utils.py',
      ],
    };
    const list = buildExclusionList(lock);
    expect(list).not.toContain('src/index.js');
    expect(list).not.toContain('lib/utils.py');
  });

  it('buildExclusionList always includes .mcp.json and CLAUDE.md', () => {
    const lock = { filesWritten: [] };
    const list = buildExclusionList(lock);
    expect(list).toContain('.mcp.json');
    expect(list).toContain('CLAUDE.md');
  });

  it('buildExclusionList deduplicates entries', () => {
    const lock = {
      filesWritten: ['.claude/skills/foo/SKILL.md'],
    };
    const list = buildExclusionList(lock);
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
  });
});
