# claude-auto-setup

- Let Claude Code search the web and configure its own environment for your task
- Persists setup sessions across Claude Code exits — resume exactly where you left off
- Isolates all work in a git worktree; exports only your code back to main (zero config contamination)

## Install

```bash
npm install -g claude-auto-setup
```

## Quick start

```bash
# 1. Create a session for your task
claudesetup setup "build a data pipeline with dbt and Airflow"

# 2. Open Claude Code in the worktree it created
claude --worktree .claude/worktrees/build-a-data-pipeline-with-dbt-and-airflow

# 3. Inside Claude Code, the skill triggers automatically.
#    Claude searches for skills, MCPs, hooks — confirms a plan — then configures everything.

# 4. When done, export your code back to main (setup files are excluded automatically)
claudesetup export build-a-data-pipeline-with-dbt-and-airflow
```

## How it works

The `SKILL.md` in `plugin/skills/claude-auto-setup/` is the brain. When Claude Code opens in a configured worktree, the skill auto-triggers and guides Claude through:

1. **Search** — Claude uses its native `WebSearch` and `WebFetch` tools to find existing skills, MCP servers, and hook patterns for your task (no external APIs, no vectorization)
2. **Plan** — builds a `SessionPlan` inline and confirms it with you before touching anything
3. **Execute** — writes SKILL.md files, installs MCP servers, merges hooks into `settings.json`, writes subagent files
4. **Summarize** — prints exactly how to use everything that was installed

The npm package handles what the skill can't: session persistence, worktree lifecycle, and clean export.

## Export back to main

`claudesetup export` diffs only project files — never `.claude/` config files:

```bash
claudesetup export my-session
# Shows: "12 source files changed, 0 config files"
# Options: [m]erge / [s]quash / [c]ancel
```

The session lock tracks every file the setup phase wrote, so the exclusion list is always accurate.

## Session commands

```bash
claudesetup list                    # all sessions
claudesetup status my-session       # full session details
claudesetup resume my-session       # resume (recreates worktree if needed)
claudesetup erase my-session        # clean up: delete files, restore settings, remove worktree
```

## Integration with other packages

- **[coder-config](https://github.com/regression-io/coder-config)** — static MCP/rules configuration across tools; complementary for base config
- **[@schuettc/claude-code-setup](https://www.npmjs.com/package/@schuettc/claude-code-setup)** — preset plugin installer; use as a fallback when search finds nothing
- **[claudekit](https://www.npmjs.com/package/claudekit)** — guardrails and checkpoints; can be installed as part of a claude-auto-setup session

---

> Not affiliated with Anthropic. Claude and Claude Code are trademarks of Anthropic.

## License

MIT
