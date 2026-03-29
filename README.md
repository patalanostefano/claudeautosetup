# claude-auto-setup

Let Claude Code search the web and configure its own environment for your task — skills, MCPs, hooks, agents — then isolate all work in a git worktree and export only your code back to main.

## Install

```bash
npm install -g claude-auto-setup
```

The install automatically copies the skill to `~/.claude/skills/` so it's available in every project.

## Quick start

```bash
# 1. Create a session (no subcommand needed)
claudesetup "build a production Elixir Phoenix backend for DICOM medical image processing"

# 2. Open Claude Code
claude

# 3. Trigger the skill — use EITHER of these inside Claude Code:

#    Option A: slash command (most reliable)
/claude-auto-setup

#    Option B: trigger phrase
# "setup claude for building a production Elixir Phoenix backend..."
# "configure session for..."
# "I need a setup for..."

# Claude will search the web, show you a plan, confirm, then configure everything.

# 4. Export your code back to main when done (setup files excluded automatically)
claudesetup export <session-id>
```

> **Important:** Typing `"build X"` alone will NOT trigger the skill — Claude Code will just start building.
> Always use `/claude-auto-setup` or a `"setup claude for..."` phrase to invoke it.

## How it works

The `SKILL.md` installed in `~/.claude/skills/claude-auto-setup/` is the brain. When triggered, it guides Claude through 7 phases:

1. **Idempotency check** — skips setup if already configured for this task
2. **Understand intent** — extracts tech stack, keywords, session name
3. **Search** — one parallel pass: `WebSearch` for skills/MCPs on GitHub, `WebFetch` from curated lists
4. **Plan** — builds a `SessionPlan` inline and shows it to you before touching anything
5. **Confirm** — mandatory confirmation step; you can edit individual items or abort
6. **Execute** — writes skill files, installs MCPs via `claude mcp add`, merges hooks into `settings.json`, writes agent files
7. **Summarize** — prints exactly what was installed and how to use it, plus session commands

The npm CLI handles what the skill can't: session persistence, worktree lifecycle, and clean export.

## Worktree isolation

`claudesetup` creates a git worktree for every session. All edits — including `.claude/` config — stay on a separate branch from `main`. This means:

- Your main branch is never polluted with session config
- You can run multiple sessions in parallel
- `claudesetup export` diffs only your project files, never setup files

```bash
claudesetup export my-session
# Shows: "12 source files changed, 0 config files"
# Options: [m]erge / [s]quash / [c]ancel
```

## Session commands

```bash
claudesetup list                    # all sessions
claudesetup status <session-id>     # full session details (JSON)
claudesetup resume <session-id>     # resume (recreates worktree if needed)
claudesetup erase <session-id>      # clean up: delete files, restore settings, remove worktree
```

## CLI reference

```bash
claudesetup "intent"                # create session (shorthand)
claudesetup setup "intent"          # same, explicit subcommand
claudesetup list
claudesetup status <id>
claudesetup resume <id>
claudesetup export <id>
claudesetup erase <id>
```

Both `claudesetup` and `claude-auto-setup` are available as binary names.

## Integration with other packages

- **[coder-config](https://github.com/regression-io/coder-config)** — static MCP/rules configuration across tools; complementary for base config
- **[@schuettc/claude-code-setup](https://www.npmjs.com/package/@schuettc/claude-code-setup)** — preset plugin installer; use as a fallback when search finds nothing
- **[claudekit](https://www.npmjs.com/package/claudekit)** — guardrails and checkpoints; can be installed as part of a claude-auto-setup session

---

> Not affiliated with Anthropic. Claude and Claude Code are trademarks of Anthropic.

## License

MIT
